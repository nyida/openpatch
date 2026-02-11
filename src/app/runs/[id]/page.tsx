import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import Link from 'next/link';
import { DeleteRunButton } from './DeleteRunButton';
import { ReliabilityReport } from '@/components/ReliabilityReport';

export const dynamic = 'force-dynamic';

export default async function RunTracePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const run = await prisma.run.findUnique({
    where: { id },
    include: {
      attachments: true,
      retrievalChunks: true,
      candidates: { include: { verifications: true } },
      judgeDecision: true,
    },
  });
  if (!run) notFound();

  const reliability = run.reliability as Record<string, unknown> | null;
  const judge = run.judgeDecision;

  return (
    <div className="max-w-4xl mx-auto px-4 py-10 space-y-8">
      <div className="flex items-center justify-between">
        <Link
          href="/runs"
          className="text-sm font-medium text-teal-600 hover:text-teal-700 transition-colors inline-flex items-center gap-1"
        >
          <span aria-hidden>←</span> Back to Runs
        </Link>
        <DeleteRunButton runId={id} />
      </div>

      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Trace</h1>
        <p className="text-sm text-slate-500 mt-1 font-mono break-all">{id}</p>
      </div>

      <section className="card">
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Input</h2>
        <p className="text-slate-800 whitespace-pre-wrap leading-relaxed">{run.inputText}</p>
        <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
          <span>{run.taskType}</span>
          <span>Version: {run.versionTag ?? '—'}</span>
          {run.latencyMs != null && <span>{run.latencyMs}ms</span>}
        </div>
      </section>

      {run.attachments.length > 0 && (
        <section className="card">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Attachments</h2>
          <ul className="text-sm text-slate-700 space-y-1">
            {run.attachments.map((a) => (
              <li key={a.id}>{a.originalName}</li>
            ))}
          </ul>
        </section>
      )}

      {run.retrievalChunks.length > 0 && (
        <section className="card">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
            Retrieval ({run.retrievalChunks.length} chunks)
          </h2>
          <div className="space-y-2 max-h-64 overflow-auto">
            {run.retrievalChunks.slice(0, 10).map((c) => (
              <div
                key={c.id}
                className="text-sm bg-slate-50 rounded-lg p-3 border border-slate-100"
              >
                <span className="text-xs text-slate-500">score {c.score.toFixed(3)}</span>
                <p className="text-slate-700 mt-1 line-clamp-2">{c.text}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="card">
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Candidates</h2>
        <div className="space-y-4">
          {run.candidates.map((c) => (
            <div
              key={c.id}
              className="rounded-xl border border-slate-200 p-4 bg-slate-50/50"
            >
              <p className="text-xs font-medium text-slate-500">{c.modelName} · {c.latencyMs ?? 0}ms</p>
              <p className="text-slate-800 mt-2 whitespace-pre-wrap text-sm leading-relaxed">
                {c.outputText.slice(0, 800)}
                {c.outputText.length > 800 && '…'}
              </p>
              <div className="mt-3 pt-3 border-t border-slate-200">
                <p className="text-xs font-medium text-slate-500 mb-1">Verifications</p>
                <ul className="flex flex-wrap gap-2">
                  {c.verifications.map((v) => (
                    <li
                      key={v.id}
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        v.passFail ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      {v.type}: {v.passFail ? 'pass' : 'fail'}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </section>

      {judge && (
        <section className="card">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Judge</h2>
          <p className="text-slate-800 leading-relaxed">{judge.rationaleText}</p>
          {judge.rubricScoresJson && typeof judge.rubricScoresJson === 'object' && (
            <div className="mt-3 p-3 bg-slate-50 rounded-lg text-xs font-mono text-slate-600">
              {JSON.stringify(judge.rubricScoresJson, null, 2)}
            </div>
          )}
        </section>
      )}

      <section className="card">
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Final answer</h2>
        <p className="text-slate-800 whitespace-pre-wrap leading-relaxed">{run.finalAnswer ?? '—'}</p>
      </section>

      {reliability && (
        <section className="card">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Reliability</h2>
          <ReliabilityReport data={reliability as import('@/components/ReliabilityReport').ReliabilityData} />
        </section>
      )}
    </div>
  );
}
