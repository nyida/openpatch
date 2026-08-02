'use client';

function clamp(n: number) {
  return Math.min(100, Math.max(0, n));
}

export function DualBar({ yesPct }: { yesPct: number }) {
  const yes = clamp(yesPct);
  const no = 100 - yes;

  return (
    <div className="dual-bar-wrap" role="img" aria-label={`${yes.toFixed(1)}% yes, ${no.toFixed(1)}% no`}>
      <span className="dual-bar-label dual-bar-label-yes">{yes.toFixed(0)}%</span>
      <div className="dual-bar-track">
        <div className="dual-bar-yes" style={{ width: `${yes}%` }} />
        <div className="dual-bar-no" style={{ width: `${no}%` }} />
      </div>
      <span className="dual-bar-label dual-bar-label-no">{no.toFixed(0)}%</span>
    </div>
  );
}

export function edgeFromPct(marketPct: number, whalePct: number) {
  const delta = whalePct - marketPct;
  const abs = Math.abs(delta);
  if (abs < 0.5) return { delta, label: '-', cls: 'neutral' as const };
  const sign = delta > 0 ? '+' : '−';
  return {
    delta,
    label: `${sign}${abs.toFixed(1)}`,
    cls: delta > 0 ? ('bull' as const) : ('bear' as const),
  };
}
