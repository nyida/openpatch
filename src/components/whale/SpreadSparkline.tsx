'use client';

import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Area, AreaChart, ResponsiveContainer } from 'recharts';
import { TrendingDown, TrendingUp } from 'lucide-react';
import {
  getClientSpreadHistory,
  hydrateMemoryCache,
  spreadTrend,
  type ClientSpreadPoint,
} from '@/lib/spreadHistoryIdb';
import { useSpreadModal } from '@/context/SpreadModalContext';

export const SpreadSparkline = memo(function SpreadSparkline({
  contractId,
  title,
  polyTitle,
  kalshiTitle,
  netCents,
}: {
  contractId?: string;
  title?: string;
  polyTitle?: string;
  kalshiTitle?: string;
  netCents?: number;
}) {
  const { openSpreadModal } = useSpreadModal();
  const [points, setPoints] = useState<ClientSpreadPoint[]>([]);
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !contractId) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setVisible(true);
      },
      { rootMargin: '100px' },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [contractId]);

  useEffect(() => {
    if (!contractId || !visible) return;
    hydrateMemoryCache(contractId).then(setPoints);
  }, [contractId, visible, netCents]);

  const chartData = useMemo(() => points.map((p) => ({ v: p.net_cents })), [points]);
  const trend = spreadTrend(points);
  const last = points[points.length - 1]?.net_cents ?? netCents ?? 0;
  const color = last > 1 ? 'var(--mint)' : last >= 0 ? '#eab308' : 'var(--rose)';

  const preview =
    netCents != null && Number.isFinite(netCents)
      ? `${netCents >= 0 ? '+' : ''}${netCents.toFixed(1)}¢`
      : '-';

  if (!contractId || chartData.length < 2) {
    return (
      <button
        ref={ref}
        type="button"
        className="spread-sparkline-empty opacity-50 text-[9px] font-mono tabular-nums cursor-pointer hover:opacity-80"
        title="Click for full chart (building history…)"
        onClick={(e) => {
          e.stopPropagation();
          if (contractId && title) openSpreadModal({ contractId, title, polyTitle, kalshiTitle });
        }}
        disabled={!contractId}
      >
        {preview}
      </button>
    );
  }

  return (
    <button
      ref={ref}
      type="button"
      className="spread-sparkline-wrap cursor-pointer hover:opacity-90"
      title="Click for full historical chart"
      onClick={(e) => {
        e.stopPropagation();
        openSpreadModal({ contractId, title: title ?? contractId, polyTitle, kalshiTitle });
      }}
    >
      {trend === 'up' && <TrendingUp className="w-2.5 h-2.5 shrink-0" style={{ color: 'var(--mint)' }} />}
      {trend === 'down' && <TrendingDown className="w-2.5 h-2.5 shrink-0" style={{ color: 'var(--rose)' }} />}
      {visible && (
        <ResponsiveContainer width={44} height={30}>
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id={`fill-${contractId}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.35} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area
              type="monotone"
              dataKey="v"
              stroke={color}
              strokeWidth={1.2}
              fill={`url(#fill-${contractId})`}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </button>
  );
});
