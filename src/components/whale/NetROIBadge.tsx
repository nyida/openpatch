'use client';

import { memo, useMemo } from 'react';
import type { ArbitrageSpread } from '@/services/types';
import { calculateNetROI, formatNetProfitCents, netROITooltip } from '@/utils/arbMath';
import { useLiveSpread } from '@/hooks/useWebSocket';

const TIER_COLOR: Record<string, string> = {
  green: 'var(--mint)',
  yellow: '#eab308',
  red: 'var(--rose)',
};

export const NetROIBadge = memo(function NetROIBadge({
  spread,
}: {
  spread?: ArbitrageSpread | null;
}) {
  const live = useLiveSpread(
    spread?.id,
    spread?.poly_price ?? 0,
    spread?.kalshi_price ?? 0,
  );

  const roi = useMemo(() => {
    if (!spread) return null;
    if (live.isLive && live.polyPrice && live.kalshiPrice) {
      return calculateNetROI(live.kalshiPrice, live.polyPrice);
    }
    return spread.roi;
  }, [spread, live.isLive, live.polyPrice, live.kalshiPrice]);

  if (!spread || !roi) {
    return <span className="opacity-40 font-mono tabular-nums text-[11px]">-</span>;
  }

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
      title={`${hint}\n${formatNetProfitCents(roi)}${live.isLive ? '\nWebSocket live' : ''}\n${netROITooltip()}`}
    >
      {formatNetProfitCents(roi)}
    </span>
  );
});
