import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { executeRun } from '@/lib/pipeline/run';
import { runEvalCase } from '@/lib/evals/runner';
import { z } from 'zod';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const bodySchema = z.object({
  suiteId: z.string().optional(),
  caseIds: z.array(z.string()).optional(),
});

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = bodySchema.safeParse(body);
  const suiteId = parsed.success ? parsed.data.suiteId : undefined;
  const caseIds = parsed.success ? parsed.data.caseIds : undefined;
  const cases = caseIds?.length
    ? await prisma.evalCase.findMany({ where: { id: { in: caseIds } }, include: { suite: true } })
    : suiteId
      ? await prisma.evalCase.findMany({ where: { suiteId }, include: { suite: true } })
      : await prisma.evalCase.findMany({ include: { suite: true } });
  if (cases.length === 0) {
    return NextResponse.json({ error: 'No cases to run' }, { status: 400 });
  }
  const results: { caseId: string; runId: string; pass: boolean; metrics?: Record<string, unknown> }[] = [];
  for (const c of cases) {
    const runResult = await executeRun({
      inputText: c.inputText,
      attachmentIds: c.attachmentsRef ? [c.attachmentsRef] : undefined,
    });
    const run = await prisma.run.findUnique({ where: { id: runResult.runId } });
    const metrics = run ? runEvalCase(c, run, runResult) : null;
    const pass = (metrics?.pass ?? false) as boolean;
    await prisma.evalResult.create({
      data: { caseId: c.id, runId: runResult.runId, passFail: pass, metricsJson: (metrics ?? {}) as object },
    });
    results.push({ caseId: c.id, runId: runResult.runId, pass, metrics: metrics ?? undefined });
  }
  return NextResponse.json({ results });
}
