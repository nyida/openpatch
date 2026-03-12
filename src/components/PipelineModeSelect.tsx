'use client';

import { useRef, useState, useLayoutEffect } from 'react';
import { motion } from 'framer-motion';

const options = [
  { key: 'standard' as const, label: 'Standard' },
  { key: 'improved' as const, label: 'Improved' },
  { key: 'cortex' as const, label: 'CORTEX' },
];

type Mode = 'standard' | 'improved' | 'cortex';

type Props = {
  value: Mode;
  onChange: (mode: Mode) => void;
  size?: 'sm' | 'md';
};

export function PipelineModeSelect({ value, onChange, size = 'md' }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const activeIndex = options.findIndex((o) => o.key === value);
  const [pill, setPill] = useState({ left: 0, width: 0 });

  useLayoutEffect(() => {
    const container = containerRef.current;
    const el = activeIndex >= 0 ? buttonRefs.current[activeIndex] : null;
    if (container && el) {
      const cr = container.getBoundingClientRect();
      const er = el.getBoundingClientRect();
      setPill({ left: er.left - cr.left, width: er.width });
    }
  }, [activeIndex, value]);

  const isSm = size === 'sm';

  return (
    <div
      ref={containerRef}
      role="group"
      aria-label="Pipeline mode"
      className="relative flex gap-0.5 shrink-0"
    >
      {activeIndex >= 0 && pill.width > 0 && (
        <motion.span
          className="absolute top-0 bottom-0 rounded-none bg-[var(--accent)]/5"
          initial={false}
          animate={{ left: pill.left, width: pill.width }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        />
      )}
      {options.map(({ key, label }, i) => (
        <button
          key={key}
          type="button"
          ref={(el) => { buttonRefs.current[i] = el; }}
          onClick={() => onChange(key)}
          className={`relative z-[1] px-3 py-1.5 text-[13px] font-medium rounded-none transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/30 focus-visible:ring-offset-2 ${
            value === key
              ? 'text-[var(--accent)]'
              : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
          } ${isSm ? 'px-2.5 py-1 text-[12px]' : ''}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
