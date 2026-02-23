import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const conversation = await prisma.conversation.findUnique({
      where: { id },
      select: { id: true, title: true, messages: true, updatedAt: true },
    });
    if (!conversation) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json(conversation);
  } catch (e) {
    console.error('Get chat failed', e);
    return NextResponse.json({ error: 'Failed to load chat' }, { status: 500 });
  }
}
