import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    const { id } = await params;
    const conversation = await prisma.conversation.findUnique({
      where: { id },
      select: { id: true, title: true, messages: true, updatedAt: true, userId: true },
    });
    if (!conversation) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    if (conversation.userId && conversation.userId !== session?.id) {
      return NextResponse.json({ error: 'Not authorized to view this conversation' }, { status: 403 });
    }
    const { userId: _u, ...rest } = conversation;
    return NextResponse.json(rest);
  } catch (e) {
    console.error('Get chat failed', e);
    return NextResponse.json({ error: 'Failed to load chat' }, { status: 500 });
  }
}
