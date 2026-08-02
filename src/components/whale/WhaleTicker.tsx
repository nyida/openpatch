'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Bell } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { useLiveWhales } from '@/lib/whale/hooks';
import { fmtRelativeTime, fmtUsd, platformShort } from '@/lib/whale/utils';
import { DUR, EASE_OUT, fadeUp } from '@/lib/motion';

const WHALE_ALERT_USD = 10_000;

export function WhaleTicker() {
  const { data, isLoading, isError } = useLiveWhales(500, 100);
  const [flash, setFlash] = useState(false);
  const prevMaxRef = useRef(0);
  const reduced = useReducedMotion();

  const trades = data?.trades ?? [];
  const maxTrade = useMemo(
    () => trades.reduce((m, t) => Math.max(m, t.usd_value), 0),
    [trades],
  );

  useEffect(() => {
    if (maxTrade >= WHALE_ALERT_USD && maxTrade > prevMaxRef.current) {
      setFlash(true);
      const id = setTimeout(() => setFlash(false), 3000);
      prevMaxRef.current = maxTrade;
      return () => clearTimeout(id);
    }
    prevMaxRef.current = maxTrade;
  }, [maxTrade]);

  if (isError) return null;

  return (
    <motion.section
      className="whale-ticker surface mt-4"
      aria-label="Live whale trades"
      initial={reduced ? false : fadeUp.initial}
      animate={fadeUp.animate}
      transition={{ duration: reduced ? 0 : DUR.slow, ease: EASE_OUT, delay: reduced ? 0 : 0.1 }}
    >
      <div className="whale-ticker-header">
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-wider opacity-60">Live whale feed</span>
        </div>
        <div className="flex items-center gap-2">
          <Bell
            className={`w-3.5 h-3.5 ${flash ? 'whale-alert-flash' : 'opacity-50'}`}
            aria-label={flash ? 'Whale alert: trade over $10K' : 'Whale alert'}
          />
          <span className="text-[10px] opacity-50 font-mono">
            {isLoading ? '…' : `${trades.length} fills ≥ $500`}
          </span>
        </div>
      </div>

      <div className="whale-ticker-track">
        {isLoading && trades.length === 0 ? (
          <div className="whale-ticker-empty shimmer h-6 w-full rounded" />
        ) : trades.length === 0 ? (
          <p className="whale-ticker-empty text-[11px] opacity-50">No large fills yet.</p>
        ) : (
          <div className="whale-ticker-scroll">
            {trades.map((t, i) => {
              const title = t.event_title && t.event_title !== t.market_title ? t.event_title : t.market_title;
              const side = t.side || t.outcome;
              const big = t.usd_value >= WHALE_ALERT_USD;
              return (
                <div key={`${t.timestamp}-${t.platform}-${i}`} className={`whale-ticker-item ${big ? 'whale-ticker-big' : ''}`}>
                  <span className="font-mono opacity-50">{fmtRelativeTime(t.timestamp)}</span>
                  <span className="venue-pill">{platformShort(t.platform)}</span>
                  <span className="truncate max-w-[200px]" title={title}>
                    {title}
                  </span>
                  <span style={{ color: side.toLowerCase().includes('yes') || side.toLowerCase() === 'buy' ? 'var(--mint)' : 'var(--rose)' }}>
                    {side.toUpperCase()}
                  </span>
                  <span className="font-mono tabular-nums">{fmtUsd(t.usd_value)}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </motion.section>
  );
}
