'use client';

import { memo } from 'react';
import type { ArbitrageSpread } from '@/services/types';
import { formatNetProfitCents, netROITooltip } from '@/utils/arbMath';

const TIER_COLOR: Record<string, string> = {
  green: 'var(--mint)',
  yellow: '#eab308',
  red: 'var(--rose)',
};

export const ArbitrageROI = memo(function ArbitrageROI({
  spread,
}: {
  spread?: ArbitrageSpread | null;
}) {
  if (!spread) {
    return <span className="opacity-40 font-mono tabular-nums text-[11px]">-</span>;
  }

  const roi = spread.roi;
  const hint =
    roi.direction === 'buy_poly'
      ? 'Buy Poly'
      : roi.direction === 'buy_kalshi'
        ? 'Buy Kalshi'
        : 'Neutral';

  return (
    <span
      className="font-mono tabular-nums text-[11px]"
      style={{ color: TIER_COLOR[roi.tier] ?? '#ffffff' }}
      title={`${hint}\n${formatNetProfitCents(roi)}\n${netROITooltip()}`}
    >
      {formatNetProfitCents(roi)}
    </span>
  );
});
