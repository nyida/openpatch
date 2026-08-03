'use client';

import { Fragment, memo, useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ExternalLink } from 'lucide-react';
import { DualBar, edgeFromPct } from '@/components/whale/SentimentCompare';
import { ContractCell } from '@/components/whale/PlatformTag';
import { NetROIBadge } from '@/components/whale/NetROIBadge';
import { SpreadSparkline } from '@/components/whale/SpreadSparkline';
import { inferMarketCategory } from '@/lib/whale/categories';
import { marketDetailPath } from '@/lib/whale/marketRoutes';
import { traderProfilePath } from '@/lib/whale/traderRoutes';
import { platformExternalUrl } from '@/lib/whale/marketUrls';
import type { ArbitrageSpread } from '@/services/types';
import { fmtUsd, isPastMarket, shortWallet } from '@/lib/whale/utils';
import { authFetch } from '@/lib/auth/client';

export type DashboardMarket = {
  name: string;
  trader_count: number;
  total_usd: number;
  market_price: number;
  whale_sentiment: string;
  bias: string;
  platform: string;
  external_url: string;
};

type Position = {
  wallet: string;
  outcome: string;
  shares: number;
  avg_price: number;
  current_price: number;
  usd_value: number;
};

function parseYesPct(sentiment: string) {
  const m = sentiment.match(/(\d+\.?\d*)%/);
  return m ? parseFloat(m[1]) : 50;
}

function biasCls(bias: string) {
  if (bias === 'Bullish') return 'bull';
  if (bias === 'Bearish') return 'bear';
  return 'neutral';
}

export const MarketRow = memo(function MarketRow({
  market,
  rank,
  spread,
}: {
  market: DashboardMarket;
  rank: number;
  spread?: ArbitrageSpread | null;
}) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<Position[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const yesPct = parseYesPct(market.whale_sentiment);
  const marketPct = Math.round(market.market_price * 1000) / 10;
  const edge = edgeFromPct(marketPct, yesPct);
  const category = inferMarketCategory(market.name);
  const past = isPastMarket(market.name);
  const cleanName = market.name.replace(/\s*\[(YES|NO)\]\s*$/i, '');
  const venueHref = platformExternalUrl(market.platform, { title: cleanName });
  const href = past
    ? platformExternalUrl(market.platform, { title: market.name })
    : venueHref;

  const detailHref = marketDetailPath(cleanName, market.platform, {
    price: market.market_price,
  });

  function handleRowClick(e: React.MouseEvent) {
    const target = e.target as HTMLElement;
    if (target.closest('a, button, [data-no-row-nav]')) return;
    window.location.assign(detailHref);
  }

  async function toggle(e: React.MouseEvent) {
    e.stopPropagation();
    if (open) {
      setOpen(false);
      return;
    }
    if (data) {
      setOpen(true);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch(
        `/api/market_traders?market=${encodeURIComponent(cleanName)}&platform=${encodeURIComponent(market.platform)}`,
      );
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error ?? 'Failed');
      setData(json);
      setOpen(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
      setOpen(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Fragment>
      <tr className="row-main" data-open={open} onClick={handleRowClick}>
        <td className="col-rank font-mono tabular-nums">{rank}</td>
        <td className="col-market">
          <ContractCell
            title={market.name}
            platform={market.platform}
            href={detailHref}
          />
        </td>
        <td className="col-cat">
          <span className="cat-tag">{category}</span>
        </td>
        <td className="col-bias">
          <span className={`bias-tag ${biasCls(market.bias)}`}>{market.bias}</span>
        </td>
        <td className="col-bar">
          <DualBar yesPct={marketPct} />
        </td>
        <td className="col-bar">
          <DualBar yesPct={yesPct} />
        </td>
        <td className="col-edge">
          <span className={`edge-tag ${edge.cls}`}>{edge.label}</span>
        </td>
        <td className="col-arb">
          <NetROIBadge spread={spread} />
        </td>
        <td className="col-spark">
          <SpreadSparkline
            contractId={spread?.id}
            title={cleanName}
            polyTitle={spread?.poly_title}
            kalshiTitle={spread?.kalshi_title}
            netCents={spread?.net_profit_cents}
          />
        </td>
        <td className="col-num font-mono tabular-nums">{fmtUsd(market.total_usd)}</td>
        <td className="col-num font-mono tabular-nums">{market.trader_count}</td>
        <td className="col-act" onClick={(e) => e.stopPropagation()}>
          <div className="row-actions">
            {href && (
              <a href={href} target="_blank" rel="noreferrer" className="icon-btn" aria-label="Open market">
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
            <button type="button" className="icon-btn" disabled={loading} aria-expanded={open} onClick={toggle}>
              <ChevronDown className={`w-3.5 h-3.5 chevron ${open ? 'open' : ''}`} />
            </button>
          </div>
        </td>
      </tr>

      <tr className="row-expand">
        <td colSpan={12} className="!p-0 !border-0">
          <AnimatePresence initial={false}>
            {open && (
              <motion.div
                key="panel"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
                className="expand-panel"
                style={{ overflow: 'hidden' }}
              >
                <div className="expand-inner">
                  {loading && <div className="shimmer h-7 w-full" />}
                  {error && <p className="text-xs py-2" style={{ color: 'var(--rose)' }}>{error}</p>}
                  {!loading && data?.length === 0 && (
                    <p className="text-xs py-2">No constituent positions.</p>
                  )}
                  {!loading && data && data.length > 0 && (
                    <table className="data-table dense nested-table">
                      <colgroup>
                        <col className="col-wallet" />
                        <col className="col-outcome" />
                        <col className="col-notional" />
                        <col className="col-pnl" />
                      </colgroup>
                      <thead>
                        <tr>
                          <th className="col-wallet">Wallet</th>
                          <th className="col-outcome">Outcome</th>
                          <th className="col-notional">Notional</th>
                          <th className="col-pnl">Unrealized</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.map((p) => {
                          const pnl = p.shares * (p.current_price - p.avg_price);
                          return (
                            <tr key={`${p.wallet}-${p.outcome}`}>
                              <td className="col-wallet">
                                <Link
                                  href={traderProfilePath(p.wallet)}
                                  className="font-mono text-[11px] hover:underline"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {shortWallet(p.wallet)}
                                </Link>
                              </td>
                              <td className="col-outcome" style={{ color: p.outcome.toLowerCase().includes('yes') ? 'var(--mint)' : 'var(--rose)' }}>
                                {p.outcome}
                              </td>
                              <td className="col-notional font-mono tabular-nums">{fmtUsd(p.usd_value)}</td>
                              <td
                                className="col-pnl font-mono tabular-nums"
                                style={{ color: pnl >= 0 ? 'var(--mint)' : 'var(--rose)' }}
                              >
                                {fmtUsd(pnl)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </td>
      </tr>
    </Fragment>
  );
});
