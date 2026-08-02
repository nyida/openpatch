'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { LiveRefreshNote } from '@/components/whale/LiveRefreshNote';
import { MarketTitleLink } from '@/components/whale/MarketTitleLink';
import {
  Shell,
  PageHeader,
  TableShell,
  SkeletonTable,
  Toolbar,
  SectorNav,
  FadeSwap,
  StatStrip,
  StatPill,
} from '@/components/whale/Shell';
import { MARKET_CATEGORIES } from '@/lib/whale/categories';
import { fetchJson } from '@/lib/whale/fetch';
import { useScrapeStatus } from '@/lib/whale/useScrapeStatus';
import { usePoll } from '@/lib/whale/usePoll';
import {
  fmtContracts,
  fmtPrice,
  fmtUsd,
  platformShort,
} from '@/lib/whale/utils';
import { PlatformTag, TradeKindTag } from '@/components/whale/PlatformTag';
import { MarketChangesPanel } from '@/components/whale/MarketChangesPanel';
import { DataSourcesBanner } from '@/components/whale/DataSourcesBanner';

type LiveTrade = {
  market_title: string;
  event_title: string | null;
  outcome: string;
  side: string;
  price: number;
  size: number;
  usd_value: number;
  timestamp: number;
  platform: string;
  external_url: string | null;
  trade_kind: string;
};

type LiveResponse = { trades: LiveTrade[]; total: number };

const PLATFORM_TABS = [
  { id: 'all', label: 'All' },
  { id: 'polymarket', label: 'Polymarket' },
  { id: 'kalshi', label: 'Kalshi' },
];

const CATEGORY_TABS = [
  { id: 'all', label: 'All' },
  ...MARKET_CATEGORIES.map((c) => ({ id: c, label: c })),
];

const MIN_PRESETS = [500, 1000, 5000, 10000];
const POLL_MS = 10000;
const PAGE_LIMIT = 500;

function fmtTradeTime(ts: number) {
  const d = new Date(ts * 1000);
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', second: '2-digit' });
}

export default function LivePage() {
  const { status } = useScrapeStatus();
  const [trades, setTrades] = useState<LiveTrade[]>([]);
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(PAGE_LIMIT);
  const [platform, setPlatform] = useState('all');
  const [category, setCategory] = useState('all');
  const [minSize, setMinSize] = useState(500);
  const [loading, setLoading] = useState(true);
  const [lastFetch, setLastFetch] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const params = new URLSearchParams({
        min_size: String(minSize),
        platform,
        category,
        limit: String(limit),
      });
      const data = await fetchJson<LiveResponse>(`/api/live_whales?${params}`);
      setTrades(data.trades ?? []);
      setTotal(data.total ?? 0);
      setLastFetch(Date.now());
      setError(null);
    } catch (e) {
      if (!silent) {
        setTrades([]);
        setTotal(0);
      }
      setError(e instanceof Error ? e.message : 'Failed to load live feed');
    } finally {
      setLoading(false);
    }
  }, [minSize, platform, category, limit]);

  useEffect(() => {
    setLimit(PAGE_LIMIT);
  }, [minSize, platform, category]);

  useEffect(() => {
    load();
  }, [load]);

  usePoll(() => load(true), POLL_MS);

  const viewKey = `${platform}-${category}-${minSize}-${limit}`;

  const cumulativeVolume = useMemo(
    () => trades.reduce((s, t) => s + t.usd_value, 0),
    [trades],
  );
  const canLoadMore = trades.length < total && limit < 2000;

  return (
    <Shell>
      <PageHeader
        title="Whale tracking"
        description="Large fills across Polymarket (tracked wallets) and Kalshi (anonymous public tape)"
        action={lastFetch ? <LiveRefreshNote lastFetch={lastFetch} label="Live" /> : null}
      />

      <StatStrip>
        <StatPill
          label="All fills"
          value={status ? status.live_trade_count.toLocaleString() : total.toLocaleString()}
        />
        <StatPill
          label="Polymarket"
          value={status ? status.live_polymarket_trades.toLocaleString() : '-'}
        />
        <StatPill
          label="Kalshi"
          value={status ? status.live_kalshi_trades.toLocaleString() : '-'}
          accent={status?.live_feed_fresh ? 'mint' : undefined}
        />
        <StatPill label="Cumulative vol" value={fmtUsd(cumulativeVolume)} accent="mint" />
        <StatPill label="Showing" value={`${trades.length.toLocaleString()} latest`} />
      </StatStrip>

      <DataSourcesBanner />
      <MarketChangesPanel since="1h" limit={12} />

      <SectorNav
        value={platform}
        onChange={setPlatform}
        options={PLATFORM_TABS}
        layoutId="live-platform-nav"
      />
      <SectorNav
        value={category}
        onChange={setCategory}
        options={CATEGORY_TABS}
        layoutId="live-category-nav"
        aria-label="Category filter"
      />

      <Toolbar>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="opacity-70">Min size</span>
          {MIN_PRESETS.map((n) => (
            <button
              key={n}
              type="button"
              className="btn btn-ghost !py-1 !px-2"
              data-active={minSize === n}
              onClick={() => setMinSize(n)}
            >
              ${n >= 1000 ? `${n / 1000}k` : n}
            </button>
          ))}
          <input
            type="number"
            value={minSize}
            onChange={(e) => setMinSize(Number(e.target.value))}
            className="input w-24"
          />
        </div>
        <span className="text-xs font-mono tabular-nums opacity-80">
          {total.toLocaleString()} matching · showing {trades.length.toLocaleString()}
        </span>
      </Toolbar>

      {error && !loading && trades.length === 0 && (
        <div className="error-banner">
          <p>{error}</p>
        </div>
      )}

      {loading && trades.length === 0 ? (
        <SkeletonTable rows={14} />
      ) : (
        <FadeSwap viewKey={viewKey}>
          <TableShell
            footer={
              canLoadMore ? (
                <div className="flex justify-center py-2">
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => setLimit((n) => Math.min(n + PAGE_LIMIT, 2000))}
                  >
                    Load more ({Math.min(PAGE_LIMIT, total - trades.length).toLocaleString()} remaining)
                  </button>
                </div>
              ) : undefined
            }
          >
            <table className="data-table live-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Platform</th>
                  <th>Market</th>
                  <th>Side</th>
                  <th className="text-right">Price</th>
                  <th className="text-right">Contracts</th>
                  <th className="text-right">Size</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {trades.length === 0 && !error && (
                  <tr>
                    <td colSpan={8}>
                      <div className="empty">No trades match this filter.</div>
                    </td>
                  </tr>
                )}
                {trades.map((t, i) => (
                  <tr key={`${t.platform}-${t.timestamp}-${i}`}>
                    <td className="font-mono text-[11px] whitespace-nowrap tabular-nums">
                      {fmtTradeTime(t.timestamp)}
                    </td>
                    <td className="whitespace-nowrap">
                      <PlatformTag platform={t.platform} />
                      {t.trade_kind === 'anonymous_fill' && (
                        <span className="block mt-0.5">
                          <TradeKindTag tradeKind={t.trade_kind} />
                        </span>
                      )}
                    </td>
                    <td className="col-market">
                      <MarketTitleLink
                        title={t.market_title}
                        platform={t.platform}
                        extras={{ price: t.price }}
                        subtitle={t.event_title}
                      />
                    </td>
                    <td>
                      <span style={{ color: t.outcome === 'YES' ? 'var(--mint)' : 'var(--rose)' }}>
                        {t.outcome}
                      </span>
                    </td>
                    <td className="text-right font-mono tabular-nums text-[11px]">
                      {fmtPrice(t.price)}
                    </td>
                    <td className="text-right font-mono tabular-nums">
                      {fmtContracts(t.size)}
                    </td>
                    <td className="text-right font-mono tabular-nums font-medium">
                      {fmtUsd(t.usd_value)}
                    </td>
                    <td className="text-right whitespace-nowrap">
                      <a
                        href={t.external_url ?? '#'}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-ghost !p-1"
                        title={`Open on ${platformShort(t.platform)}`}
                      >
                          <span className="font-mono text-[10px] mr-0.5">
                            {t.platform === 'kalshi' ? 'K' : 'P'}
                          </span>
                          <ExternalLink className="w-3 h-3 inline" />
                        </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableShell>
        </FadeSwap>
      )}
    </Shell>
  );
}
