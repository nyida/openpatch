'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchJson } from '@/lib/whale/fetch';
import type { PmxtArbitrageOpportunity, PmxtArbitrageResult } from '@/lib/api/pmxt-scanner';
import { TableShell, SkeletonTable } from '@/components/whale/Shell';
import { LiveRefreshNote } from '@/components/whale/LiveRefreshNote';

const REFETCH_MS = 30_000;

function fmtCents(n: number) {
  return `${(n * 100).toFixed(1)}¢`;
}

function fmtPlatform(p: string) {
  return p.charAt(0).toUpperCase() + p.slice(1);
}

function MarketCell({ side }: { side: PmxtArbitrageOpportunity['market_a'] }) {
  return (
    <div className="min-w-0">
      <div className="market-title leading-snug">{side.title}</div>
      <div className="text-[10px] mt-0.5" style={{ color: 'var(--text-3)' }}>
        {fmtPlatform(side.platform)} · YES {fmtCents(side.yes_price)} / NO {fmtCents(side.no_price)}
      </div>
    </div>
  );
}

export function ArbitrageScanner() {
  const { data, isLoading, isError, error, dataUpdatedAt, isFetching } = useQuery({
    queryKey: ['pmxt-arbitrage'],
    queryFn: () => fetchJson<PmxtArbitrageResult>('/api/arbitrage-pmxt'),
    refetchInterval: REFETCH_MS,
    staleTime: 25_000,
    retry: 2,
  });

  const opportunities = data?.opportunities ?? [];

  return (
    <section className="mb-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div>
          <h2 className="page-title text-base">PMXT arbitrage</h2>
          <p className="page-desc">Cross-venue opportunities from PMXT · refreshes every 30s</p>
        </div>
        {dataUpdatedAt ? <LiveRefreshNote lastFetch={dataUpdatedAt} label="Updated" /> : null}
      </div>

      {isLoading && opportunities.length === 0 ? (
        <SkeletonTable rows={6} />
      ) : isError ? (
        <div className="error-banner">
          <p>{error instanceof Error ? error.message : 'Failed to load PMXT arbitrage data'}</p>
          <p className="mt-1 opacity-80 text-[11px]">Check PMXT_API_KEY in .env.local and restart the dev server.</p>
        </div>
      ) : opportunities.length === 0 ? (
        <div className="empty surface">
          <span className="empty-title">No PMXT opportunities right now</span>
          <span className="empty-hint">{isFetching ? 'Scanning…' : 'Check back in ~30s'}</span>
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
                <th>Platforms</th>
              </tr>
            </thead>
            <tbody>
              {opportunities.map((opp, i) => (
                <tr key={`${opp.market_a.title}-${opp.market_b.title}-${i}`}>
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
                  <td className="text-[11px]" style={{ color: 'var(--text-3)' }}>
                    {fmtPlatform(opp.market_a.platform)} ↔ {fmtPlatform(opp.market_b.platform)}
                    {opp.opportunity_type && (
                      <span className="block text-[10px] mt-0.5 uppercase">{opp.opportunity_type.replace(/_/g, ' ')}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableShell>
      )}
    </section>
  );
}
