'use client';

export interface ReliabilityData {
  retrievalUsed?: boolean;
  claimsSupportedPercent?: number;
  arithmeticVerified?: boolean;
  contradictionsDetected?: boolean;
  overallConfidence?: string;
  explanation?: string;
}

export function ReliabilityReport({ data }: { data: ReliabilityData }) {
  if (!data || typeof data !== 'object') return null;
  const confidence = (data.overallConfidence ?? 'medium') as string;
  const confidenceColor =
    confidence === 'high'
      ? 'bg-[var(--accent-soft)] text-[var(--accent)] border-[var(--accent)]/20'
      : confidence === 'low'
        ? 'bg-slate-100 text-slate-700 border-slate-200'
        : 'bg-[var(--bg-subtle)] text-[var(--text-secondary)] border-[var(--border)]';

  return (
    <div className="rounded-none border border-[var(--border)] bg-[var(--bg-subtle)] p-4 space-y-3">
      <div className="flex items-center gap-2.5 flex-wrap">
        <span className={`inline-flex items-center px-2.5 py-1 rounded-none text-[11px] font-medium uppercase tracking-wider border ${confidenceColor}`}>
          {confidence === 'high' && 'High confidence'}
          {confidence === 'medium' && 'Medium confidence'}
          {confidence === 'low' && 'Low confidence'}
        </span>
        {data.retrievalUsed !== undefined && (
          <span className="text-xs text-slate-600 font-medium">
            {data.retrievalUsed ? 'Sources used' : 'No sources'}
          </span>
        )}
        {data.arithmeticVerified !== undefined && (
          <span className="text-xs text-slate-600">
            {data.arithmeticVerified ? 'Arithmetic verified' : '—'}
          </span>
        )}
        {data.contradictionsDetected !== undefined && (
          <span className="text-xs text-slate-600">
            {data.contradictionsDetected ? 'Contradictions detected' : 'No contradictions'}
          </span>
        )}
        {data.claimsSupportedPercent !== undefined && data.retrievalUsed && (
          <span className="text-xs text-slate-600">
            {data.claimsSupportedPercent}% claims supported
          </span>
        )}
      </div>
      {data.explanation && (
        <p className="text-[13px] text-slate-600 leading-relaxed">{data.explanation}</p>
      )}
    </div>
  );
}
