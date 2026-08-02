import { getDb } from './db';

export type ScrapeStatus = {
  last_scrape_at: number | null;
  trader_count: number;
  position_count: number;
  market_count: number;
  contract_count: number;
  latest_trade_at: number | null;
  last_kalshi_scrape_at: number | null;
  live_feed_at: number | null;
  live_feed_fresh: boolean;
  live_trade_count: number;
  live_polymarket_trades: number;
  live_kalshi_trades: number;
  all_trader_count: number;
  platforms: string[];
  stale: boolean;
  stale_threshold_minutes: number;
  scrape_in_progress: boolean;
  scrape_complete: boolean;
  whale_target: number;
};

const STALE_MINUTES = 45;
const LIVE_MIN_USD = 500;

const LIVE_TRADE_FILTER = `
  WHERE COALESCE(usd_value, size * price) >= ?
    AND COALESCE(trade_kind, 'wallet_trade') IN ('wallet_trade', 'anonymous_fill')
    AND COALESCE(platform, 'polymarket') NOT IN ('manifold', 'predictit')
`;

function metaValue(db: ReturnType<typeof getDb>, key: string): string | null {
  try {
    const row = db.prepare('SELECT value FROM scrape_metadata WHERE key = ?').get(key) as
      | { value: string }
      | undefined;
    return row?.value ?? null;
  } catch {
    return null;
  }
}

function liveCount(db: ReturnType<typeof getDb>, sql: string, ...params: (string | number)[]): number {
  try {
    return (db.prepare(sql).get(...params) as { c: number }).c ?? 0;
  } catch {
    return 0;
  }
}

export function getAvailablePlatforms(): string[] {
  const db = getDb();
  const platforms = new Set<string>();
  try {
    const positionRows = db
      .prepare(`
        SELECT DISTINCT COALESCE(platform, 'polymarket') AS platform
        FROM positions
      `)
      .all() as { platform: string }[];
    for (const r of positionRows) platforms.add(r.platform);

    const tradeRows = db
      .prepare(`
        SELECT DISTINCT COALESCE(platform, 'polymarket') AS platform
        FROM trades
        WHERE COALESCE(trade_kind, 'wallet_trade') IN ('wallet_trade', 'anonymous_fill')
          AND COALESCE(platform, 'polymarket') NOT IN ('manifold', 'predictit')
      `)
      .all() as { platform: string }[];
    for (const r of tradeRows) platforms.add(r.platform);
  } catch {
    return ['polymarket'];
  }
  if (platforms.size === 0) return ['polymarket'];
  return Array.from(platforms).sort();
}

export function syncMetadataFromDb(db: ReturnType<typeof getDb>) {
  const trader_count = liveCount(db, 'SELECT COUNT(*) AS c FROM traders');
  const position_count = liveCount(db, 'SELECT COUNT(*) AS c FROM positions');
  const market_count = liveCount(db, 'SELECT COUNT(DISTINCT market_title) AS c FROM positions');
  const contract_count = liveCount(
    db,
    `SELECT COUNT(*) AS c FROM (
       SELECT market_title, COALESCE(platform, 'polymarket') AS platform
       FROM positions
       GROUP BY market_title, COALESCE(platform, 'polymarket')
     )`,
  );
  const all_trader_count = liveCount(db, 'SELECT COUNT(*) AS c FROM all_traders');

  let live_trade_count = 0;
  let live_polymarket_trades = 0;
  let live_kalshi_trades = 0;
  try {
    const liveRows = db
      .prepare(`
        SELECT COALESCE(platform, 'polymarket') AS platform, COUNT(*) AS c
        FROM trades
        ${LIVE_TRADE_FILTER}
        GROUP BY COALESCE(platform, 'polymarket')
      `)
      .all(LIVE_MIN_USD) as { platform: string; c: number }[];
    for (const row of liveRows) {
      live_trade_count += row.c;
      if (row.platform === 'polymarket') live_polymarket_trades = row.c;
      if (row.platform === 'kalshi') live_kalshi_trades = row.c;
    }
  } catch {
    /* no trades */
  }

  const platforms = getAvailablePlatforms();
  const now = Math.floor(Date.now() / 1000);
  const stmt = db.prepare('INSERT OR REPLACE INTO scrape_metadata (key, value) VALUES (?, ?)');
  stmt.run('trader_count', String(trader_count));
  stmt.run('position_count', String(position_count));
  stmt.run('market_count', String(market_count));
  stmt.run('contract_count', String(contract_count));
  stmt.run('all_trader_count', String(all_trader_count));
  stmt.run('live_trade_count', String(live_trade_count));
  stmt.run('live_polymarket_trades', String(live_polymarket_trades));
  stmt.run('live_kalshi_trades', String(live_kalshi_trades));
  stmt.run('platforms_json', JSON.stringify(platforms));
  stmt.run('counts_synced_at', String(now));
  if (trader_count > 0) {
    stmt.run('last_scrape_at', String(now));
  }
}

function metaInt(db: ReturnType<typeof getDb>, key: string): number | null {
  const raw = metaValue(db, key);
  if (!raw) return null;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? n : null;
}

export function getScrapeStatus(): ScrapeStatus {
  const db = getDb();
  // Prefer metadata aggressively - full scans on the trades table freeze the server.
  const countsSyncedAt = metaInt(db, 'counts_synced_at');
  const countsFresh = countsSyncedAt != null && Date.now() / 1000 - countsSyncedAt < 6 * 3600;

  const trader_count =
    metaInt(db, 'trader_count') ??
    liveCount(db, 'SELECT COUNT(*) AS c FROM traders');
  const position_count =
    metaInt(db, 'position_count') ??
    liveCount(db, 'SELECT COUNT(*) AS c FROM positions');
  const market_count =
    metaInt(db, 'market_count') ??
    liveCount(db, 'SELECT COUNT(DISTINCT market_title) AS c FROM positions');
  const contract_count =
    metaInt(db, 'contract_count') ??
    liveCount(
      db,
      `SELECT COUNT(*) AS c FROM (
         SELECT market_title, COALESCE(platform, 'polymarket') AS platform
         FROM positions
         GROUP BY market_title, COALESCE(platform, 'polymarket')
       )`,
    );

  const scrapeStatusRaw = metaValue(db, 'scrape_status');
  const whaleTargetMeta = parseInt(metaValue(db, 'whale_target') ?? '0', 10);
  const whaleTarget =
    whaleTargetMeta ||
    metaInt(db, 'all_trader_count') ||
    250;
  const scrape_in_progress =
    scrapeStatusRaw === 'in_progress' ||
    (trader_count > 0 && whaleTarget > 0 && trader_count < whaleTarget);
  const scrape_complete = scrapeStatusRaw === 'complete' || trader_count >= whaleTarget;

  const lastScrapeRaw = metaValue(db, 'last_scrape_at');
  let last_scrape_at = lastScrapeRaw ? parseInt(lastScrapeRaw, 10) : null;

  let latest_trade_at = metaInt(db, 'latest_trade_at');
  if (latest_trade_at == null) {
    try {
      // Indexed DESC seek - avoid SELECT MAX() full scan on huge trades tables.
      const row = db
        .prepare('SELECT timestamp AS ts FROM trades ORDER BY timestamp DESC LIMIT 1')
        .get() as { ts: number | null } | undefined;
      latest_trade_at = row?.ts ?? null;
    } catch {
      latest_trade_at = null;
    }
  }
  if (!last_scrape_at && latest_trade_at) {
    last_scrape_at = latest_trade_at;
  }

  const ageMinutes = last_scrape_at
    ? (Date.now() / 1000 - last_scrape_at) / 60
    : Number.POSITIVE_INFINITY;

  const lastKalshiRaw = metaValue(db, 'last_kalshi_scrape_at');
  const last_kalshi_scrape_at = lastKalshiRaw ? parseInt(lastKalshiRaw, 10) : null;
  const live_feed_at = latest_trade_at;
  const liveAgeMinutes = live_feed_at
    ? (Date.now() / 1000 - live_feed_at) / 60
    : Number.POSITIVE_INFINITY;
  const live_feed_fresh = liveAgeMinutes <= 5;

  let live_trade_count = metaInt(db, 'live_trade_count') ?? 0;
  let live_polymarket_trades = metaInt(db, 'live_polymarket_trades') ?? 0;
  let live_kalshi_trades = metaInt(db, 'live_kalshi_trades') ?? 0;
  if (!countsFresh && live_trade_count === 0) {
    try {
      const liveRows = db
        .prepare(`
          SELECT COALESCE(platform, 'polymarket') AS platform, COUNT(*) AS c
          FROM trades
          ${LIVE_TRADE_FILTER}
          GROUP BY COALESCE(platform, 'polymarket')
        `)
        .all(LIVE_MIN_USD) as { platform: string; c: number }[];
      live_trade_count = 0;
      live_polymarket_trades = 0;
      live_kalshi_trades = 0;
      for (const row of liveRows) {
        live_trade_count += row.c;
        if (row.platform === 'polymarket') live_polymarket_trades = row.c;
        if (row.platform === 'kalshi') live_kalshi_trades = row.c;
      }
    } catch {
      /* no trades table */
    }
  }
  const all_trader_count =
    metaInt(db, 'all_trader_count') ??
    liveCount(db, 'SELECT COUNT(*) AS c FROM all_traders');

  let platforms: string[];
  const platformsJson = metaValue(db, 'platforms_json');
  if (platformsJson) {
    try {
      platforms = JSON.parse(platformsJson) as string[];
    } catch {
      platforms = ['kalshi', 'polymarket'];
    }
  } else {
    platforms = ['kalshi', 'polymarket'];
  }

  return {
    last_scrape_at,
    trader_count,
    position_count,
    market_count,
    contract_count,
    latest_trade_at,
    last_kalshi_scrape_at,
    live_feed_at,
    live_feed_fresh,
    live_trade_count,
    live_polymarket_trades,
    live_kalshi_trades,
    all_trader_count,
    platforms,
    stale: !scrape_in_progress && ageMinutes > STALE_MINUTES,
    stale_threshold_minutes: STALE_MINUTES,
    scrape_in_progress,
    scrape_complete,
    whale_target: whaleTarget,
  };
}
