import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await getSession();
  const { searchParams } = new URL(req.url);
  const taskType = searchParams.get('taskType') ?? undefined;
  const limit = Math.min(Number(searchParams.get('limit')) || 50, 100);
  const runs = await prisma.run.findMany({
    where: {
      ...(session ? { userId: session.id } : {}),
      ...(taskType ? { taskType } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      createdAt: true,
      inputText: true,
      taskType: true,
      versionTag: true,
      latencyMs: true,
      finalAnswer: true,
      reliability: true,
    },
  });
  return NextResponse.json({ runs });
}
