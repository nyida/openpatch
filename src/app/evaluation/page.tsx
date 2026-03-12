'use client';

import { useState, useCallback, useEffect } from 'react';
import { PageMotion } from '@/components/PageMotion';

type Results = {
  summaryCsv: string | null;
  summaryTableCsv: string | null;
  pairwiseCsv: string | null;
  bootstrap: unknown;
  figures: string[];
  metricsCsv: string | null;
};

export default function EvaluationPage() {
  const [loading, setLoading] = useState<string | null>(null);
  const [log, setLog] = useState<string>('');
  const [results, setResults] = useState<Results | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dryRun, setDryRun] = useState(false);

  const fetchResults = useCallback(async () => {
    try {
      const res = await fetch('/api/evaluation/results');
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setResults(data);
    } catch {
      setResults(null);
    }
  }, []);

  useEffect(() => {
    fetchResults();
  }, [fetchResults]);

  const run = useCallback(
    async (action: 'run' | 'score' | 'analyze') => {
      setError(null);
      setLoading(action);
      setLog(`Running ${action}...\n`);
      try {
        const url =
          action === 'run'
            ? '/api/evaluation/run'
            : action === 'score'
              ? '/api/evaluation/score'
              : '/api/evaluation/analyze';
        const opts: RequestInit = { method: 'POST' };
        if (action === 'run') {
          opts.headers = { 'Content-Type': 'application/json' };
          opts.body = JSON.stringify({ dry_run: dryRun });
        }
        const res = await fetch(url, opts);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data.detail || data.error || res.statusText);
          setLog((prev) => prev + (data.detail || data.error || '') + '\n');
          return;
        }
        setLog((prev) => prev + (data.stdout || data.message || '') + '\n');
        await fetchResults();
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
        setLog((prev) => prev + msg + '\n');
      } finally {
        setLoading(null);
      }
    },
    [dryRun, fetchResults]
  );

  const runAll = useCallback(async () => {
    setError(null);
    setLoading('run');
    setLog('Run → Score → Analyze\n');
    try {
      let res = await fetch('/api/evaluation/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dry_run: dryRun }),
      });
      let data = await res.json().catch(() => ({}));
      setLog((prev) => prev + (data.stdout || '') + '\n');
      if (!res.ok) {
        setError(data.detail || data.error || 'Run failed');
        setLoading(null);
        return;
      }
      setLoading('score');
      res = await fetch('/api/evaluation/score', { method: 'POST' });
      data = await res.json().catch(() => ({}));
      setLog((prev) => prev + (data.stdout || '') + '\n');
      if (!res.ok) {
        setError(data.detail || data.error || 'Score failed');
        setLoading(null);
        return;
      }
      setLoading('analyze');
      res = await fetch('/api/evaluation/analyze', { method: 'POST' });
      data = await res.json().catch(() => ({}));
      setLog((prev) => prev + (data.stdout || '') + '\n');
      if (!res.ok) {
        setError(data.detail || data.error || 'Analyze failed');
      }
      await fetchResults();
    } finally {
      setLoading(null);
    }
  }, [dryRun, fetchResults]);

  return (
    <PageMotion className="max-w-4xl mx-auto px-4 py-10 pb-16">
      <div className="mb-10">
        <div className="flex items-center gap-3">
          <h1 className="page-title">Evaluation</h1>
          <span className="badge text-slate-500 bg-slate-100/90">v1</span>
        </div>
        <p className="page-subtitle">
          Run baseline vs improved pipeline on eval datasets. View metrics, pairwise comparison, and figures.
        </p>
      </div>

      <div className="space-y-6">
        <div className="card">
          <h2 className="section-label">Pipeline</h2>
          <div className="flex flex-wrap gap-3 items-center -mt-1">
            <label className="inline-flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
              <input
                type="checkbox"
                checked={dryRun}
                onChange={(e) => setDryRun(e.target.checked)}
                className="rounded border-slate-300 text-[var(--accent-muted)] focus:ring-blue-500"
              />
              Dry run (no Ollama)
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => run('run')}
                disabled={!!loading}
                className="btn-secondary text-sm px-4 py-2"
              >
                {loading === 'run' ? 'Running…' : 'Run'}
              </button>
              <button
                type="button"
                onClick={() => run('score')}
                disabled={!!loading}
                className="btn-secondary text-sm px-4 py-2"
              >
                {loading === 'score' ? 'Scoring…' : 'Score'}
              </button>
              <button
                type="button"
                onClick={() => run('analyze')}
                disabled={!!loading}
                className="btn-secondary text-sm px-4 py-2"
              >
                {loading === 'analyze' ? 'Analyzing…' : 'Analyze'}
              </button>
              <button
                type="button"
                onClick={runAll}
                disabled={!!loading}
                className="btn-primary text-sm px-4 py-2"
              >
                {loading ? 'Running…' : 'Run all'}
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {log && (
          <div className="card">
            <h2 className="section-label">Log</h2>
            <pre className="rounded-none bg-slate-50/80 border border-slate-200 p-4 text-xs text-slate-700 overflow-x-auto whitespace-pre-wrap scroll-smooth -mt-1">
              {log}
            </pre>
          </div>
        )}

        {results && (
          <div className="space-y-6 pb-8">
            {results.summaryTableCsv && (
              <div className="card">
                <h2 className="section-label">Summary table</h2>
                <pre className="rounded-none bg-slate-50/80 border border-slate-200 p-4 text-xs overflow-x-auto whitespace-pre -mt-1">
                  {results.summaryTableCsv}
                </pre>
              </div>
            )}
            {results.pairwiseCsv && (
              <div className="card">
                <h2 className="section-label">Pairwise comparison</h2>
                <pre className="rounded-none bg-slate-50/80 border border-slate-200 p-4 text-xs overflow-x-auto whitespace-pre max-h-60 -mt-1">
                  {results.pairwiseCsv}
                </pre>
              </div>
            )}
            {results.bootstrap && typeof results.bootstrap === 'object' ? (
              <div className="card">
                <h2 className="section-label">Bootstrap (paired diff)</h2>
                <pre className="rounded-none bg-slate-50/80 border border-slate-200 p-4 text-xs overflow-x-auto whitespace-pre -mt-1">
                  {JSON.stringify(results.bootstrap, null, 2)}
                </pre>
              </div>
            ) : null}
            {results.figures?.length > 0 && (
              <div className="card">
                <h2 className="section-label">Figures</h2>
                <div className="flex flex-wrap gap-4 -mt-1">
                  {results.figures.map((name) => (
                    <figure key={name}>
                      <img
                        src={`/api/evaluation/figures/${encodeURIComponent(name)}`}
                        alt={name}
                        className="max-w-full border border-slate-200 rounded-lg"
                      />
                      <figcaption className="text-xs text-slate-500 mt-1">{name}</figcaption>
                    </figure>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </PageMotion>
  );
}
