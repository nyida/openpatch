import { prisma } from '@/lib/db';
import { RunsList } from './RunsList';

export const dynamic = 'force-dynamic';

export default async function RunsPage() {
  const runs = await prisma.run.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: {
      id: true,
      createdAt: true,
      inputText: true,
      taskType: true,
      versionTag: true,
      latencyMs: true,
      reliability: true,
    },
  });
  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <div className="mb-10">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Runs</h1>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">v1</span>
        </div>
        <p className="text-slate-600 mt-1 text-sm">Inspect traces and reliability for each run.</p>
      </div>
      <RunsList runs={runs} />
    </div>
  );
}
