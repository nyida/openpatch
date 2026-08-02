'use client';

import { useState } from 'react';
import { NetROIBadge } from '@/components/whale/NetROIBadge';
import { SpreadSparkline } from '@/components/whale/SpreadSparkline';
import { ArbAlertsBar } from '@/components/whale/ArbAlertsBar';
import { AlertButton } from '@/components/whale/AlertButton';
import {
  Shell,
  PageHeader,
  TableShell,
  SkeletonTable,
  FadeSwap,
  StatStrip,
  StatPill,
  Pager,
  Toolbar,
} from '@/components/whale/Shell';
import { DataSourcesBanner } from '@/components/whale/DataSourcesBanner';
import { LiveRefreshNote } from '@/components/whale/LiveRefreshNote';
import { useArbitrageMap } from '@/lib/whale/hooks';
import { marketDetailPath } from '@/lib/whale/marketRoutes';
import { platformExternalUrl, resolveExternalUrl } from '@/lib/whale/marketUrls';
import { fmtRelativeTime } from '@/lib/whale/utils';

const PAGE_SIZE = 40;
const MIN_SPREAD = 0.02;

export default function ArbScannerPage() {
  const [page, setPage] = useState(1);
  const [minProfitCents, setMinProfitCents] = useState(2);
  const { data, isLoading, isError, dataUpdatedAt } = useArbitrageMap(MIN_SPREAD);
  const pairs = (data?.pairs ?? [])
    .filter((p) => Math.abs(p.spread) >= MIN_SPREAD && p.net_profit_cents >= minProfitCents)
    .sort((a, b) => b.net_profit_cents - a.net_profit_cents);

  const profitable = pairs.filter((p) => p.roi.tier === 'green').length;
  const marginal = pairs.filter((p) => p.roi.tier === 'yellow').length;
  const totalPages = Math.max(1, Math.ceil(pairs.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = pairs.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <Shell>
      <PageHeader
        title="Arbitrage scanner"
        description="Cross-venue gaps ≥ 2¢ between Polymarket & Kalshi - sorted by net profit after fees."
        action={dataUpdatedAt ? <LiveRefreshNote lastFetch={dataUpdatedAt} label="Scanned" /> : null}
      />

      <DataSourcesBanner />

      <StatStrip>
        <StatPill label="Opportunities" value={pairs.length.toLocaleString()} accent="mint" />
        <StatPill label="Profitable (>1¢)" value={String(profitable)} />
        <StatPill label="Marginal (0–1¢)" value={String(marginal)} />
        <StatPill label="Min spread" value="2¢" />
      </StatStrip>

      <ArbAlertsBar pairs={pairs} />

      <Toolbar>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span style={{ color: 'var(--text-3)' }}>Min net profit</span>
          {[1, 2, 5, 10].map((c) => (
            <button
              key={c}
              type="button"
              className="btn btn-ghost !py-1 !px-2"
              data-active={minProfitCents === c}
              onClick={() => { setMinProfitCents(c); setPage(1); }}
            >
              {c}¢+
            </button>
          ))}
        </div>
      </Toolbar>

      {isError && (
        <div className="error-banner">
          <p>Failed to load arbitrage data. Retrying…</p>
        </div>
      )}

      {isLoading && pairs.length === 0 ? (
        <SkeletonTable rows={12} />
      ) : (
        <FadeSwap viewKey={`arbs-${pairs.length}-${safePage}-${dataUpdatedAt}`}>
          <TableShell
            footer={
              pairs.length > PAGE_SIZE ? (
                <Pager
                  page={safePage}
                  totalPages={totalPages}
                  total={pairs.length}
                  pageSize={PAGE_SIZE}
                  onChange={setPage}
                />
              ) : undefined
            }
          >
            <table className="data-table screener-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Matched markets</th>
                  <th className="text-right">Poly</th>
                  <th className="text-right">Kalshi</th>
                  <th className="text-right">Net profit</th>
                  <th className="text-center">Trend</th>
                  <th className="text-right">Last seen</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {pairs.length === 0 && (
                  <tr>
                    <td colSpan={8}>
                      <div className="empty">
                        <span className="empty-title">No arbs above 2¢ right now</span>
                        <span className="empty-hint">Refreshes every ~30s</span>
                      </div>
                    </td>
                  </tr>
                )}
                {pageItems.map((spread, i) => (
                  <tr key={spread.id}>
                    <td className="font-mono tabular-nums" style={{ color: 'var(--text-3)' }}>
                      {(safePage - 1) * PAGE_SIZE + i + 1}
                    </td>
                    <td className="col-market">
                      <a
                        href={marketDetailPath(spread.poly_title, 'polymarket', {
                          price: spread.poly_price,
                        })}
                        className="block hover:underline"
                      >
                        <div className="market-title leading-snug">{spread.poly_title}</div>
                        <div className="text-[10px] mt-0.5" style={{ color: 'var(--text-3)' }}>
                          ↔ {spread.kalshi_title}
                        </div>
                      </a>
                    </td>
                    <td className="text-right font-mono tabular-nums">{(spread.poly_price * 100).toFixed(1)}%</td>
                    <td className="text-right font-mono tabular-nums">{(spread.kalshi_price * 100).toFixed(1)}%</td>
                    <td className="text-right">
                      <NetROIBadge spread={spread} />
                    </td>
                    <td className="text-center">
                      <SpreadSparkline
                        contractId={spread.id}
                        title={spread.poly_title}
                        polyTitle={spread.poly_title}
                        kalshiTitle={spread.kalshi_title}
                        netCents={spread.net_profit_cents}
                      />
                    </td>
                    <td className="text-right font-mono tabular-nums text-[10px]" style={{ color: 'var(--text-3)' }}>
                      {fmtRelativeTime(Math.floor(spread.last_seen_at / 1000))}
                    </td>
                    <td className="text-right whitespace-nowrap">
                      <AlertButton
                        type="arb"
                        label={`Arb ${spread.net_profit_cents.toFixed(1)}¢: ${spread.poly_title.slice(0, 24)}`}
                        marketTitle={spread.poly_title}
                        spreadId={spread.id}
                        threshold={spread.net_profit_cents}
                      />
                      <a
                        href={spread.poly_url || platformExternalUrl('polymarket', { title: spread.poly_title })}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-ghost text-[10px] !py-0.5"
                      >
                        Poly
                      </a>
                      <a
                        href={resolveExternalUrl('kalshi', spread.kalshi_title, spread.kalshi_url)}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-ghost text-[10px] !py-0.5"
                      >
                        Kalshi
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableShell>
        </FadeSwap>
      )}

      <p className="text-[10px] mt-4 text-center" style={{ color: 'var(--text-3)' }}>
        Net profit = gross spread − 1.5% Kalshi fee − 1% Poly fee − $0.75 gas
      </p>
    </Shell>
  );
}
