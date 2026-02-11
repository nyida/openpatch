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
      ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
      : confidence === 'low'
        ? 'bg-amber-100 text-amber-800 border-amber-200'
        : 'bg-slate-100 text-slate-700 border-slate-200';

  return (
    <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-4 space-y-3 shadow-sm">
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold border ${confidenceColor}`}>
          {confidence === 'high' && '✓ High confidence'}
          {confidence === 'medium' && '○ Medium confidence'}
          {confidence === 'low' && '⚠ Low confidence'}
        </span>
        {data.retrievalUsed !== undefined && (
          <span className="text-xs text-slate-600 font-medium">
            {data.retrievalUsed ? '📎 Sources used' : 'No sources'}
          </span>
        )}
        {data.arithmeticVerified !== undefined && (
          <span className="text-xs text-slate-600">
            {data.arithmeticVerified ? '✓ Math verified' : '—'}
          </span>
        )}
        {data.contradictionsDetected !== undefined && (
          <span className="text-xs text-slate-600">
            {data.contradictionsDetected ? '⚠ Contradictions' : '✓ No contradictions'}
          </span>
        )}
        {data.claimsSupportedPercent !== undefined && data.retrievalUsed && (
          <span className="text-xs text-slate-600">
            {data.claimsSupportedPercent}% claims supported
          </span>
        )}
      </div>
      {data.explanation && (
        <p className="text-sm text-slate-600 leading-relaxed">{data.explanation}</p>
      )}
    </div>
  );
}
