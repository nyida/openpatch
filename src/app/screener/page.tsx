'use client';

import Link from 'next/link';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ExternalLink } from 'lucide-react';
import { MatchedMarketsToggle } from '@/components/whale/MatchedMarketsToggle';
import { FilterToggle } from '@/components/whale/FilterToggle';
import { ArbitrageRow } from '@/components/whale/ArbitrageRow';
import { KalshiFlowWidget } from '@/components/whale/KalshiFlowWidget';
import { MarketTitleLink } from '@/components/whale/MarketTitleLink';
import {
  Shell,
  PageHeader,
  SearchInput,
  Pager,
  TableShell,
  SkeletonTable,
  Toolbar,
  SectorNav,
  FadeSwap,
  StatStrip,
  StatPill,
} from '@/components/whale/Shell';
import { LiveRefreshNote } from '@/components/whale/LiveRefreshNote';
import { fetchJson } from '@/lib/whale/fetch';
import { useArbitrageMap } from '@/lib/whale/hooks';
import { usePoll } from '@/lib/whale/usePoll';
import { fmtUsd, platformShort } from '@/lib/whale/utils';
import { PlatformTag } from '@/components/whale/PlatformTag';
import type { ArbitrageSpread } from '@/services/types';
import type { ScreenerFacets, ScreenerRow } from '@/lib/whale/screener';

const PAGE_SIZE = 50;
const POLL_MS = 120_000;

const PLATFORM_TABS = [
  { id: 'all', label: 'All' },
  { id: 'polymarket', label: 'Polymarket' },
  { id: 'kalshi', label: 'Kalshi' },
  { id: 'manifold', label: 'Manifold' },
  { id: 'metaculus', label: 'Metaculus' },
];

const PROB_BUCKETS = [
  { id: 'all', label: 'All prob' },
  { id: '0-20', label: '0–20%' },
  { id: '20-40', label: '20–40%' },
  { id: '40-60', label: '40–60%' },
  { id: '60-80', label: '60–80%' },
  { id: '80-100', label: '80–100%' },
];

const VOLUME_PRESETS = [
  { id: '0', label: 'Any vol' },
  { id: '1000', label: '> $1K' },
  { id: '10000', label: '> $10K' },
  { id: '100000', label: '> $100K' },
  { id: '1000000', label: '> $1M' },
  { id: '10000000', label: '> $10M' },
];

const DAYS_PRESETS = [
  { id: 'all', label: 'Any days' },
  { id: '0', label: 'Today' },
  { id: '7', label: '≤ 7d' },
  { id: '30', label: '≤ 30d' },
  { id: '90', label: '≤ 90d' },
  { id: '9999', label: '90+ d' },
];

function fmtPct(n: number) {
  return `${(n * 100).toFixed(1)}%`;
}

function fmtOhl(r: ScreenerRow) {
  const o = r.price_open != null ? fmtPct(r.price_open) : '-';
  const h = r.price_high != null ? fmtPct(r.price_high) : '-';
  const l = r.price_low != null ? fmtPct(r.price_low) : '-';
  return `${o} / ${h} / ${l}`;
}

function fmtChange(c: number | null) {
  if (c == null) return '-';
  const pp = c * 100;
  const sign = pp >= 0 ? '+' : '';
  return `${sign}${pp.toFixed(1)}`;
}

type ScreenerResponse = {
  rows: ScreenerRow[];
  total: number;
  facets: ScreenerFacets;
  cached_at: number;
};

export default function ScreenerPage() {
  return (
    <Suspense fallback={<Shell><SkeletonTable rows={14} /></Shell>}>
      <ScreenerContent />
    </Suspense>
  );
}

function ScreenerContent() {
  const urlParams = useSearchParams();
  const urlSearch = urlParams.get('search') ?? '';
  const [rows, setRows] = useState<ScreenerRow[]>([]);
  const [total, setTotal] = useState(0);
  const [facets, setFacets] = useState<ScreenerFacets | null>(null);
  const [platform, setPlatform] = useState('all');
  const [prob, setProb] = useState('all');
  const [volumeMin, setVolumeMin] = useState('0');
  const [days, setDays] = useState('all');
  const [search, setSearch] = useState(urlSearch);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [lastFetch, setLastFetch] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [arbsOnly, setArbsOnly] = useState(false);
  const [matchedOnly, setMatchedOnly] = useState(false);

  const { data: arbData, isLoading: arbLoading } = useArbitrageMap(arbsOnly ? 0.02 : 0, {
    enabled: arbsOnly || matchedOnly,
  });
  const arbPairs = arbData?.pairs ?? [];

  useEffect(() => {
    if (urlSearch) setSearch(urlSearch);
  }, [urlSearch]);

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const params = new URLSearchParams({
          platform,
          prob,
          volume_min: volumeMin,
          search,
          limit: String(PAGE_SIZE),
          offset: String((page - 1) * PAGE_SIZE),
        });
        if (days !== 'all') {
          params.set('days', days);
        }
        if (matchedOnly) {
          params.set('matched_only', '1');
        }
        const data = await fetchJson<ScreenerResponse>(`/api/market_screener?${params}`);
        setRows(data.rows ?? []);
        setTotal(data.total ?? 0);
        setFacets(data.facets ?? null);
        setLastFetch(Date.now());
        setError(null);
      } catch (e) {
        if (!silent) setRows([]);
        setError(e instanceof Error ? e.message : 'Failed to load screener');
      } finally {
        setLoading(false);
      }
    },
    [platform, prob, volumeMin, days, search, page, matchedOnly],
  );

  useEffect(() => setPage(1), [platform, prob, volumeMin, days, search, arbsOnly, matchedOnly]);

  useEffect(() => {
    load();
  }, [load]);

  usePoll(() => load(true), POLL_MS);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const platformTabs = PLATFORM_TABS.map((t) => {
    const count =
      t.id === 'all'
        ? facets?.total
        : t.id === 'polymarket'
          ? facets?.polymarket
          : t.id === 'kalshi'
            ? facets?.kalshi
            : t.id === 'manifold'
              ? facets?.manifold
              : t.id === 'metaculus'
                ? facets?.metaculus
                : undefined;
    const suffix = count != null ? ` · ${count >= 1000 ? `${(count / 1000).toFixed(1)}K` : count}` : '';
    return { ...t, label: `${t.label}${suffix}` };
  });

  const viewKey = `${platform}-${prob}-${volumeMin}-${days}-${search}-${page}-${arbsOnly}-${matchedOnly}`;

  const arbPageItems = arbPairs.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const arbTotalPages = Math.max(1, Math.ceil(arbPairs.length / PAGE_SIZE));

  return (
    <Shell>
      <PageHeader
        title="Market screener"
        description="Filter prediction markets by probability, volume, and resolution date - Polymarket, Kalshi, Manifold, Metaculus"
        action={lastFetch ? <LiveRefreshNote lastFetch={lastFetch} label="Catalog" /> : null}
      />

      {facets && (
        <StatStrip>
          <StatPill label="Markets loaded" value={facets.total.toLocaleString()} accent="mint" />
          <StatPill label="Polymarket" value={facets.polymarket.toLocaleString()} />
          <StatPill label="Kalshi" value={facets.kalshi.toLocaleString()} />
          <StatPill label="Manifold" value={facets.manifold.toLocaleString()} />
          <StatPill label="Metaculus" value={facets.metaculus.toLocaleString()} />
          <StatPill label="Matching" value={total.toLocaleString()} />
        </StatStrip>
      )}

      <SectorNav value={platform} onChange={setPlatform} options={platformTabs} layoutId="screener-platform-nav" />

      <SectorNav
        value={prob}
        onChange={setProb}
        options={PROB_BUCKETS}
        layoutId="screener-prob-nav"
        aria-label="Probability filter"
      />

      <SectorNav
        value={volumeMin}
        onChange={setVolumeMin}
        options={VOLUME_PRESETS}
        layoutId="screener-volume-nav"
        aria-label="Volume filter"
      />

      <SectorNav
        value={days}
        onChange={setDays}
        options={DAYS_PRESETS}
        layoutId="screener-days-nav"
        aria-label="Days filter"
      />

      <Toolbar>
        <SearchInput value={search} onChange={setSearch} placeholder="Search markets…" />
        <div className="toolbar-toggles">
          <MatchedMarketsToggle checked={matchedOnly} onChange={setMatchedOnly} />
          <FilterToggle
            checked={arbsOnly}
            onChange={setArbsOnly}
            label="Show arbs only (≥ 2¢ spread)"
          />
        </div>
      </Toolbar>

      {error && (
        <div className="error-banner">
          <p>{error}</p>
        </div>
      )}

      <div className="screener-layout">
        <div className="screener-main min-w-0">
      {loading && rows.length === 0 && !arbsOnly ? (
        <SkeletonTable rows={14} />
      ) : arbsOnly ? (
        <FadeSwap viewKey={viewKey}>
          <TableShell
            footer={
              arbPairs.length > PAGE_SIZE ? (
                <Pager page={page} totalPages={arbTotalPages} total={arbPairs.length} pageSize={PAGE_SIZE} onChange={setPage} />
              ) : undefined
            }
          >
            <table className="data-table screener-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Matched markets</th>
                  <th className="text-right">Poly</th>
                  <th className="text-right">Kalshi</th>
                  <th className="text-right">Spread</th>
                  <th className="text-right">Net profit</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {arbLoading && arbPairs.length === 0 && (
                  <tr>
                    <td colSpan={7}>
                      <div className="shimmer h-8 w-full rounded my-2" />
                    </td>
                  </tr>
                )}
                {!arbLoading && arbPairs.length === 0 && (
                  <tr>
                    <td colSpan={7}>
                      <div className="empty">No cross-venue arbs above 2¢ right now.</div>
                    </td>
                  </tr>
                )}
                {arbPageItems.map((spread: ArbitrageSpread) => (
                  <ArbitrageRow key={spread.id} spread={spread} />
                ))}
              </tbody>
            </table>
          </TableShell>
        </FadeSwap>
      ) : (
        <FadeSwap viewKey={viewKey}>
          <TableShell
            footer={
              total > PAGE_SIZE ? (
                <Pager page={page} totalPages={totalPages} total={total} pageSize={PAGE_SIZE} onChange={setPage} />
              ) : undefined
            }
          >
            <table className="data-table screener-table">
              <thead>
                <tr>
                  <th>Venue</th>
                  <th>Market</th>
                  <th className="text-right">Prob</th>
                  <th className="text-right">O / H / L</th>
                  <th className="text-right">Δ</th>
                  <th className="text-right">Volume</th>
                  <th className="text-right">Days</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && !error && (
                  <tr>
                    <td colSpan={9}>
                      <div className="empty">No markets match this filter.</div>
                    </td>
                  </tr>
                )}
                {rows.map((r, i) => (
                  <tr key={`${r.platform}-${r.market_title}-${i}`}>
                    <td className="whitespace-nowrap">
                      <PlatformTag platform={r.platform} />
                    </td>
                    <td className="col-market">
                      <MarketTitleLink
                        title={r.market_title}
                        platform={r.platform}
                        extras={{
                          price: r.probability,
                          volume: r.volume,
                          event: r.event_title,
                        }}
                        subtitle={r.event_title}
                      />
                    </td>
                    <td className="text-right font-mono tabular-nums">{fmtPct(r.probability)}</td>
                    <td className="text-right font-mono tabular-nums text-[10px] opacity-80">
                      {fmtOhl(r)}
                    </td>
                    <td
                      className="text-right font-mono tabular-nums"
                      style={{
                        color:
                          r.change_1d == null
                            ? undefined
                            : r.change_1d >= 0
                              ? 'var(--mint)'
                              : 'var(--rose)',
                      }}
                    >
                      {fmtChange(r.change_1d)}
                    </td>
                    <td className="text-right font-mono tabular-nums">{fmtUsd(r.volume)}</td>
                    <td className="text-right font-mono tabular-nums">
                      {r.days_to_resolution ?? '-'}
                    </td>
                    <td className="text-[10px] uppercase opacity-70">{r.status}</td>
                    <td className="text-right whitespace-nowrap">
                      <a
                        href={r.external_url}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-ghost !p-1"
                        title={`Open on ${platformShort(r.platform)}`}
                      >
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableShell>
        </FadeSwap>
      )}

        </div>
        <KalshiFlowWidget />
      </div>

      <p className="text-[10px] opacity-50 mt-4 text-center">
        Aggregated market data from Polymarket Gamma & Kalshi public APIs. Informational only.
      </p>
    </Shell>
  );
}
