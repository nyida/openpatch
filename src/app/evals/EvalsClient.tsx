'use client';

import { useState } from 'react';

type Suite = { id: string; name: string; description: string | null; caseCount: number };
type VersionStats = { pass: number; fail: number; total: number };

export function EvalsClient({
  suites,
  byVersion,
  recentResults,
}: {
  suites: Suite[];
  byVersion: Record<string, VersionStats>;
  recentResults: { caseId: string; runId: string; passFail: boolean; versionTag: string | null; taskType: string }[];
}) {
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<{ results: { caseId: string; runId: string; pass: boolean }[] } | null>(null);
  const [suiteId, setSuiteId] = useState(suites[0]?.id ?? '');

  async function handleRun() {
    setRunning(true);
    setRunResult(null);
    try {
      const res = await fetch('/api/evals/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suiteId: suiteId || undefined }),
      });
      const data = await res.json();
      setRunResult(data);
    } finally {
      setRunning(false);
    }
  }

  const versions = Object.entries(byVersion);
  return (
    <div className="space-y-6">
      <div className="card">
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Run test suite</h2>
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Suite</label>
            <select
              className="input-base py-2.5 min-w-[200px]"
              value={suiteId}
              onChange={(e) => setSuiteId(e.target.value)}
            >
              {suites.map((s) => (
                <option key={s.id} value={s.id}>{s.name} ({s.caseCount} cases)</option>
              ))}
            </select>
          </div>
          <button
            onClick={handleRun}
            disabled={running}
            className="btn-primary disabled:opacity-50"
          >
            {running ? 'Running…' : 'Run suite'}
          </button>
        </div>
        {runResult && (
          <p className="mt-3 text-sm text-slate-600">
            Ran {runResult.results?.length ?? 0} cases. Pass: {runResult.results?.filter((r: { pass: boolean }) => r.pass).length ?? 0}.
          </p>
        )}
      </div>

      <div className="card">
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Results by version</h2>
        {versions.length === 0 ? (
          <p className="text-slate-500 text-sm">Run a suite to see version stats.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-left">
                  <th className="py-3 px-4 font-medium text-slate-600">Version</th>
                  <th className="py-3 px-4 font-medium text-slate-600">Pass</th>
                  <th className="py-3 px-4 font-medium text-slate-600">Fail</th>
                  <th className="py-3 px-4 font-medium text-slate-600">Total</th>
                  <th className="py-3 px-4 font-medium text-slate-600">Win rate</th>
                </tr>
              </thead>
              <tbody>
                {versions.map(([v, s]) => (
                  <tr key={v} className="border-t border-slate-100">
                    <td className="py-3 px-4 font-medium text-slate-800">{v}</td>
                    <td className="py-3 px-4 text-emerald-600">{s.pass}</td>
                    <td className="py-3 px-4 text-amber-600">{s.fail}</td>
                    <td className="py-3 px-4 text-slate-600">{s.total}</td>
                    <td className="py-3 px-4">
                      {s.total ? ((s.pass / s.total) * 100).toFixed(1) : 0}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {recentResults.length > 0 && (
        <div className="card">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Recent results</h2>
          <div className="overflow-auto max-h-60 rounded-xl border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 sticky top-0">
                <tr className="text-left">
                  <th className="py-2 px-3 font-medium text-slate-600">Case</th>
                  <th className="py-2 px-3 font-medium text-slate-600">Version</th>
                  <th className="py-2 px-3 font-medium text-slate-600">Type</th>
                  <th className="py-2 px-3 font-medium text-slate-600">Pass</th>
                </tr>
              </thead>
              <tbody>
                {recentResults.map((r, i) => (
                  <tr key={i} className="border-t border-slate-100">
                    <td className="py-2 px-3 font-mono text-xs text-slate-600">{r.caseId.slice(0, 8)}</td>
                    <td className="py-2 px-3 text-slate-600">{r.versionTag ?? '—'}</td>
                    <td className="py-2 px-3 text-slate-600">{r.taskType}</td>
                    <td className="py-2 px-3">{r.passFail ? <span className="text-emerald-600">✓</span> : <span className="text-amber-600">✗</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
