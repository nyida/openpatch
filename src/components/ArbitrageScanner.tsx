'use client';

import { memo } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ExternalLink } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { fetchJson } from '@/lib/whale/fetch';
import type { PmxtArbitrageResult, PmxtMarketSide } from '@/lib/api/pmxt-scanner';
import { resolveExternalUrl } from '@/lib/whale/marketUrls';
import { TableShell, SkeletonTable, StatPill, StatStrip } from '@/components/whale/Shell';
import { LiveRefreshNote } from '@/components/whale/LiveRefreshNote';
import { DUR, EASE_OUT, fadeUp } from '@/lib/motion';

const REFETCH_MS = 30_000;

function fmtCents(n: number) {
  return `${(n * 100).toFixed(1)}¢`;
}

function fmtPlatform(p: string) {
  return p.charAt(0).toUpperCase() + p.slice(1);
}

function venueHref(side: PmxtMarketSide): string {
  return resolveExternalUrl(side.platform, side.title, side.url, {
    ticker: side.ticker,
  });
}

const MarketCell = memo(function MarketCell({ side }: { side: PmxtMarketSide }) {
  const href = venueHref(side);
  return (
    <div className="min-w-0">
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="market-title leading-snug hover:underline inline-flex items-start gap-1"
        title={`Open on ${fmtPlatform(side.platform)}`}
      >
        <span className="min-w-0">{side.title}</span>
        <ExternalLink className="w-3 h-3 mt-0.5 shrink-0 opacity-40" aria-hidden />
      </a>
      <div className="text-[10px] mt-0.5" style={{ color: 'var(--text-3)' }}>
        {fmtPlatform(side.platform)} · YES {fmtCents(side.yes_price)} / NO {fmtCents(side.no_price)}
      </div>
    </div>
  );
});

export function ArbitrageScanner() {
  const reduced = useReducedMotion();
  const { data, isPending, isError, error, dataUpdatedAt, isFetching } = useQuery({
    queryKey: ['pmxt-arbitrage'],
    queryFn: () => fetchJson<PmxtArbitrageResult>('/api/arbitrage-pmxt', undefined, { timeoutMs: 8_000, retries: 1 }),
    refetchInterval: REFETCH_MS,
    staleTime: REFETCH_MS,
    refetchOnWindowFocus: false,
    placeholderData: keepPreviousData,
    retry: 1,
  });

  const opportunities = data?.opportunities ?? [];
  const total = data?.total ?? opportunities.length;
  const initialLoad = isPending && !data;

  if (initialLoad) {
    return (
      <section className="mb-4">
        <SkeletonTable rows={4} />
      </section>
    );
  }

  if (isError && opportunities.length === 0) {
    return (
      <section className="mb-4">
        <div className="error-banner">
          <p>{error instanceof Error ? error.message : 'PMXT unavailable'}</p>
        </div>
      </section>
    );
  }

  return (
    <motion.section
      className="mb-4"
      initial={reduced ? false : fadeUp.initial}
      animate={fadeUp.animate}
      transition={{ duration: reduced ? 0 : DUR.slow, ease: EASE_OUT, delay: reduced ? 0 : 0.08 }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div>
          <h2 className="page-title text-base">PMXT arbitrage</h2>
          <p className="page-desc">Live cross-venue spreads via PMXT</p>
        </div>
        <div className="flex items-center gap-3">
          {isFetching && opportunities.length > 0 && (
            <span className="text-[10px]" style={{ color: 'var(--text-3)' }}>Updating…</span>
          )}
          {dataUpdatedAt ? <LiveRefreshNote lastFetch={dataUpdatedAt} label="Updated" /> : null}
        </div>
      </div>

      <StatStrip>
        <StatPill label="Showing" value={String(opportunities.length)} accent="mint" />
        <StatPill label="Total found" value={total.toLocaleString()} />
        <StatPill label="Best spread" value={opportunities[0] ? fmtCents(opportunities[0].net_profit) : '-'} />
      </StatStrip>

      {opportunities.length === 0 ? (
        <div className="empty surface mt-3">
          <span className="empty-title">No opportunities right now</span>
          <span className="empty-hint">Auto-refreshes every 30s</span>
        </div>
      ) : (
        <TableShell>
          <table className="data-table screener-table">
            <thead>
              <tr>
                <th>Market A</th>
                <th>Market B</th>
                <th className="text-right">Spread</th>
                <th className="text-right">Net profit</th>
                <th>Venues</th>
              </tr>
            </thead>
            <tbody>
              {opportunities.map((opp) => (
                <tr key={`${opp.market_a.platform}-${opp.market_a.title}-${opp.market_b.platform}-${opp.market_b.title}`}>
                  <td className="col-market">
                    <MarketCell side={opp.market_a} />
                  </td>
                  <td className="col-market">
                    <MarketCell side={opp.market_b} />
                  </td>
                  <td className="text-right font-mono tabular-nums">{fmtCents(opp.spread)}</td>
                  <td
                    className="text-right font-mono tabular-nums font-medium"
                    style={{ color: opp.net_profit >= 0.02 ? 'var(--mint)' : 'var(--text)' }}
                  >
                    {fmtCents(opp.net_profit)}
                  </td>
                  <td className="text-[11px] whitespace-nowrap">
                    <a
                      href={venueHref(opp.market_a)}
                      target="_blank"
                      rel="noreferrer"
                      className="hover:underline"
                      style={{ color: 'var(--text-2)' }}
                    >
                      {fmtPlatform(opp.market_a.platform)}
                    </a>
                    {' ↔ '}
                    <a
                      href={venueHref(opp.market_b)}
                      target="_blank"
                      rel="noreferrer"
                      className="hover:underline"
                      style={{ color: 'var(--text-2)' }}
                    >
                      {fmtPlatform(opp.market_b.platform)}
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableShell>
      )}
    </motion.section>
  );
}
