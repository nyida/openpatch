'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { MarketRow, type DashboardMarket } from '@/components/whale/MarketCard';
import { LiveRefreshNote } from '@/components/whale/LiveRefreshNote';
import { WhaleTicker } from '@/components/whale/WhaleTicker';
import { DataSourcesBanner } from '@/components/whale/DataSourcesBanner';
import { ArbitrageScanner } from '@/components/ArbitrageScanner';
import { TopMoversPanel } from '@/components/whale/TopMoversPanel';
import { DbStatusBanner } from '@/components/whale/DbStatusBanner';
import {
  Shell,
  PageHeader,
  SearchInput,
  Segmented,
  Pager,
  TableShell,
  SkeletonTable,
  Toolbar,
  SectorNav,
  FadeSwap,
  StatStrip,
  StatPill,
} from '@/components/whale/Shell';
import { inferMarketCategory, MARKET_CATEGORIES, type MarketCategory } from '@/lib/whale/categories';
import { useScrapeStatus } from '@/lib/whale/useScrapeStatus';
import { fetchJson } from '@/lib/whale/fetch';
import { useArbitrageMap } from '@/lib/whale/hooks';
import { lookupSpread } from '@/services/arbitrage.utils';
import { isPastMarket, platformLabel, type Platform, fmtUsd } from '@/lib/whale/utils';

const CryptoOverviewStrip = dynamic(
  () => import('@/components/whale/CryptoOverviewStrip').then((m) => m.CryptoOverviewStrip),
  { ssr: false, loading: () => null },
);

const PAGE_SIZE = 30;
const POLL_MS = 30_000;

const SECTOR_TABS: { id: MarketCategory | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  ...MARKET_CATEGORIES.map((c) => ({ id: c, label: c })),
];

export default function DashboardPage() {
  const [markets, setMarkets] = useState<DashboardMarket[]>([]);
  const { status, error: statusError, refresh: refreshStatus, isLoading: statusLoading } = useScrapeStatus();
  const [lastFetch, setLastFetch] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'open' | 'archived'>('open');
  const [category, setCategory] = useState<MarketCategory | 'all'>('all');
  const [platform, setPlatform] = useState<Platform | 'all'>('all');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const pollMs = status?.scrape_in_progress ? 10000 : POLL_MS;
  const { data: arbData } = useArbitrageMap(0, { refetch: false });
  const arbMap = arbData?.byPolyTitle ?? {};

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      setError(null);
      try {
        const qs = platform !== 'all' ? `?platform=${platform}` : '';
        const data = await fetchJson<DashboardMarket[]>(`/api/dashboard${qs}`, undefined, { retries: 3 });
        if (!Array.isArray(data)) throw new Error('Invalid response');
        setMarkets(data);
        setLastFetch(Date.now());
      } catch (e) {
        if (!silent) setMarkets([]);
        setError(e instanceof Error ? e.message : 'Failed to load data');
      } finally {
        setLoading(false);
      }
    },
    [platform],
  );

  useEffect(() => {
    load();
    const id = setInterval(() => load(true), pollMs);
    return () => clearInterval(id);
  }, [load, pollMs]);

  useEffect(() => setPage(1), [tab, search, category, platform]);

  const showVenueNav = useMemo(
    () => (status?.platforms ?? ['polymarket']).some((p) => p !== 'polymarket'),
    [status?.platforms],
  );

  const platformTabs = useMemo(() => {
    if (!showVenueNav) return [];
    const platforms = status?.platforms?.length ? status.platforms : ['polymarket'];
    return [
      { id: 'all' as const, label: 'All venues' },
      ...platforms.map((p) => ({ id: p as Platform, label: platformLabel(p) })),
    ];
  }, [status?.platforms, showVenueNav]);

  const matchesSectorAndSearch = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (m: DashboardMarket) => {
      if (q && !m.name.toLowerCase().includes(q)) return false;
      if (category !== 'all' && inferMarketCategory(m.name) !== category) return false;
      return true;
    };
  }, [search, category]);

  const openFiltered = useMemo(
    () => markets.filter((m) => matchesSectorAndSearch(m) && !isPastMarket(m.name)),
    [markets, matchesSectorAndSearch],
  );
  const archivedFiltered = useMemo(
    () => markets.filter((m) => matchesSectorAndSearch(m) && isPastMarket(m.name)),
    [markets, matchesSectorAndSearch],
  );

  const filtered = useMemo(
    () => (tab === 'open' ? openFiltered : archivedFiltered),
    [tab, openFiltered, archivedFiltered],
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const viewKey = `${platform}-${category}-${tab}-${safePage}`;

  const totalExposure = useMemo(
    () => openFiltered.reduce((s, m) => s + m.total_usd, 0),
    [openFiltered],
  );

  return (
    <Shell>
      <PageHeader
        title="Whale holdings vs. market odds"
        description="Value-weighted YES share across tracked wallets compared to exchange mid-price."
        action={lastFetch ? <LiveRefreshNote lastFetch={lastFetch} label="Synced" /> : null}
      />

      <DbStatusBanner error={statusError ?? error} onRetry={() => { refreshStatus(); load(); }} loading={statusLoading || loading} />

      {status && (
        <StatStrip>
          <StatPill label="Open contracts" value={openFiltered.length.toLocaleString()} accent="mint" />
          <StatPill label="Whales tracked" value={`${status.trader_count} / ${status.whale_target}`} />
          <StatPill label="Total exposure" value={fmtUsd(totalExposure)} />
          <StatPill label="Live fills" value={status.live_trade_count.toLocaleString()} />
          <StatPill label="Leaderboard" value={status.all_trader_count.toLocaleString()} />
        </StatStrip>
      )}

      <DataSourcesBanner />
      <TopMoversPanel since="1h" limit={6} />
      <CryptoOverviewStrip />

      <div className="flex flex-wrap gap-2 mb-3">
        {showVenueNav && (
          <SectorNav value={platform} onChange={setPlatform} options={platformTabs} className="!mb-0 flex-1" />
        )}
        <SectorNav value={category} onChange={setCategory} options={SECTOR_TABS} className="!mb-0 flex-1" />
      </div>

      <Toolbar>
        <SearchInput value={search} onChange={setSearch} placeholder="Filter contracts…" />
        <Segmented
          options={[
            { id: 'open' as const, label: 'Open' },
            { id: 'archived' as const, label: 'Archived' },
          ]}
          value={tab}
          onChange={setTab}
          counts={{ open: openFiltered.length, archived: archivedFiltered.length }}
        />
      </Toolbar>

      {error && (
        <div className="error-banner">
          <p>{error}</p>
        </div>
      )}

      {loading ? (
        <SkeletonTable rows={14} />
      ) : !error && filtered.length === 0 ? (
        <FadeSwap viewKey={`empty-${viewKey}`}>
          <div className="empty surface">
            {markets.length === 0 ? (
              <>
                <span className="empty-title">No whale data yet</span>
                <span className="empty-hint">
                  Set WHALE_DB_PATH in .env.local or run npm run scrape:ensure
                </span>
              </>
            ) : (
              <span className="empty-title">No contracts match the current filters</span>
            )}
          </div>
        </FadeSwap>
      ) : !error ? (
        <FadeSwap viewKey={viewKey}>
          <TableShell
            footer={
              filtered.length > PAGE_SIZE ? (
                <Pager
                  page={safePage}
                  totalPages={totalPages}
                  total={filtered.length}
                  pageSize={PAGE_SIZE}
                  onChange={setPage}
                />
              ) : undefined
            }
          >
            <table className="data-table dashboard-table">
              <colgroup>
                <col className="col-rank" />
                <col className="col-market" />
                <col className="col-cat" />
                <col className="col-bias" />
                <col className="col-bar" />
                <col className="col-bar" />
                <col className="col-edge" />
                <col className="col-arb" />
                <col className="col-spark" />
                <col className="col-num" />
                <col className="col-num" />
                <col className="col-act" />
              </colgroup>
              <thead>
                <tr>
                  <th className="col-rank">#</th>
                  <th className="col-market">Contract</th>
                  <th className="col-cat">Sector</th>
                  <th className="col-bias">Signal</th>
                  <th className="col-bar">Mkt %</th>
                  <th className="col-bar">Whale %</th>
                  <th className="col-edge">Δ pp</th>
                  <th className="col-arb">Net profit</th>
                  <th className="col-spark">Trend</th>
                  <th className="col-num">Notional</th>
                  <th className="col-num">N</th>
                  <th className="col-act" />
                </tr>
              </thead>
              <tbody>
                {pageItems.map((m, i) => (
                  <MarketRow
                    key={`${m.platform}-${m.name}`}
                    market={m}
                    rank={(safePage - 1) * PAGE_SIZE + i + 1}
                    spread={lookupSpread(arbMap, m.name.replace(/\s*\[(YES|NO)\]\s*$/i, ''))}
                  />
                ))}
              </tbody>
            </table>
          </TableShell>
        </FadeSwap>
      ) : null}

      <ArbitrageScanner />

      <WhaleTicker />
    </Shell>
  );
}
