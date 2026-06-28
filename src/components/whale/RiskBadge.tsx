'use client';

import type { RiskGrade } from '@/lib/analytics/riskRating';

const GRADE_COLORS: Record<RiskGrade, string> = {
  A: 'var(--mint)',
  B: '#7cb87a',
  C: 'var(--amber)',
  D: '#d4926a',
  F: 'var(--rose)',
};

export function RiskBadge({
  grade,
  label,
  title,
}: {
  grade: RiskGrade;
  label?: string;
  title?: string;
}) {
  return (
    <span
      className="risk-badge"
      style={{ color: GRADE_COLORS[grade], borderColor: `${GRADE_COLORS[grade]}44` }}
      title={title ?? label}
    >
      {grade}
      {label && <span className="risk-badge-label">{label}</span>}
    </span>
  );
}
