'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { X } from 'lucide-react';
import { useAppStore, type PaperPosition } from '@/context/AppStore';
import { useArbitrageMap } from '@/lib/whale/hooks';
import { usePriceStore } from '@/stores/priceStore';
import { fmtUsd } from '@/lib/whale/utils';

function positionPnl(p: PaperPosition, currentPrice: number) {
  const shares = p.size_usd / p.entry_price;
  if (p.closed_at && p.exit_price != null) {
    return shares * p.exit_price - p.size_usd;
  }
  return shares * currentPrice - p.size_usd;
}

export function PaperPortfolio({ onClose, inline }: { onClose?: () => void; inline?: boolean }) {
  const { portfolio, resetPortfolio, unrealizedPnl, closePaperPosition } = useAppStore();
  const { data: arbData } = useArbitrageMap();
  const livePrices = usePriceStore((s) => s.prices);

  function currentPrice(p: PaperPosition): number {
    if (p.closed_at && p.exit_price != null) return p.exit_price;
    for (const spread of arbData?.pairs ?? []) {
      if (spread.poly_title === p.market_title || spread.kalshi_title === p.market_title) {
        const live = livePrices[spread.id];
        if (p.venue === 'kalshi') return live?.kalshi ?? spread.kalshi_price;
        return live?.poly ?? spread.poly_price;
      }
    }
    return p.entry_price;
  }

  const priceMap = useMemo(() => {
    const m: Record<string, number> = {};
    for (const p of portfolio.positions) {
      if (!p.closed_at) m[p.market_title] = currentPrice(p);
    }
    return m;
  }, [portfolio.positions, arbData, livePrices]);

  const unrealized = unrealizedPnl(priceMap);
  const openPositions = portfolio.positions.filter((p) => !p.closed_at);

  const totalValue = portfolio.cash + openPositions.reduce((s, p) => s + p.size_usd, 0) + unrealized;

  const content = (
    <>
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>Paper trading</p>
            <h2 className="text-sm font-medium mt-0.5">Virtual portfolio</h2>
          </div>
          {onClose && (
            <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <div className="stat-pill">
            <span className="label">Cash</span>
            <span className="font-mono">{fmtUsd(portfolio.cash)}</span>
          </div>
          <div className="stat-pill">
            <span className="label">Unrealized</span>
            <span className="font-mono" style={{ color: unrealized >= 0 ? 'var(--mint)' : 'var(--rose)' }}>
              {fmtUsd(unrealized)}
            </span>
          </div>
          <div className="stat-pill">
            <span className="label">Open</span>
            <span>{openPositions.length}</span>
          </div>
          <div className="stat-pill">
            <span className="label">Est. total</span>
            <span className="font-mono">{fmtUsd(totalValue)}</span>
          </div>
        </div>

        {portfolio.positions.length === 0 ? (
          <p className="text-xs opacity-50 py-8 text-center">
            No paper trades yet. Click the wallet icon on any market row to open a virtual position.
          </p>
        ) : (
          <div className="overflow-x-auto max-h-80">
            <table className="data-table dense w-full">
              <thead>
                <tr>
                  <th>Market</th>
                  <th>Side</th>
                  <th className="text-right">Entry</th>
                  <th className="text-right">Exit / Mark</th>
                  <th className="text-right">Qty</th>
                  <th className="text-right">Notional</th>
                  <th className="text-right">P&amp;L</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {portfolio.positions.map((p) => {
                  const shares = p.size_usd / p.entry_price;
                  const cur = currentPrice(p);
                  const pnl = positionPnl(p, cur);
                  return (
                    <tr key={p.id}>
                      <td className="max-w-[140px] truncate text-[11px]" title={p.market_title}>
                        {p.market_title}
                      </td>
                      <td className="text-[11px]">{p.side}</td>
                      <td className="text-right font-mono tabular-nums text-[11px]">
                        {(p.entry_price * 100).toFixed(1)}¢
                      </td>
                      <td className="text-right font-mono tabular-nums text-[11px]">
                        {p.closed_at
                          ? p.exit_price != null
                            ? `${(p.exit_price * 100).toFixed(1)}¢`
                            : '-'
                          : `${(cur * 100).toFixed(1)}¢`}
                      </td>
                      <td className="text-right font-mono tabular-nums text-[11px]">
                        {shares.toFixed(1)}
                      </td>
                      <td className="text-right font-mono tabular-nums text-[11px]">
                        {fmtUsd(p.size_usd)}
                      </td>
                      <td
                        className="text-right font-mono tabular-nums text-[11px]"
                        style={{ color: pnl >= 0 ? 'var(--mint)' : 'var(--rose)' }}
                      >
                        {pnl >= 0 ? '+' : ''}
                        {fmtUsd(pnl)}
                      </td>
                      <td className="text-[10px] uppercase" style={{ color: 'var(--text-3)' }}>
                        {p.closed_at ? 'Closed' : 'Open'}
                      </td>
                      <td className="text-right">
                        {!p.closed_at && (
                          <button
                            type="button"
                            className="btn btn-ghost text-[10px] !py-1"
                            onClick={() => closePaperPosition(p.id, cur)}
                          >
                            Close
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex justify-end gap-2 mt-4">
          <Link href="/tools/portfolio" className="btn btn-ghost text-xs">
            Full view
          </Link>
          <button type="button" className="btn btn-ghost text-xs" onClick={resetPortfolio}>
            Reset $10K
          </button>
          {onClose && (
            <button type="button" className="btn btn-primary text-xs" onClick={onClose}>
              Close
            </button>
          )}
        </div>
    </>
  );

  if (inline) {
    return <div className="spread-modal surface max-w-3xl w-full">{content}</div>;
  }

  return (
    <div className="paper-modal-backdrop" onClick={onClose} role="presentation">
      <div className="spread-modal surface max-w-3xl" onClick={(e) => e.stopPropagation()} role="dialog">
        {content}
      </div>
    </div>
  );
}
