'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { traderProfilePath } from '@/lib/whale/traderRoutes';
import { fmtUsd, shortWallet } from '@/lib/whale/utils';
import { usePoll } from '@/lib/whale/usePoll';
import { fetchJson } from '@/lib/whale/fetch';
import { smartMoneyScore, smartMoneyTier } from '@/lib/analytics/smartMoney';
import { FollowButton } from '@/components/whale/FollowButton';
import { DbStatusBanner } from '@/components/whale/DbStatusBanner';
import {
  Shell,
  PageHeader,
  SearchInput,
  Pager,
  StatStrip,
  StatPill,
  TableShell,
  SkeletonTable,
  Toolbar,
} from '@/components/whale/Shell';

const PAGE_SIZE = 40;
const POLL_MS = 30000;

type Trader = {
  wallet: string;
  display_name: string;
  alltime_profit: number;
  rank: number;
  trade_count?: number;
  win_rate?: number;
  position_count?: number;
};

export default function TradersPage() {
  const [traders, setTraders] = useState<Trader[]>([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await fetchJson<Trader[]>('/api/all_traders', undefined, { retries: 2 });
      setTraders(data);
      setError(null);
    } catch (e) {
      if (!silent) setTraders([]);
      setError(e instanceof Error ? e.message : 'Failed to load traders');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  usePoll(() => load(true), POLL_MS);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return traders;
    return traders.filter(
      (t) => t.display_name?.toLowerCase().includes(q) || t.wallet.toLowerCase().includes(q),
    );
  }, [traders, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  useEffect(() => setPage(1), [search]);

  const totalProfit = traders.reduce((s, t) => s + t.alltime_profit, 0);
  const avgWinRate =
    traders.length > 0
      ? traders.reduce((s, t) => s + (t.win_rate ?? 0), 0) / traders.length
      : 0;

  return (
    <Shell>
      <PageHeader title="Leaderboard" description="All-time profit by Polymarket whale wallets - smart money scores and follow list" />

      <DbStatusBanner error={error} onRetry={load} loading={loading} />

      <StatStrip>
        <StatPill label="Traders" value={loading ? '-' : traders.length.toLocaleString()} />
        <StatPill label="Top profit" value={loading ? '-' : fmtUsd(traders[0]?.alltime_profit ?? 0)} accent="mint" />
        <StatPill label="Combined P&amp;L" value={loading ? '-' : fmtUsd(totalProfit)} />
        <StatPill label="Avg win rate" value={loading ? '-' : `${avgWinRate.toFixed(1)}%`} />
      </StatStrip>

      <Toolbar>
        <SearchInput value={search} onChange={setSearch} placeholder="Search name or wallet…" />
      </Toolbar>

      {loading ? (
        <SkeletonTable rows={12} />
      ) : (
        <TableShell
          footer={
            filtered.length > PAGE_SIZE ? (
              <Pager page={safePage} totalPages={totalPages} total={filtered.length} pageSize={PAGE_SIZE} onChange={setPage} />
            ) : undefined
          }
        >
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Trader</th>
                <th className="text-right">Profit</th>
                <th className="text-right">Win%</th>
                <th className="text-right">Trades</th>
                <th>Score</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {pageItems.map((t) => {
                const score = smartMoneyScore({
                  alltimeProfit: t.alltime_profit,
                  winRate: (t.win_rate ?? 0) / 100,
                  tradeCount: t.trade_count ?? 0,
                  maxDrawdown: Math.max(t.alltime_profit * 0.2, 1),
                  rank: t.rank,
                });
                const tier = smartMoneyTier(score);
                return (
                  <tr key={t.wallet}>
                    <td className="font-mono tabular-nums w-10" style={{ color: 'var(--text-3)' }}>
                      {t.rank}
                    </td>
                    <td>
                      <div className="flex items-center gap-1">
                        <FollowButton wallet={t.wallet} />
                        <div>
                          <div className="font-medium">{t.display_name || shortWallet(t.wallet)}</div>
                          <div className="font-mono text-[10px]" style={{ color: 'var(--text-3)' }}>
                            {shortWallet(t.wallet)}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="text-right font-mono tabular-nums font-medium" style={{ color: t.alltime_profit >= 0 ? 'var(--mint)' : 'var(--rose)' }}>
                      {fmtUsd(t.alltime_profit)}
                    </td>
                    <td className="text-right font-mono tabular-nums">{(t.win_rate ?? 0).toFixed(1)}%</td>
                    <td className="text-right font-mono tabular-nums">{(t.trade_count ?? 0).toLocaleString()}</td>
                    <td>
                      <span className="smart-money-tier" data-tier={tier}>{tier}</span>
                    </td>
                    <td className="text-right">
                      <Link href={traderProfilePath(t.wallet)} className="btn btn-ghost">
                        View
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TableShell>
      )}
    </Shell>
  );
}
