'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ExternalLink, Copy, Check } from 'lucide-react';
import { ContractCell } from '@/components/whale/PlatformTag';
import { marketDetailPath } from '@/lib/whale/marketRoutes';
import { ProfilePnLChart } from '@/components/whale/profile/ProfilePnLChart';
import { ProfileSidebar } from '@/components/whale/profile/ProfileSidebar';
import type {
  ChartPoint,
  ProfileActivity,
  ProfileStats,
  ProfileTrade,
  ProfileTrader,
} from '@/components/whale/profile/types';
import { fetchJson } from '@/lib/whale/fetch';
import { usePoll } from '@/lib/whale/usePoll';
import {
  fmtPrice,
  fmtRelativeTime,
  fmtUsd,
  shortWallet,
} from '@/lib/whale/utils';
import {
  Shell,
  PageHeader,
  StatStrip,
  StatPill,
  TableShell,
  SkeletonTable,
} from '@/components/whale/Shell';

function maxDrawdown(chart: ChartPoint[]): number {
  let peak = 0;
  let maxDd = 1;
  for (const p of chart) {
    peak = Math.max(peak, p.cumulative_pnl);
    maxDd = Math.max(maxDd, peak - p.cumulative_pnl);
  }
  return Math.max(maxDd, 1);
}

function smartMoneyScore(stats: ProfileStats, chart: ChartPoint[]): number {
  const mdd = maxDrawdown(chart);
  return stats.win_rate * 0.4 + stats.alltime_profit / mdd;
}

function OutcomeSplit({ items }: { items: ProfileStats['outcome_split'] }) {
  if (!items.length) return null;
  const total = items.reduce((s, i) => s + i.total_usd, 0) || 1;
  return (
    <div className="profile-outcome-split">
      {items.map((item) => {
        const pct = Math.round((item.total_usd / total) * 1000) / 10;
        const isYes = item.outcome.toLowerCase().includes('yes');
        return (
          <div key={item.outcome} className="profile-outcome-row">
            <span style={{ color: isYes ? 'var(--mint)' : 'var(--rose)' }}>{item.outcome}</span>
            <span className="font-mono tabular-nums">{fmtUsd(item.total_usd)}</span>
            <span className="font-mono tabular-nums opacity-60">{pct}% · {item.count}</span>
          </div>
        );
      })}
    </div>
  );
}

function ProfileContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const walletParam = searchParams.get('wallet');

  const [traders, setTraders] = useState<ProfileTrader[]>([]);
  const [tradersLoading, setTradersLoading] = useState(true);
  const [selected, setSelected] = useState(walletParam ?? '');
  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [trades, setTrades] = useState<ProfileTrade[]>([]);
  const [activity, setActivity] = useState<ProfileActivity[]>([]);
  const [chart, setChart] = useState<ChartPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const loadTraders = useCallback(async () => {
    try {
      const data = await fetchJson<ProfileTrader[]>('/api/all_traders');
      setTraders(data);
      if (!walletParam && data[0]) {
        setSelected((prev) => prev || data[0].wallet);
      }
    } catch {
      setTraders([]);
    } finally {
      setTradersLoading(false);
    }
  }, [walletParam]);

  useEffect(() => {
    loadTraders();
  }, [loadTraders]);

  usePoll(loadTraders, 30000);

  const loadProfile = useCallback(
    async (wallet: string) => {
      if (!wallet) return;
      setLoading(true);
      setError(null);
      try {
        const [statsData, tradesData, activityData, chartData] = await Promise.all([
          fetchJson<ProfileStats>(`/api/trader_stats/${encodeURIComponent(wallet)}`),
          fetchJson<ProfileTrade[]>(`/api/trades/${encodeURIComponent(wallet)}?limit=50`),
          fetchJson<ProfileActivity[]>(`/api/activity/${encodeURIComponent(wallet)}?limit=25`),
          fetchJson<ChartPoint[]>(`/api/chart_data/${encodeURIComponent(wallet)}`),
        ]);
        setStats(statsData);
        setTrades(tradesData);
        setActivity(activityData);
        setChart(chartData);
        router.replace(`/profile?wallet=${encodeURIComponent(wallet)}`, { scroll: false });
      } catch (e) {
        setStats(null);
        setTrades([]);
        setActivity([]);
        setChart([]);
        setError(e instanceof Error ? e.message : 'Failed to load profile');
      } finally {
        setLoading(false);
      }
    },
    [router],
  );

  useEffect(() => {
    if (walletParam) setSelected(walletParam);
  }, [walletParam]);

  useEffect(() => {
    if (selected) loadProfile(selected);
  }, [selected, loadProfile]);

  const polyProfileUrl = useMemo(
    () => `https://polymarket.com/profile/${selected}`,
    [selected],
  );

  const score = useMemo(
    () => (stats && chart.length ? smartMoneyScore(stats, chart) : null),
    [stats, chart],
  );

  async function copyWallet() {
    if (!selected) return;
    try {
      await navigator.clipboard.writeText(selected);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }

  return (
    <Shell>
      <PageHeader
        title="Whale profile"
        description="Individual wallet analytics - positions, trade history, P&L, and on-chain activity on Polymarket."
      />

      <div className="profile-layout">
        <ProfileSidebar
          traders={traders}
          selected={selected}
          onSelect={setSelected}
          loading={tradersLoading}
        />

        <div className="profile-main space-y-4 min-w-0">
          {loading && (
            <div className="space-y-3">
              <div className="shimmer h-12 w-full rounded-lg" />
              <SkeletonTable rows={6} />
            </div>
          )}

          {error && !loading && (
            <div className="error-banner">
              <p>{error}</p>
            </div>
          )}

          {!loading && stats && (
            <>
              <div className="profile-header surface">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="font-sans text-xl font-bold tracking-tight">
                      {stats.display_name || shortWallet(selected)}
                    </h2>
                    <p className="font-mono text-[11px] mt-1 opacity-60">{selected}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button type="button" className="btn btn-ghost text-xs" onClick={copyWallet}>
                      {copied ? <Check className="w-3 h-3 mr-1 inline" /> : <Copy className="w-3 h-3 mr-1 inline" />}
                      {copied ? 'Copied' : 'Copytrade'}
                    </button>
                    <a
                      href={polyProfileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="btn btn-ghost text-xs"
                    >
                      Polymarket profile
                      <ExternalLink className="w-3 h-3 ml-1 inline" />
                    </a>
                  </div>
                </div>
              </div>

              <StatStrip>
                <StatPill label="All-time profit" value={fmtUsd(stats.alltime_profit)} accent="mint" />
                <StatPill label="Rank" value={`#${stats.rank}`} />
                <StatPill label="Win rate" value={`${Math.round(stats.win_rate * 100)}%`} />
                <StatPill
                  label="Smart money score"
                  value={score != null ? score.toFixed(2) : '-'}
                  accent="mint"
                />
                <StatPill label="Biggest win" value={fmtUsd(stats.biggest_win)} />
              </StatStrip>

              <StatStrip>
                <StatPill label="Open positions" value={String(stats.position_count)} />
                <StatPill label="Position value" value={fmtUsd(stats.total_position_value)} />
                <StatPill
                  label="Unrealized"
                  value={fmtUsd(stats.total_unrealized_pnl)}
                  accent={stats.total_unrealized_pnl >= 0 ? 'mint' : undefined}
                />
                <StatPill label="Realized" value={fmtUsd(stats.total_realized_pnl)} />
                <StatPill label="Trades" value={stats.trade_count.toLocaleString()} />
                <StatPill label="Volume" value={fmtUsd(stats.total_volume)} />
              </StatStrip>

              <div className="profile-grid-2">
                <div className="surface profile-panel">
                  <p className="profile-section-label">Cumulative P&amp;L</p>
                  <ProfilePnLChart data={chart} />
                </div>
                <div className="surface profile-panel">
                  <p className="profile-section-label">Exposure by outcome</p>
                  {stats.outcome_split.length > 0 ? (
                    <OutcomeSplit items={stats.outcome_split} />
                  ) : (
                    <p className="text-xs opacity-60 py-6 text-center">No open positions.</p>
                  )}
                </div>
              </div>

              <div className="surface profile-panel">
                <p className="profile-section-label">Open positions ({stats.position_count})</p>
                {stats.positions.length === 0 ? (
                  <p className="text-xs opacity-60 py-4 text-center">No open positions for this wallet.</p>
                ) : (
                  <TableShell>
                    <table className="data-table profile-table">
                      <thead>
                        <tr>
                          <th>Contract</th>
                          <th>Outcome</th>
                          <th className="text-right">Shares</th>
                          <th className="text-right">Avg</th>
                          <th className="text-right">Mark</th>
                          <th className="text-right">Notional</th>
                          <th className="text-right">Unrealized</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stats.positions.map((p) => (
                          <tr key={`${p.platform}-${p.market_title}-${p.outcome}`}>
                            <td className="col-market">
                              <ContractCell
                                title={p.market_title}
                                platform={p.platform}
                                href={marketDetailPath(p.market_title, p.platform, {
                                  price: p.current_price,
                                })}
                              />
                            </td>
                            <td style={{ color: p.outcome.toLowerCase().includes('yes') ? 'var(--mint)' : 'var(--rose)' }}>
                              {p.outcome}
                            </td>
                            <td className="text-right font-mono tabular-nums">{p.shares.toLocaleString()}</td>
                            <td className="text-right font-mono tabular-nums text-[11px]">{fmtPrice(p.avg_price)}</td>
                            <td className="text-right font-mono tabular-nums text-[11px]">{fmtPrice(p.current_price)}</td>
                            <td className="text-right font-mono tabular-nums">{fmtUsd(p.usd_value)}</td>
                            <td
                              className="text-right font-mono tabular-nums font-medium"
                              style={{ color: p.unrealized_pnl >= 0 ? 'var(--mint)' : 'var(--rose)' }}
                            >
                              {fmtUsd(p.unrealized_pnl)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </TableShell>
                )}
              </div>

              <div className="profile-grid-2">
                <div className="surface profile-panel">
                  <p className="profile-section-label">Recent trades ({trades.length})</p>
                  {trades.length === 0 ? (
                    <p className="text-xs opacity-60 py-4 text-center">No trades recorded.</p>
                  ) : (
                    <TableShell>
                      <table className="data-table profile-table dense">
                        <thead>
                          <tr>
                            <th>Time</th>
                            <th>Side</th>
                            <th>Market</th>
                            <th className="text-right">Size</th>
                          </tr>
                        </thead>
                        <tbody>
                          {trades.map((t, i) => (
                            <tr key={`${t.timestamp}-${i}`}>
                              <td className="font-mono text-[11px] whitespace-nowrap tabular-nums">
                                {fmtRelativeTime(t.timestamp)}
                              </td>
                              <td>
                                <span style={{ color: t.side === 'BUY' ? 'var(--mint)' : 'var(--rose)' }}>
                                  {t.side}
                                </span>
                              </td>
                              <td className="col-market">
                                <Link
                                  href={marketDetailPath(t.market_title, t.platform, {
                                    price: t.price,
                                  })}
                                  className="block hover:underline"
                                >
                                  <div className="leading-snug">{t.market_title}</div>
                                  <div className="text-[10px] opacity-50 mt-0.5">{t.outcome}</div>
                                </Link>
                              </td>
                              <td className="text-right font-mono tabular-nums">{fmtUsd(t.size * t.price)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </TableShell>
                  )}
                </div>

                <div className="surface profile-panel">
                  <p className="profile-section-label">Activity ({activity.length})</p>
                  {activity.length === 0 ? (
                    <p className="text-xs opacity-60 py-4 text-center">No redeem/merge activity.</p>
                  ) : (
                    <TableShell>
                      <table className="data-table profile-table dense">
                        <thead>
                          <tr>
                            <th>Time</th>
                            <th>Type</th>
                            <th>Market</th>
                            <th className="text-right">Size</th>
                          </tr>
                        </thead>
                        <tbody>
                          {activity.map((a, i) => (
                            <tr key={`${a.timestamp}-${i}`}>
                              <td className="font-mono text-[11px] whitespace-nowrap tabular-nums">
                                {fmtRelativeTime(a.timestamp)}
                              </td>
                              <td className="font-mono text-[10px] uppercase opacity-80">{a.event_type}</td>
                              <td className="col-market">
                                <Link
                                  href={marketDetailPath(a.market_title, 'polymarket')}
                                  className="hover:underline leading-snug"
                                >
                                  {a.market_title}
                                </Link>
                              </td>
                              <td className="text-right font-mono tabular-nums">{fmtUsd(a.size)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </TableShell>
                  )}
                </div>
              </div>

              <p className="text-[10px] opacity-40 text-center">
                Linked from{' '}
                <Link href="/traders" className="underline">
                  Traders
                </Link>{' '}
                leaderboard · Polymarket wallet data
              </p>
            </>
          )}
        </div>
      </div>
    </Shell>
  );
}

export default function ProfilePage() {
  return (
    <Suspense
      fallback={
        <Shell>
          <SkeletonTable rows={10} />
        </Shell>
      }
    >
      <ProfileContent />
    </Suspense>
  );
}
