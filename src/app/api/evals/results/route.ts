import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const suiteId = searchParams.get('suiteId') ?? undefined;
  const versionTag = searchParams.get('versionTag') ?? undefined;
  const results = await prisma.evalResult.findMany({
    where: {
      ...(suiteId ? { case: { suiteId } } : {}),
      ...(versionTag ? { run: { versionTag } } : {}),
    },
    include: {
      case: { select: { id: true, inputText: true, taskType: true, suiteId: true } },
      run: { select: { id: true, versionTag: true, latencyMs: true } },
    },
    orderBy: { caseId: 'asc' },
    take: 500,
  });
  const byVersion = new Map<string, { pass: number; fail: number; total: number; latencyAvg: number }>();
  for (const r of results) {
    const v = r.run.versionTag ?? 'unknown';
    if (!byVersion.has(v)) byVersion.set(v, { pass: 0, fail: 0, total: 0, latencyAvg: 0 });
    const stat = byVersion.get(v)!;
    stat.total++;
    if (r.passFail) stat.pass++; else stat.fail++;
    stat.latencyAvg = (stat.latencyAvg * (stat.total - 1) + (r.run.latencyMs ?? 0)) / stat.total;
  }
  return NextResponse.json({ results, byVersion: Object.fromEntries(byVersion) });
}
