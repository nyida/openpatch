'use client';

import { Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import type { ReactNode } from 'react';
import {
  DUR,
  EASE_OUT,
  EASE_PANEL,
  SPRING_SOFT,
  fadeUp,
  panelSwap,
  staggerContainer,
  staggerItem,
} from '@/lib/motion';

export function Shell({ children }: { children: ReactNode }) {
  return <div className="shell">{children}</div>;
}

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}) {
  const reduced = useReducedMotion();

  return (
    <motion.div
      className="page-head"
      initial={reduced ? false : fadeUp.initial}
      animate={fadeUp.animate}
      transition={{ duration: reduced ? 0 : DUR.base, ease: EASE_OUT }}
    >
      <div>
        <h1 className="page-title">{title}</h1>
        {description && <p className="page-desc">{description}</p>}
      </div>
      {action}
    </motion.div>
  );
}

export function ResearchBrief({
  action,
  status,
}: {
  action?: ReactNode;
  status?: ReactNode;
}) {
  return (
    <div className="research-brief">
      <div className="research-brief-body">
        <h1 className="research-title">Whale holdings vs. market odds</h1>
        <p className="research-abstract">
          Value-weighted YES share across tracked wallets compared to exchange mid-price.
          Δ is the wedge in percentage points - expand rows for positions.
        </p>
        {status && <div className="data-status mt-2">{status}</div>}
      </div>
      {action}
    </div>
  );
}

export function DataStatusLine({
  label,
  stale,
  children,
}: {
  label: string;
  stale?: boolean;
  children: ReactNode;
}) {
  return (
    <p className={`data-status-line ${stale ? 'stale' : ''}`}>
      <span className="data-status-label">{label}</span>
      <span>{children}</span>
    </p>
  );
}

const HIGHLIGHT_SPRING = SPRING_SOFT;

export function FadeSwap({ viewKey, children }: { viewKey: string; children: ReactNode }) {
  const reduced = useReducedMotion();

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={viewKey}
        className="panel-swap"
        initial={reduced ? false : panelSwap.initial}
        animate={panelSwap.animate}
        exit={reduced ? undefined : panelSwap.exit}
        transition={reduced ? { duration: 0 } : panelSwap.transition}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

export function SectorNav<T extends string>({
  options,
  value,
  onChange,
  layoutId = 'sector-nav-highlight',
  'aria-label': ariaLabel = 'Sector filter',
  className,
}: {
  options: { id: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  layoutId?: string;
  'aria-label'?: string;
  className?: string;
}) {
  return (
    <nav className={`sector-nav${className ? ` ${className}` : ''}`} aria-label={ariaLabel}>
      {options.map((o) => {
        const active = value === o.id;
        return (
          <button
            key={o.id}
            type="button"
            className="sector-nav-link"
            data-active={active}
            onClick={() => onChange(o.id)}
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                className="nav-slide-highlight"
                transition={HIGHLIGHT_SPRING}
                aria-hidden
              />
            )}
            <span className="nav-slide-label">{o.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

export function StatStrip({ children }: { children: ReactNode }) {
  const reduced = useReducedMotion();

  return (
    <motion.div
      className="stat-strip data-status"
      initial={reduced ? false : 'hidden'}
      animate="visible"
      variants={reduced ? undefined : staggerContainer}
    >
      {children}
    </motion.div>
  );
}

export function StatPill({ label, value, accent }: { label: string; value: string; accent?: 'mint' }) {
  const reduced = useReducedMotion();

  return (
    <motion.div className="stat-pill" variants={reduced ? undefined : staggerItem}>
      <span className="data-status-label">{label}</span>
      <span className={`stat-value${accent === 'mint' ? ' stat-value--mint' : ''}`}>{value}</span>
    </motion.div>
  );
}

export function SearchInput({
  value,
  onChange,
  placeholder,
  onKeyDown,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}) {
  return (
    <div className="search-wrap">
      <Search />
      <input
        type="search"
        className="input"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
      />
    </div>
  );
}

export function Toolbar({ children }: { children: ReactNode }) {
  const reduced = useReducedMotion();

  return (
    <motion.div
      className="toolbar"
      initial={reduced ? false : fadeUp.initial}
      animate={fadeUp.animate}
      transition={{ duration: reduced ? 0 : DUR.base, ease: EASE_OUT, delay: reduced ? 0 : 0.04 }}
    >
      {children}
    </motion.div>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  counts,
}: {
  options: { id: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  counts?: Partial<Record<T, number>>;
}) {
  return (
    <div className="segmented">
      {options.map((o) => {
        const active = value === o.id;
        return (
          <button key={o.id} type="button" data-on={active} onClick={() => onChange(o.id)}>
            {active && (
              <motion.span
                layoutId="segmented-highlight"
                className="nav-slide-highlight segmented-highlight"
                transition={HIGHLIGHT_SPRING}
                aria-hidden
              />
            )}
            <span className="nav-slide-label">
              {o.label}
              {counts?.[o.id] !== undefined && (
                <span className="ml-1 font-mono opacity-60">{counts[o.id]?.toLocaleString()}</span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function Pager({
  page,
  totalPages,
  total,
  pageSize,
  onChange,
}: {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  onChange: (p: number) => void;
}) {
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  return (
    <div className="page-footer">
      <p className="text-xs" style={{ color: 'var(--text-3)' }}>
        {total === 0 ? 'No results' : `${start}–${end} of ${total.toLocaleString()}`}
      </p>
      <div className="flex items-center gap-1">
        <button type="button" className="btn btn-ghost !p-1.5" disabled={page <= 1} onClick={() => onChange(page - 1)}>
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
        <span className="font-mono text-xs tabular-nums min-w-[3rem] text-center" style={{ color: 'var(--text-2)' }}>
          {page}/{Math.max(totalPages, 1)}
        </span>
        <button
          type="button"
          className="btn btn-ghost !p-1.5"
          disabled={page >= totalPages}
          onClick={() => onChange(page + 1)}
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

export function TableShell({ children, footer }: { children: ReactNode; footer?: ReactNode }) {
  const reduced = useReducedMotion();

  return (
    <motion.div
      className="surface overflow-hidden"
      initial={reduced ? false : fadeUp.initial}
      animate={fadeUp.animate}
      transition={{ duration: reduced ? 0 : DUR.base, ease: EASE_OUT, delay: reduced ? 0 : 0.06 }}
    >
      <div className="overflow-x-auto">{children}</div>
      {footer}
    </motion.div>
  );
}

export function SkeletonTable({ rows = 12 }: { rows?: number }) {
  return (
    <div className="surface overflow-hidden">
      <div className="p-3 space-y-2">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="shimmer h-8 w-full" style={{ animationDelay: `${i * 35}ms` }} />
        ))}
      </div>
    </div>
  );
}

export function PageHero({
  title,
  subtitle,
  action,
}: {
  eyebrow?: string;
  title: string;
  titleAccent?: string;
  subtitle?: ReactNode;
  action?: ReactNode;
}) {
  return <PageHeader title={title} description={subtitle} action={action} />;
}

export function MetricGrid({ children }: { children: ReactNode }) {
  return <StatStrip>{children}</StatStrip>;
}

export function Metric({
  label,
  value,
  accent,
  loading,
}: {
  label: string;
  value: string;
  accent?: 'mint';
  icon?: ReactNode;
  loading?: boolean;
}) {
  if (loading) {
    return (
      <div className="stat-pill">
        <span className="shimmer h-4 w-16" />
      </div>
    );
  }
  return <StatPill label={label} value={value} accent={accent} />;
}

export function CardList({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export function SkeletonList({ n = 8 }: { n?: number }) {
  return <SkeletonTable rows={n} />;
}
