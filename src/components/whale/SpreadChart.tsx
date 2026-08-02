'use client';

import { memo, useMemo } from 'react';
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useQuery } from '@tanstack/react-query';
import { fetchJson } from '@/lib/whale/fetch';

type SpreadPoint = {
  at: number;
  spread_cents: number;
  net_profit_cents: number;
};

export const SpreadChart = memo(function SpreadChart({
  marketId,
  title,
  variant = 'spark',
}: {
  marketId?: string;
  title?: string;
  variant?: 'spark' | 'full';
}) {
  const key = marketId ?? title ?? '';
  const { data } = useQuery({
    queryKey: ['spread-history', key],
    queryFn: () => {
      const params = new URLSearchParams();
      if (marketId) params.set('id', marketId);
      else if (title) params.set('title', title);
      return fetchJson<{ points: SpreadPoint[] }>(`/api/spread_history?${params}`);
    },
    enabled: Boolean(marketId || title),
    refetchInterval: 60_000,
  });

  const chartData = useMemo(
    () =>
      (data?.points ?? []).map((p) => ({
        t: new Date(p.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        spread: p.net_profit_cents,
      })),
    [data?.points],
  );

  if (chartData.length < 2) {
    return <span className="opacity-30 text-[9px] font-mono">-</span>;
  }

  const last = chartData[chartData.length - 1]?.spread ?? 0;
  const color = last > 1 ? 'var(--mint)' : last >= 0 ? '#eab308' : 'var(--rose)';

  if (variant === 'full') {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <XAxis dataKey="t" tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.4)' }} />
          <YAxis tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.4)' }} unit="¢" />
          <Tooltip
            contentStyle={{ background: '#111', border: '1px solid rgba(255,255,255,0.1)', fontSize: 11 }}
          />
          <Line type="monotone" dataKey="spread" stroke={color} strokeWidth={2} dot={false} name="Net ¢" />
        </LineChart>
      </ResponsiveContainer>
    );
  }

  return (
    <div className="spread-sparkline" title="Net spread trend (4h)">
      <ResponsiveContainer width={56} height={22}>
        <LineChart data={chartData}>
          <YAxis hide domain={['dataMin', 'dataMax']} />
          <Line
            type="monotone"
            dataKey="spread"
            stroke={color}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
});

