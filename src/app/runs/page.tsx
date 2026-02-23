import { prisma } from '@/lib/db';
import { RunsList } from './RunsList';
import { PageMotion } from '@/components/PageMotion';

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
    <PageMotion className="max-w-4xl mx-auto px-4 py-10">
      <div className="mb-10">
        <div className="flex items-center gap-3">
          <h1 className="page-title">Runs</h1>
          <span className="badge text-slate-500 bg-slate-100/90">v1</span>
        </div>
        <p className="page-subtitle">Inspect traces and reliability for each run.</p>
      </div>
      <RunsList runs={runs} />
    </PageMotion>
  );
}
