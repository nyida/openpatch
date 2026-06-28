import { getDb } from './db';
import { inferMarketCategory, type MarketCategory } from './categories';
import { platformExternalUrl, resolveExternalUrl } from './marketUrls';
import type { Platform } from './utils';

export type TraderRow = {
  wallet: string;
  display_name: string;
  alltime_profit: number;
  rank: number;
  trade_count?: number;
  win_rate?: number;
  position_count?: number;
};

function externalUrl(platform: string, title: string): string {
  return platformExternalUrl(platform, { title });
}

export function getTraders(): TraderRow[] {
  const db = getDb();
  const rows = db
    .prepare('SELECT wallet, display_name, alltime_profit FROM traders ORDER BY alltime_profit DESC')
    .all() as { wallet: string; display_name: string; alltime_profit: number }[];
  return rows.map((row, i) => ({ ...row, rank: i + 1 }));
}

export function getAllTraders(): TraderRow[] {
  const db = getDb();
  const rows = db
    .prepare(`
      SELECT
        a.wallet,
        a.display_name,
        a.alltime_profit,
        (SELECT COUNT(*) FROM trades t WHERE t.wallet = a.wallet) AS trade_count,
        (SELECT COUNT(*) FROM positions p WHERE p.wallet = a.wallet) AS position_count,
        (
          SELECT CASE WHEN COUNT(*) > 0
            THEN CAST(SUM(CASE WHEN realized_profit > 0 THEN 1 ELSE 0 END) AS REAL) / COUNT(*)
            ELSE 0 END
          FROM trades t WHERE t.wallet = a.wallet AND t.side = 'SELL'
        ) AS win_rate
      FROM all_traders a
      ORDER BY a.alltime_profit DESC
    `)
    .all() as {
    wallet: string;
    display_name: string;
    alltime_profit: number;
    trade_count: number;
    position_count: number;
    win_rate: number;
  }[];
  return rows.map((row, i) => ({
    ...row,
    rank: i + 1,
    win_rate: Math.round((row.win_rate ?? 0) * 1000) / 10,
  }));
}

export function getAllMarkets() {
  const db = getDb();
  return db
    .prepare(`
      SELECT market_title,
             COALESCE(platform, 'polymarket') AS platform,
             COUNT(DISTINCT wallet) as whale_count,
             SUM(usd_value) as total_usd
      FROM positions
      GROUP BY market_title, COALESCE(platform, 'polymarket')
      ORDER BY total_usd DESC
    `)
    .all() as { market_title: string; platform: string; whale_count: number; total_usd: number }[];
}

function marketTitleVariants(marketTitle: string): string[] {
  const clean = marketTitle.replace(/\s*\[(YES|NO)\]\s*$/i, '').trim();
  const variants = new Set<string>([marketTitle.trim(), clean]);
  if (clean) {
    variants.add(`${clean} [YES]`);
    variants.add(`${clean} [NO]`);
  }
  return [...variants].filter(Boolean);
}

function normalizeTitleKey(title: string): string {
  return title.replace(/\s*\[(YES|NO)\]\s*$/i, '').trim().toLowerCase();
}

export function getMarketTraders(marketTitle: string, platform = 'polymarket') {
  const db = getDb();
  const titles = marketTitleVariants(marketTitle);
  const placeholders = titles.map(() => '?').join(', ');

  let rows = db
    .prepare(`
      SELECT
        p.wallet,
        COALESCE(t.display_name, p.wallet) as display_name,
        p.outcome,
        p.shares,
        p.avg_price,
        p.current_price,
        p.usd_value,
        COALESCE(p.platform, 'polymarket') AS platform,
        (p.shares * (p.current_price - p.avg_price)) as unrealized_pnl
      FROM positions p
      LEFT JOIN traders t ON p.wallet = t.wallet
      WHERE p.market_title IN (${placeholders}) AND COALESCE(p.platform, 'polymarket') = ?
      ORDER BY p.usd_value DESC
    `)
    .all(...titles, platform) as Record<string, unknown>[];

  if (rows.length === 0) {
    const clean = normalizeTitleKey(marketTitle);
    if (clean.length >= 8) {
      rows = db
        .prepare(`
          SELECT
            p.wallet,
            COALESCE(t.display_name, p.wallet) as display_name,
            p.outcome,
            p.shares,
            p.avg_price,
            p.current_price,
            p.usd_value,
            COALESCE(p.platform, 'polymarket') AS platform,
            (p.shares * (p.current_price - p.avg_price)) as unrealized_pnl
          FROM positions p
          LEFT JOIN traders t ON p.wallet = t.wallet
          WHERE COALESCE(p.platform, 'polymarket') = ?
            AND LOWER(REPLACE(REPLACE(p.market_title, ' [YES]', ''), ' [NO]', '')) LIKE ?
          ORDER BY p.usd_value DESC
          LIMIT 50
        `)
        .all(platform, `%${clean}%`) as Record<string, unknown>[];
    }
  }

  return rows.map((row) => ({
    ...row,
    display_name: row.display_name || row.wallet,
  }));
}

export function getTraderStats(wallet: string) {
  const db = getDb();
  let trader = db
    .prepare('SELECT display_name, alltime_profit FROM traders WHERE wallet = ?')
    .get(wallet) as { display_name: string; alltime_profit: number } | undefined;

  if (!trader) {
    trader = db
      .prepare('SELECT display_name, alltime_profit FROM all_traders WHERE wallet = ?')
      .get(wallet) as { display_name: string; alltime_profit: number } | undefined;
    if (!trader) return null;
  }

  const rank = (
    db
      .prepare('SELECT COUNT(*) + 1 AS r FROM all_traders WHERE alltime_profit > ?')
      .get(trader.alltime_profit) as { r: number }
  ).r;

  const positions = db
    .prepare(`
      SELECT market_title, outcome, shares, avg_price, current_price, usd_value,
             COALESCE(platform, 'polymarket') AS platform,
             (shares * (current_price - avg_price)) as unrealized_pnl
      FROM positions WHERE wallet = ?
    `)
    .all(wallet) as {
    market_title: string;
    outcome: string;
    shares: number;
    avg_price: number;
    current_price: number;
    usd_value: number;
    platform: string;
    unrealized_pnl: number;
  }[];

  const totalPositionValue = positions.reduce((s, p) => s + p.usd_value, 0);
  const totalUnrealizedPnl = positions.reduce((s, p) => s + p.unrealized_pnl, 0);

  const tradeStats = db
    .prepare(`
      SELECT COUNT(*) as trade_count, SUM(size) as total_volume,
             SUM(realized_profit) as trade_realized_pnl,
             MIN(timestamp) as first_trade, MAX(timestamp) as last_trade
      FROM trades WHERE wallet = ?
    `)
    .get(wallet) as {
    trade_count: number;
    total_volume: number;
    trade_realized_pnl: number;
    first_trade: number | null;
    last_trade: number | null;
  };

  const totalSells = (
    db.prepare("SELECT COUNT(*) as c FROM trades WHERE wallet = ? AND side = 'SELL'").get(wallet) as { c: number }
  ).c;
  const profitableSells = (
    db
      .prepare("SELECT COUNT(*) as c FROM trades WHERE wallet = ? AND side = 'SELL' AND realized_profit > 0")
      .get(wallet) as { c: number }
  ).c;

  const redemptionStats = db
    .prepare(`
      SELECT MAX(size) as max_redemption, SUM(size) as total_redemption, COUNT(*) as redemption_count
      FROM activity WHERE wallet = ? AND event_type = 'REDEEM'
    `)
    .get(wallet) as { max_redemption: number | null; total_redemption: number | null; redemption_count: number };

  const maxRedemption = redemptionStats?.max_redemption ?? 0;
  const totalRedemption = redemptionStats?.total_redemption ?? 0;
  const redemptionCount = redemptionStats?.redemption_count ?? 0;
  const totalRealizedPnl = trader.alltime_profit - totalUnrealizedPnl;
  const maxTradeWin =
    (db
      .prepare("SELECT MAX(realized_profit) as m FROM trades WHERE wallet = ? AND side = 'SELL'")
      .get(wallet) as { m: number | null }).m ?? 0;
  const biggestWin = Math.max(maxTradeWin, maxRedemption);
  const closedEvents = totalSells + redemptionCount;
  const profitableEvents = profitableSells + redemptionCount;
  const winRate = closedEvents > 0 ? profitableEvents / closedEvents : 0;

  const outcomeSplit =
    positions.length > 0
      ? (db
          .prepare(
            'SELECT outcome, SUM(usd_value) as total_usd, COUNT(*) as count FROM positions WHERE wallet = ? GROUP BY outcome',
          )
          .all(wallet) as { outcome: string; total_usd: number; count: number }[])
      : [];

  return {
    display_name: trader.display_name ?? 'Unknown',
    alltime_profit: trader.alltime_profit,
    rank,
    position_count: positions.length,
    total_position_value: totalPositionValue,
    total_unrealized_pnl: totalUnrealizedPnl,
    total_realized_pnl: totalRealizedPnl,
    trade_realized_pnl: tradeStats?.trade_realized_pnl ?? 0,
    total_redemption: totalRedemption,
    positions,
    trade_count: tradeStats?.trade_count ?? 0,
    total_volume: tradeStats?.total_volume ?? 0,
    win_rate: winRate,
    biggest_win: biggestWin,
    first_trade: tradeStats?.first_trade ?? null,
    last_trade: tradeStats?.last_trade ?? null,
    outcome_split: outcomeSplit,
  };
}

export function getTrades(wallet: string, limit: number) {
  const db = getDb();
  return db
    .prepare(`
      SELECT market_title, outcome, side, size, price, timestamp, realized_profit,
             COALESCE(platform, 'polymarket') AS platform,
             COALESCE(trade_kind, 'wallet_trade') AS trade_kind
      FROM trades WHERE wallet = ? ORDER BY timestamp DESC LIMIT ?
    `)
    .all(wallet, limit);
}

export function getActivity(wallet: string, limit: number) {
  const db = getDb();
  return db
    .prepare(`
      SELECT event_type, market_title, outcome, size, price, timestamp, data
      FROM activity WHERE wallet = ? ORDER BY timestamp DESC LIMIT ?
    `)
    .all(wallet, limit);
}

export function getPositions(wallet: string) {
  const db = getDb();
  return db
    .prepare(`
      SELECT market_title, outcome, shares, avg_price, current_price, usd_value,
             COALESCE(platform, 'polymarket') AS platform,
             (shares * (current_price - avg_price)) as unrealized_pnl
      FROM positions WHERE wallet = ?
    `)
    .all(wallet);
}

export function getChartData(wallet: string) {
  const db = getDb();
  const rows = db
    .prepare(`
      SELECT DATE(timestamp, 'unixepoch') as date, SUM(realized_profit) as daily_pnl
      FROM trades WHERE wallet = ?
      GROUP BY DATE(timestamp, 'unixepoch')
      ORDER BY date
    `)
    .all(wallet) as { date: string; daily_pnl: number | null }[];

  let cum = 0;
  return rows.map((row) => {
    cum += row.daily_pnl ?? 0;
    return { date: row.date, cumulative_pnl: cum };
  });
}

function computeBias(yesPct: number, marketPrice: number): string {
  const diff = yesPct / 100 - marketPrice;
  if (diff > 0.05) return 'Bullish';
  if (diff < -0.05) return 'Bearish';
  return 'Neutral';
}

type DashboardRow = {
  market_title: string;
  platform: string;
  outcome: string;
  usd_value: number;
  current_price: number;
};

type WalletStat = {
  market_title: string;
  platform: string;
  trader_count: number;
  total_usd: number;
};

type OutcomeAgg = { total: number; price: number };

type MarketAgg = {
  title: string;
  platform: string;
  total_usd: number;
  outcomes: Map<string, OutcomeAgg>;
};

function buildDashboardFromAggregates(walletStats: WalletStat[], outcomeRows: DashboardRow[]) {
  const walletsByKey = new Map<string, WalletStat>();
  for (const w of walletStats) {
    walletsByKey.set(`${w.market_title}\0${w.platform}`, w);
  }

  const markets = new Map<string, MarketAgg>();

  for (const row of outcomeRows) {
    const key = `${row.market_title}\0${row.platform}`;
    let agg = markets.get(key);
    if (!agg) {
      const w = walletsByKey.get(key);
      agg = {
        title: row.market_title,
        platform: row.platform,
        total_usd: w?.total_usd ?? 0,
        outcomes: new Map(),
      };
      markets.set(key, agg);
    }
    const existing = agg.outcomes.get(row.outcome) ?? { total: 0, price: row.current_price };
    existing.total += row.usd_value;
    existing.price = row.current_price;
    agg.outcomes.set(row.outcome, existing);
  }

  const result = [];

  for (const agg of markets.values()) {
    const key = `${agg.title}\0${agg.platform}`;
    const w = walletsByKey.get(key);
    if (w) agg.total_usd = w.total_usd;
    let yesCap = 0;
    let noCap = 0;
    let yesPrice = 0.5;

    for (const [outcome, data] of agg.outcomes) {
      const lower = outcome.toLowerCase();
      if (lower === 'yes') {
        yesCap = data.total;
        yesPrice = data.price;
      } else if (lower === 'no') {
        noCap = data.total;
      }
    }

    let sentiment: string;
    let marketPrice: number;
    let bias: string;

    if (yesCap > 0 || noCap > 0) {
      const total = yesCap + noCap;
      const yesPct = total === 0 ? 50 : Math.round((yesCap / total) * 1000) / 10;
      const noPct = 100 - yesPct;
      sentiment = `${yesPct}% YES / ${noPct}% NO`;
      marketPrice = Math.max(0, Math.min(1, yesPrice));
      bias = computeBias(yesPct, marketPrice);
    } else {
      const sorted = [...agg.outcomes.entries()].sort((a, b) => b[1].total - a[1].total);
      if (sorted.length >= 2) {
        const [o1, o2] = sorted;
        const totalOut = o1[1].total + o2[1].total;
        const pct1 = totalOut === 0 ? 50 : Math.round((o1[1].total / totalOut) * 1000) / 10;
        const pct2 = 100 - pct1;
        sentiment = `${pct1}% ${o1[0]} / ${pct2}% ${o2[0]}`;
        marketPrice = Math.max(0, Math.min(1, o1[1].price));
        bias = computeBias(pct1, marketPrice);
      } else {
        const out1 = sorted[0]?.[0] ?? 'Unknown';
        sentiment = `${out1} 100%`;
        marketPrice = Math.max(0, Math.min(1, sorted[0]?.[1].price ?? 0.5));
        bias = 'Neutral';
      }
    }

    result.push({
      name: agg.title,
      trader_count: w?.trader_count ?? 0,
      total_usd: agg.total_usd,
      market_price: marketPrice,
      whale_sentiment: sentiment,
      bias,
      platform: agg.platform,
      external_url: externalUrl(agg.platform, agg.title),
    });
  }

  result.sort((a, b) => b.total_usd - a.total_usd);
  return result;
}

export function getDashboard(platform: Platform | 'all' = 'all') {
  const db = getDb();
  const where = platform === 'all' ? '' : 'WHERE COALESCE(platform, \'polymarket\') = ?';
  const params = platform === 'all' ? [] : [platform];

  const walletStats = db
    .prepare(`
      SELECT market_title,
             COALESCE(platform, 'polymarket') AS platform,
             COUNT(DISTINCT wallet) AS trader_count,
             SUM(usd_value) AS total_usd
      FROM positions
      ${where}
      GROUP BY market_title, COALESCE(platform, 'polymarket')
    `)
    .all(...params) as WalletStat[];

  const outcomeRows = db
    .prepare(`
      SELECT market_title,
             COALESCE(platform, 'polymarket') AS platform,
             outcome,
             SUM(usd_value) AS usd_value,
             MAX(current_price) AS current_price
      FROM positions
      ${where}
      GROUP BY market_title, COALESCE(platform, 'polymarket'), outcome
    `)
    .all(...params) as DashboardRow[];

  return buildDashboardFromAggregates(walletStats, outcomeRows);
}

function liveWhereClause(platform: string, category: string) {
  let sql = `
    WHERE COALESCE(usd_value, size * price) >= ?
      AND COALESCE(trade_kind, 'wallet_trade') IN ('wallet_trade', 'anonymous_fill')
      AND COALESCE(platform, 'polymarket') NOT IN ('manifold', 'predictit')
  `;
  const params: (string | number)[] = [];
  if (platform !== 'all') {
    sql += ` AND COALESCE(platform, 'polymarket') = ?`;
    params.push(platform);
  }
  return { sql, params };
}

function matchesCategory(
  marketTitle: string,
  eventTitle: string | null,
  storedCategory: string | null,
  category: string,
): boolean {
  if (category === 'all') return true;
  if (storedCategory && storedCategory === category) return true;
  const combined = `${marketTitle} ${eventTitle ?? ''}`;
  return inferMarketCategory(combined) === (category as MarketCategory);
}

export function getLiveWhales(
  minSize: number,
  platform: string,
  limit: number,
  category = 'all',
) {
  const db = getDb();
  const { sql, params } = liveWhereClause(platform, category);
  const fetchLimit = category === 'all' ? limit : Math.min(limit * 3, 600);
  const rows = db
    .prepare(`
      SELECT market_title, event_title, category, outcome, side, price, size,
             COALESCE(usd_value, size * price) AS usd_value,
             timestamp,
             COALESCE(platform, 'polymarket') AS platform,
             external_url,
             COALESCE(trade_kind, 'wallet_trade') AS trade_kind
      FROM trades
      ${sql}
      ORDER BY timestamp DESC
      LIMIT ?
    `)
    .all(minSize, ...params, fetchLimit) as {
    market_title: string;
    event_title: string | null;
    category: string | null;
    outcome: string;
    side: string;
    price: number;
    size: number;
    usd_value: number;
    timestamp: number;
    platform: string;
    external_url: string | null;
    trade_kind: string;
  }[];

  return rows
    .filter((r) => matchesCategory(r.market_title, r.event_title, r.category, category))
    .slice(0, limit)
    .map((r) => ({
      ...r,
      external_url: resolveExternalUrl(r.platform, r.market_title, r.external_url),
    }));
}

export function getLiveWhaleCount(minSize: number, platform: string, category = 'all'): number {
  const db = getDb();
  const { sql, params } = liveWhereClause(platform, category);
  if (category === 'all') {
    return (
      db.prepare(`SELECT COUNT(*) AS c FROM trades ${sql}`).get(minSize, ...params) as { c: number }
    ).c;
  }
  const rows = db
    .prepare(`
      SELECT market_title, event_title, category
      FROM trades
      ${sql}
    `)
    .all(minSize, ...params) as {
    market_title: string;
    event_title: string | null;
    category: string | null;
  }[];
  return rows.filter((r) => matchesCategory(r.market_title, r.event_title, r.category, category))
    .length;
}

export type KalshiFlowRow = {
  market_title: string;
  event_title: string | null;
  net_flow_usd: number;
  yes_usd: number;
  no_usd: number;
  trade_count: number;
};

function isYesOutcome(outcome: string, side: string): boolean {
  const o = outcome.toLowerCase();
  const s = side.toLowerCase();
  if (o.includes('yes') || s === 'yes' || s === 'buy') return true;
  if (o.includes('no') || s === 'no' || s === 'sell') return false;
  return s !== 'sell';
}

export function getKalshiNetFlow(hoursBack = 1, minSize = 0, limit = 1000): KalshiFlowRow[] {
  const db = getDb();
  const since = Math.floor(Date.now() / 1000) - hoursBack * 3600;
  const rows = db
    .prepare(`
      SELECT market_title, event_title, outcome, side,
             COALESCE(usd_value, size * price) AS usd_value
      FROM trades
      WHERE COALESCE(platform, 'polymarket') = 'kalshi'
        AND timestamp >= ?
        AND COALESCE(usd_value, size * price) >= ?
      ORDER BY timestamp DESC
      LIMIT ?
    `)
    .all(since, minSize, limit) as {
    market_title: string;
    event_title: string | null;
    outcome: string;
    side: string;
    usd_value: number;
  }[];

  const byMarket = new Map<string, KalshiFlowRow>();
  for (const r of rows) {
    const key = r.market_title;
    const cur = byMarket.get(key) ?? {
      market_title: r.market_title,
      event_title: r.event_title,
      net_flow_usd: 0,
      yes_usd: 0,
      no_usd: 0,
      trade_count: 0,
    };
    const yes = isYesOutcome(r.outcome, r.side);
    if (yes) {
      cur.yes_usd += r.usd_value;
      cur.net_flow_usd += r.usd_value;
    } else {
      cur.no_usd += r.usd_value;
      cur.net_flow_usd -= r.usd_value;
    }
    cur.trade_count += 1;
    byMarket.set(key, cur);
  }

  return Array.from(byMarket.values())
    .sort((a, b) => Math.abs(b.net_flow_usd) - Math.abs(a.net_flow_usd))
    .slice(0, 50);
}

