'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ContractCell } from '@/components/whale/PlatformTag';
import { marketDetailPath } from '@/lib/whale/marketRoutes';
import { fmtUsd } from '@/lib/whale/utils';
import { usePoll } from '@/lib/whale/usePoll';
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

type Market = {
  market_title: string;
  platform: string;
  whale_count: number;
  total_usd: number;
};

export default function MarketsPage() {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch('/api/all_markets', { cache: 'no-store' });
      if (res.ok) setMarkets(await res.json());
      else if (!silent) setMarkets([]);
    } catch {
      if (!silent) setMarkets([]);
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
    if (!q) return markets;
    return markets.filter((m) => m.market_title.toLowerCase().includes(q));
  }, [markets, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const totalExposure = markets.reduce((s, m) => s + m.total_usd, 0);

  useEffect(() => setPage(1), [search]);

  return (
    <Shell>
      <PageHeader title="Exposure" description="Whale exposure by contract and venue" />

      <StatStrip>
        <StatPill label="Markets" value={loading ? '—' : markets.length.toLocaleString()} />
        <StatPill label="Total exposure" value={loading ? '—' : fmtUsd(totalExposure)} accent="mint" />
      </StatStrip>

      <Toolbar>
        <SearchInput value={search} onChange={setSearch} placeholder="Search markets…" />
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
          <table className="data-table markets-table">
            <thead>
              <tr>
                <th>Contract</th>
                <th className="text-right">Whales</th>
                <th className="text-right">Exposure</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {pageItems.map((m) => (
                <tr key={`${m.platform}-${m.market_title}`}>
                  <td className="col-market">
                    <ContractCell title={m.market_title} platform={m.platform} />
                  </td>
                  <td className="text-right font-mono tabular-nums">{m.whale_count}</td>
                  <td className="text-right font-mono tabular-nums font-medium">
                    {fmtUsd(m.total_usd)}
                  </td>
                  <td className="text-right">
                    <Link
                      href={marketDetailPath(m.market_title, m.platform)}
                      className="btn btn-ghost"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableShell>
      )}
    </Shell>
  );
}
