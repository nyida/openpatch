import Link from 'next/link';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { RunsList } from './RunsList';
import { PageMotion } from '@/components/PageMotion';

export const dynamic = 'force-dynamic';

export default async function RunsPage() {
  const session = await getSession();
  const runs = await prisma.run.findMany({
    where: session ? { userId: session.id } : { id: { in: [] } },
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
      {!session && (
        <div className="card max-w-md border-amber-200/80 bg-amber-50/30 rounded-xl mb-6">
          <p className="text-slate-700 text-sm">Sign in to view your run traces.</p>
          <Link href="/auth" className="text-teal-600 hover:text-teal-700 text-sm font-medium mt-2 inline-block">Sign in</Link>
        </div>
      )}
      <RunsList runs={runs} />
    </PageMotion>
  );
}
