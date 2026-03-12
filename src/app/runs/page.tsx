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
          <span className="badge text-[var(--text-muted)] bg-[var(--bg-subtle)]">v1</span>
        </div>
        <p className="page-subtitle">Inspect traces and reliability for each run.</p>
      </div>
      {!session && (
        <div className="card max-w-md border-[var(--border)] mb-6">
          <p className="text-slate-700 text-sm">Log in to view your run traces.</p>
          <Link href="/auth" className="btn-primary mt-3 inline-block">Log in</Link>
        </div>
      )}
      <RunsList runs={runs} />
    </PageMotion>
  );
}
