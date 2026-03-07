import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  const { id } = await params;
  const run = await prisma.run.findUnique({
    where: { id },
    include: {
      attachments: true,
      retrievalChunks: true,
      candidates: {
        include: { verifications: true },
      },
      judgeDecision: true,
    },
  });
  if (!run) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (run.userId && run.userId !== session?.id) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
  }
  return NextResponse.json(run);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  const { id } = await params;
  const run = await prisma.run.findUnique({ where: { id }, select: { userId: true } });
  if (!run) return NextResponse.json({ ok: true });
  if (run.userId && run.userId !== session?.id) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
  }
  await prisma.run.delete({ where: { id } }).catch(() => null);
  return NextResponse.json({ ok: true });
}
