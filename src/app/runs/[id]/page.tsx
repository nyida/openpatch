import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import Link from 'next/link';
import { DeleteRunButton } from './DeleteRunButton';
import { ReliabilityReport } from '@/components/ReliabilityReport';
import { MarkdownContent } from '@/components/MarkdownContent';

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
  const urlImages = run.urlImages as Record<string, string[]> | null;
  const sourceUrlsWithImages =
    urlImages && run.retrievalChunks.length > 0
      ? Array.from(new Set(run.retrievalChunks.map((c) => c.docId.replace(/_\d+$/, '')))).filter(
          (baseUrl) => urlImages[baseUrl]?.length
        )
      : [];

  const tavily = run.tavilySearchResults as {
    query?: string;
    results?: Array<{ title?: string; url?: string; content?: string }>;
    images?: Array<{ url?: string; description?: string }>;
  } | null;

  return (
    <div className="max-w-4xl mx-auto px-4 py-10 space-y-8">
      <div className="flex items-center justify-between">
        <Link
          href="/runs"
          className="text-sm font-medium text-teal-600 hover:text-teal-700 transition-colors inline-flex items-center gap-1.5"
        >
          <span aria-hidden>←</span> Back to Runs
        </Link>
        <DeleteRunButton runId={id} />
      </div>

      <div>
        <h1 className="page-title">Trace</h1>
        <p className="text-sm text-slate-500 mt-1 font-mono break-all">{id}</p>
      </div>

      <section className="card">
        <h2 className="section-label">Input</h2>
        <div className="text-slate-800 leading-relaxed">
          <MarkdownContent content={run.inputText} />
        </div>
        <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
          <span>{run.taskType}</span>
          <span>Version: {run.versionTag ?? '—'}</span>
          {run.latencyMs != null && <span>{run.latencyMs}ms</span>}
        </div>
      </section>

      {run.attachments.length > 0 && (
        <section className="card">
          <h2 className="section-label">Attachments</h2>
          <ul className="text-sm text-slate-700 space-y-1">
            {run.attachments.map((a) => (
              <li key={a.id}>{a.originalName}</li>
            ))}
          </ul>
        </section>
      )}

      {tavily && (tavily.results?.length || tavily.images?.length) && (
        <section className="card">
          <h2 className="section-label">Web search</h2>
          {tavily.results && tavily.results.length > 0 && (
            <ul className="space-y-2 mb-4">
              {tavily.results.map((r, i) => (
                <li key={i} className="text-sm">
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-teal-600 hover:text-teal-700 font-medium"
                  >
                    {r.title || r.url}
                  </a>
                  {r.content && <p className="text-slate-600 mt-0.5 line-clamp-2">{r.content}</p>}
                </li>
              ))}
            </ul>
          )}
          {tavily.images && tavily.images.length > 0 && (
            <div>
              <p className="text-xs text-slate-500 mb-2">Images from search</p>
              <div className="flex flex-wrap gap-2">
                {tavily.images.map((img, i) => (
                  <a
                    key={i}
                    href={img.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block rounded-none overflow-hidden border border-slate-200 hover:border-slate-400 transition-colors"
                  >
                    <img
                      src={img.url}
                      alt={img.description ?? ''}
                      className="h-24 w-auto object-cover max-w-[200px]"
                    />
                    {img.description && (
                      <p className="text-xs text-slate-500 p-1.5 max-w-[200px] line-clamp-2">{img.description}</p>
                    )}
                  </a>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {run.retrievalChunks.length > 0 && (
        <section className="card">
          <h2 className="section-label">
            Retrieval ({run.retrievalChunks.length} chunks)
          </h2>
          {sourceUrlsWithImages.length > 0 && (
            <div className="mb-4 space-y-3">
              {sourceUrlsWithImages.map((baseUrl) => (
                <div key={baseUrl}>
                  <p className="text-xs text-slate-500 mb-2 truncate" title={baseUrl}>
                    Images from page
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {(urlImages![baseUrl] ?? []).map((imgUrl) => (
                      <a
                        key={imgUrl}
                        href={imgUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block rounded-none overflow-hidden border border-slate-200 hover:border-slate-400 transition-colors"
                      >
                        <img
                          src={imgUrl}
                          alt=""
                          className="h-24 w-auto object-cover max-w-[200px]"
                        />
                      </a>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="space-y-2 max-h-64 overflow-auto">
            {run.retrievalChunks.slice(0, 10).map((c) => (
              <div
                key={c.id}
                className="text-sm bg-slate-50/80 rounded-none p-3.5 border border-slate-200/60"
              >
                <span className="text-xs text-slate-500">score {c.score.toFixed(3)}</span>
                <p className="text-slate-700 mt-1 line-clamp-2">{c.text}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="card">
        <h2 className="section-label">Candidates</h2>
        <div className="space-y-4">
          {run.candidates.map((c) => (
            <div
              key={c.id}
              className="rounded-none border border-slate-200/90 p-5 bg-slate-50/40"
            >
              <p className="text-xs font-medium text-slate-500">{c.modelName} · {c.latencyMs ?? 0}ms</p>
              <div className="text-slate-800 mt-2 text-sm leading-relaxed">
                <MarkdownContent content={c.outputText.length > 800 ? c.outputText.slice(0, 800) + '…' : c.outputText} />
              </div>
              <div className="mt-3 pt-3 border-t border-slate-200">
                <p className="text-xs font-medium text-slate-500 mb-1">Verifications</p>
                <ul className="flex flex-wrap gap-2">
                  {c.verifications.map((v) => (
                    <li
                      key={v.id}
                      className={`text-xs px-2.5 py-1 rounded-none font-medium ${
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
          <h2 className="section-label">Judge</h2>
          <div className="text-slate-800 leading-relaxed">
            <MarkdownContent content={judge.rationaleText} />
          </div>
          {judge.rubricScoresJson && typeof judge.rubricScoresJson === 'object' && (
            <div className="mt-3 p-3 bg-slate-50 rounded-none text-xs font-mono text-slate-600">
              {JSON.stringify(judge.rubricScoresJson, null, 2)}
            </div>
          )}
        </section>
      )}

      <section className="card">
        <h2 className="section-label">Final answer</h2>
        <div className="text-slate-800 leading-relaxed">
          <MarkdownContent content={run.finalAnswer ?? '—'} />
        </div>
      </section>

      {reliability && (
        <section className="card">
          <h2 className="section-label">Reliability</h2>
          <ReliabilityReport data={reliability as import('@/components/ReliabilityReport').ReliabilityData} />
        </section>
      )}
    </div>
  );
}
