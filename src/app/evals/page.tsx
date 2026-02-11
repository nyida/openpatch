import { prisma } from '@/lib/db';
import { EvalsClient } from './EvalsClient';

export const dynamic = 'force-dynamic';

export default async function EvalsPage() {
  const [suites, results] = await Promise.all([
    prisma.evalSuite.findMany({ include: { cases: true } }),
    prisma.evalResult.findMany({
      include: { run: { select: { versionTag: true, latencyMs: true } }, case: { select: { taskType: true } } },
      orderBy: { caseId: 'asc' },
      take: 300,
    }),
  ]);
  const byVersion = new Map<string, { pass: number; fail: number; total: number }>();
  for (const r of results) {
    const v = r.run.versionTag ?? 'unknown';
    if (!byVersion.has(v)) byVersion.set(v, { pass: 0, fail: 0, total: 0 });
    const s = byVersion.get(v)!;
    s.total++;
    if (r.passFail) s.pass++; else s.fail++;
  }
  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <div className="mb-8">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Eval harness</h1>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">v1</span>
        </div>
        <p className="text-slate-600 mt-1 text-sm">
          Run the test suite and compare results across versions for regression tracking.
        </p>
      </div>
      <EvalsClient
        suites={suites.map((s) => ({ id: s.id, name: s.name, description: s.description, caseCount: s.cases.length }))}
        byVersion={Object.fromEntries(byVersion)}
        recentResults={results.slice(0, 50).map((r) => ({
          caseId: r.caseId,
          runId: r.runId,
          passFail: r.passFail,
          versionTag: r.run.versionTag,
          taskType: r.case.taskType,
        }))}
      />
    </div>
  );
}
