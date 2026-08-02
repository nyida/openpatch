'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { useMarketChanges } from '@/lib/whale/dataSourceHooks';
import { MarketTitleLink } from '@/components/whale/MarketTitleLink';
import { DUR, EASE_OUT, fadeUp, staggerContainer, staggerItem } from '@/lib/motion';

export function TopMoversPanel({ since = '1h', limit = 8 }: { since?: string; limit?: number }) {
  const { data, isLoading } = useMarketChanges(since);
  const reduced = useReducedMotion();

  const movers = (data?.changes ?? [])
    .filter((c) => c.type === 'price_move' && c.change_pct != null)
    .sort((a, b) => Math.abs(b.change_pct ?? 0) - Math.abs(a.change_pct ?? 0))
    .slice(0, limit);

  if (isLoading) {
    return (
      <div className="surface p-4 mb-4">
        <p className="text-[10px] uppercase mb-3" style={{ color: 'var(--text-3)' }}>
          Top movers
        </p>
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="shimmer h-8 w-full rounded" />
          ))}
        </div>
      </div>
    );
  }

  if (!movers.length) return null;

  return (
    <motion.div
      className="surface p-4 mb-4"
      initial={reduced ? false : fadeUp.initial}
      animate={fadeUp.animate}
      transition={{ duration: reduced ? 0 : DUR.base, ease: EASE_OUT, delay: reduced ? 0 : 0.05 }}
    >
      <p className="text-[10px] uppercase tracking-wider mb-3" style={{ color: 'var(--text-3)' }}>
        Top movers ({since})
      </p>
      <motion.div
        className="space-y-1.5"
        initial={reduced ? false : 'hidden'}
        animate="visible"
        variants={reduced ? undefined : staggerContainer}
      >
        {movers.map((m, i) => {
          const change = m.change_pct ?? 0;
          const up = change >= 0;
          return (
            <motion.div
              key={`${m.platform}-${m.title}-${i}`}
              className="top-mover-row"
              variants={reduced ? undefined : staggerItem}
            >
              <MarketTitleLink
                title={m.title}
                platform={m.platform}
                extras={{ price: m.new_price ?? undefined }}
              />
              <span
                className="font-mono tabular-nums text-xs shrink-0"
                style={{ color: up ? 'var(--mint)' : 'var(--rose)' }}
              >
                {up ? '+' : ''}
                {change.toFixed(1)}%
              </span>
            </motion.div>
          );
        })}
      </motion.div>
    </motion.div>
  );
}
