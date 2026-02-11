import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
  return NextResponse.json(run);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await prisma.run.delete({ where: { id } }).catch(() => null);
  return NextResponse.json({ ok: true });
}
