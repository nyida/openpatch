'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { ExternalLink, Share2 } from 'lucide-react';
import { SpreadSparkline } from '@/components/whale/SpreadSparkline';
import { ContractCell } from '@/components/whale/PlatformTag';
import { RiskBadge } from '@/components/whale/RiskBadge';
import { KellyCalculator } from '@/components/whale/KellyCalculator';
import { CorrelationPanel } from '@/components/whale/CorrelationPanel';
import { AlertButton } from '@/components/whale/AlertButton';
import {
  Shell,
  PageHeader,
  StatStrip,
  StatPill,
  TableShell,
  SkeletonList,
} from '@/components/whale/Shell';
import { authFetch } from '@/lib/auth/client';
import { decodeMarketId, resolveMarketIdentity } from '@/lib/whale/marketRoutes';
import { traderProfilePath } from '@/lib/whale/traderRoutes';
import { platformExternalUrl } from '@/lib/whale/marketUrls';
import { useArbitrageMap } from '@/lib/whale/hooks';
import { lookupSpread } from '@/services/arbitrage.utils';
import { formatNetROI } from '@/utils/arbMath';
import { scoreMarketRisk } from '@/lib/analytics/riskRating';
import { findRelatedMarkets } from '@/lib/analytics/correlation';
import { fmtUsd, platformShort, shortWallet } from '@/lib/whale/utils';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import type { ScreenerRow } from '@/lib/whale/screener';

type Position = {
  wallet: string;
  display_name: string;
  outcome: string;
  shares: number;
  avg_price: number;
  current_price: number;
  usd_value: number;
  platform: string;
  unrealized_pnl: number;
};

type LiveTrade = {
  market_title: string;
  outcome: string;
  side: string;
  usd_value: number;
  timestamp: number;
  platform: string;
};

function fmtPct(n: number) {
  return `${(n * 100).toFixed(1)}%`;
}

export function MarketDetailView() {
  const params = useParams();
  const sp = useSearchParams();
  const marketId = typeof params?.['market-id'] === 'string' ? params['market-id'] : '';

  const decoded = useMemo(() => {
    const fromQuery = resolveMarketIdentity('', {
      title: sp.get('title'),
      platform: sp.get('platform'),
      venue: sp.get('venue'),
    });
    if (fromQuery) return fromQuery;
    if (marketId) return decodeMarketId(marketId);
    return null;
  }, [marketId, sp]);

  const [positions, setPositions] = useState<Position[]>([]);
  const [recentTrades, setRecentTrades] = useState<LiveTrade[]>([]);
  const [positionsLoading, setPositionsLoading] = useState(true);
  const [screenerRow, setScreenerRow] = useState<ScreenerRow | null>(null);
  const [catalog, setCatalog] = useState<ScreenerRow[]>([]);
  const [shareId, setShareId] = useState<string | null>(null);
  const createWorkspace = useWorkspaceStore((s) => s.createWorkspace);
  const addMarket = useWorkspaceStore((s) => s.addMarketToWorkspace);

  const title = decoded?.title ?? '';
  const venue = decoded?.platform ?? 'polymarket';
  const priceParam = sp.get('price');
  const volumeParam = sp.get('volume');
  const eventParam = sp.get('event');
  const event = eventParam ?? screenerRow?.event_title ?? null;

  const price =
    priceParam != null && priceParam !== ''
      ? parseFloat(priceParam)
      : (screenerRow?.probability ?? 0.5);
  const volume =
    volumeParam != null && volumeParam !== ''
      ? parseFloat(volumeParam)
      : (screenerRow?.volume ?? screenerRow?.volume_24h ?? 0);

  const { data: arbData } = useArbitrageMap();
  const spread = lookupSpread(arbData?.byPolyTitle ?? {}, title);
  const externalUrl =
    screenerRow?.external_url ?? spread?.poly_url ?? platformExternalUrl(venue, { title });

  const whaleExposure = useMemo(
    () => positions.reduce((sum, p) => sum + p.usd_value, 0),
    [positions],
  );

  const risk = useMemo(
    () =>
      scoreMarketRisk({
        volume,
        volume_24h: screenerRow?.volume_24h ?? undefined,
        probability: price,
        days_to_resolution: screenerRow?.days_to_resolution ?? undefined,
        change_1d: screenerRow?.change_1d ?? undefined,
        whale_count: positions.length,
      }),
    [volume, screenerRow, price, positions.length],
  );

  const related = useMemo(
    () =>
      findRelatedMarkets(
        { title, platform: venue, probability: price, event_title: event },
        catalog.map((r) => ({
          title: r.market_title,
          platform: r.platform,
          probability: r.probability,
          event_title: r.event_title,
        })),
      ),
    [title, venue, price, event, catalog],
  );

  useEffect(() => {
    if (!decoded) {
      setPositionsLoading(false);
      return;
    }
    setPositionsLoading(true);
    authFetch(
      `/api/market_traders?market=${encodeURIComponent(decoded.title)}&platform=${encodeURIComponent(decoded.platform)}`,
    )
      .then((r) => r.json())
      .then((data) => setPositions(Array.isArray(data) ? data : []))
      .catch(() => setPositions([]))
      .finally(() => setPositionsLoading(false));

    authFetch(`/api/live_whales?min_size=100&platform=${decoded.platform}&limit=200`)
      .then((r) => r.json())
      .then((data) => {
        const trades = (data.trades ?? []) as LiveTrade[];
        const key = decoded.title.toLowerCase();
        setRecentTrades(
          trades.filter((t) => t.market_title.toLowerCase().includes(key) || key.includes(t.market_title.toLowerCase())).slice(0, 15),
        );
      })
      .catch(() => setRecentTrades([]));
  }, [decoded]);

  useEffect(() => {
    if (!decoded) return;
    const params = new URLSearchParams({
      platform: decoded.platform,
      search: decoded.title,
      prob: 'all',
      volume_min: '0',
      limit: '40',
      offset: '0',
    });
    authFetch(`/api/market_screener?${params}`)
      .then((r) => r.json())
      .then((data) => {
        const rows = (data.rows ?? []) as ScreenerRow[];
        setCatalog(rows);
        const key = decoded.title.toLowerCase();
        const exact =
          rows.find((r) => r.market_title === decoded.title) ??
          rows.find((r) => r.market_title.replace(/\s*\[(YES|NO)\]\s*$/i, '').trim() === decoded.title) ??
          rows.find((r) => {
            const rt = r.market_title.toLowerCase();
            return rt === key || rt.includes(key) || key.includes(rt);
          }) ??
          rows[0] ??
          null;
        setScreenerRow(exact);
      })
      .catch(() => {
        setScreenerRow(null);
        setCatalog([]);
      });
  }, [decoded]);

  function handleShare() {
    if (!decoded) return;
    const id = shareId ?? createWorkspace(`Analysis: ${title.slice(0, 40)}`, [{ title, platform: venue }]);
    if (!shareId) setShareId(id);
    else addMarket(id, { title, platform: venue });
    const url = `${window.location.origin}/workspace/${id}`;
    void navigator.clipboard?.writeText(url);
  }

  if (!decoded) {
    return (
      <Shell>
        <div className="empty surface">
          <span className="empty-title">Market not found</span>
          <span className="empty-hint">Invalid or expired market link</span>
          <Link href="/screener" className="btn btn-ghost text-xs mt-3 inline-block">
            Browse screener
          </Link>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <PageHeader
        title={title}
        description={event && event !== title ? event : 'Cross-venue contract detail'}
        action={
          <div className="flex gap-2 flex-wrap justify-end items-center">
            <RiskBadge grade={risk.grade} label={risk.label} title={risk.factors.join(' · ')} />
            <AlertButton type="price" label={`Price alert: ${title.slice(0, 40)}`} marketTitle={title} threshold={price} />
            <button type="button" className="btn btn-ghost text-xs" onClick={handleShare} title="Share workspace link">
              <Share2 className="w-3 h-3 inline mr-1" />
              Share
            </button>
            <a href={externalUrl} target="_blank" rel="noreferrer" className="btn btn-primary text-xs">
              Open on {platformShort(venue)} <ExternalLink className="w-3 h-3 ml-1 inline" />
            </a>
          </div>
        }
      />

      <div className="mb-4">
        <ContractCell title={title} platform={venue} />
      </div>

      <StatStrip>
        <StatPill label="Venue" value={platformShort(venue)} />
        <StatPill label="Price" value={fmtPct(price)} accent="mint" />
        <StatPill label="Volume" value={fmtUsd(volume)} />
        <StatPill label="Whale exposure" value={fmtUsd(whaleExposure)} />
        <StatPill label="Whales" value={String(positions.length)} />
        <StatPill label="Risk" value={risk.grade} />
        {spread && (
          <StatPill label="Net profit" value={formatNetROI(spread.roi)} accent={spread.roi.tier === 'green' ? 'mint' : undefined} />
        )}
      </StatStrip>

      {screenerRow && (
        <div className="surface p-4 mb-4">
          <p className="text-[10px] uppercase mb-2" style={{ color: 'var(--text-3)' }}>24h range · resolution</p>
          <div className="flex flex-wrap gap-4 text-sm font-mono tabular-nums">
            <span>O {screenerRow.price_open != null ? fmtPct(screenerRow.price_open) : '-'}</span>
            <span>H {screenerRow.price_high != null ? fmtPct(screenerRow.price_high) : '-'}</span>
            <span>L {screenerRow.price_low != null ? fmtPct(screenerRow.price_low) : '-'}</span>
            <span style={{ color: 'var(--text-3)' }}>
              Δ {screenerRow.change_1d != null ? `${screenerRow.change_1d >= 0 ? '+' : ''}${(screenerRow.change_1d * 100).toFixed(1)} pp` : '-'}
            </span>
            {screenerRow.days_to_resolution != null && (
              <span style={{ color: 'var(--text-3)' }}>{screenerRow.days_to_resolution}d to resolve</span>
            )}
          </div>
        </div>
      )}

      {spread && (
        <div className="surface p-4 mb-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] uppercase" style={{ color: 'var(--text-3)' }}>Cross-venue spread</p>
            <AlertButton type="arb" label={`Arb: ${title.slice(0, 30)}`} marketTitle={title} spreadId={spread.id} threshold={spread.net_profit_cents} />
          </div>
          <div className="h-24 flex items-center justify-center">
            <SpreadSparkline contractId={spread.id} title={title} polyTitle={spread.poly_title} kalshiTitle={spread.kalshi_title} netCents={spread.net_profit_cents} />
          </div>
          <p className="text-[10px] mt-2" style={{ color: 'var(--text-3)' }}>
            Matched: {spread.kalshi_title} · Poly {(spread.poly_price * 100).toFixed(1)}¢ vs Kalshi {(spread.kalshi_price * 100).toFixed(1)}¢
          </p>
        </div>
      )}

      <CorrelationPanel links={related} />

      <KellyCalculator defaultMarketOdds={price} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4 mt-4">
        <div className="surface p-4">
          <p className="text-[10px] uppercase mb-3" style={{ color: 'var(--text-3)' }}>Whale positions</p>
          {positionsLoading ? (
            <SkeletonList n={4} />
          ) : positions.length === 0 ? (
            <p className="text-xs py-2" style={{ color: 'var(--text-3)' }}>
              {venue === 'kalshi' ? 'Whale DB tracks Polymarket wallets - Kalshi tape is in Live feed.' : 'No whale holdings on this contract.'}
            </p>
          ) : (
            <TableShell>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Trader</th>
                    <th>Outcome</th>
                    <th className="text-right">USD</th>
                    <th className="text-right">P&amp;L</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {positions.map((p) => (
                    <tr key={`${p.wallet}-${p.outcome}`}>
                      <td className="font-medium">{p.display_name || shortWallet(p.wallet)}</td>
                      <td style={{ color: 'var(--text-2)' }}>{p.outcome}</td>
                      <td className="text-right font-mono tabular-nums">{fmtUsd(p.usd_value)}</td>
                      <td className="text-right font-mono tabular-nums" style={{ color: p.unrealized_pnl >= 0 ? 'var(--mint)' : 'var(--rose)' }}>
                        {fmtUsd(p.unrealized_pnl)}
                      </td>
                      <td className="text-right">
                        <Link href={traderProfilePath(p.wallet)} className="btn btn-ghost text-xs">Profile</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableShell>
          )}
        </div>

        <div className="surface p-4">
          <p className="text-[10px] uppercase mb-3" style={{ color: 'var(--text-3)' }}>Recent large trades</p>
          {recentTrades.length === 0 ? (
            <p className="text-xs py-2" style={{ color: 'var(--text-3)' }}>No recent large fills for this contract.</p>
          ) : (
            <div className="space-y-1.5 max-h-80 overflow-y-auto scrollable-y">
              {recentTrades.map((t, i) => (
                <div key={`${t.timestamp}-${i}`} className="flex justify-between gap-2 text-[11px] py-1 border-b" style={{ borderColor: 'var(--line)' }}>
                  <span style={{ color: t.outcome === 'YES' ? 'var(--mint)' : 'var(--rose)' }}>{t.side} {t.outcome}</span>
                  <span className="font-mono tabular-nums">{fmtUsd(t.usd_value)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Shell>
  );
}

export function MarketDetailFallback() {
  return (
    <Shell>
      <SkeletonList n={6} />
    </Shell>
  );
}
