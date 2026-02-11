import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const suites = await prisma.evalSuite.findMany({
    include: { cases: { select: { id: true, taskType: true } } },
  });
  return NextResponse.json({ suites });
}
