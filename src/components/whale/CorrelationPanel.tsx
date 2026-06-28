'use client';

import Link from 'next/link';
import { marketDetailPath } from '@/lib/whale/marketRoutes';
import type { CorrelationLink } from '@/lib/analytics/correlation';

const RELATION_LABELS: Record<CorrelationLink['relation'], string> = {
  same_event: 'Same event',
  same_category: 'Same sector',
  inverse: 'Inverse',
  correlated: 'Correlated',
};

export function CorrelationPanel({ links }: { links: CorrelationLink[] }) {
  if (!links.length) return null;

  return (
    <div className="surface p-4 mb-4">
      <p className="text-[10px] uppercase tracking-wider mb-3" style={{ color: 'var(--text-3)' }}>
        Related markets
      </p>
      <div className="space-y-2">
        {links.map((link) => (
          <Link
            key={`${link.platform}-${link.title}`}
            href={marketDetailPath(link.title, link.platform, { price: link.probability })}
            className="correlation-row"
          >
            <span className="correlation-relation">{RELATION_LABELS[link.relation]}</span>
            <span className="correlation-title truncate">{link.title}</span>
            <span className="correlation-prob font-mono tabular-nums">
              {(link.probability * 100).toFixed(1)}%
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
