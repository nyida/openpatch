import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const messageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string(),
  runId: z.string().optional(),
});

const postSchema = z.object({
  conversationId: z.string().optional(),
  title: z.string().optional(),
  messages: z.array(messageSchema),
});

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json([]);
    const conversations = await prisma.conversation.findMany({
      where: { userId: session.id },
      orderBy: { updatedAt: 'desc' },
      take: 50,
      select: { id: true, title: true, updatedAt: true },
    });
    return NextResponse.json(conversations);
  } catch (e: unknown) {
    console.error('List chats failed', e);
    const err = e as { code?: string; message?: string };
    if (err.code === 'P2021') {
      return NextResponse.json(
        { error: 'Conversation table missing. Run: npx prisma db push' },
        { status: 503 }
      );
    }
    if (err.code === 'P1001' || err.code === 'P1017') {
      return NextResponse.json(
        { error: 'Database connection failed. Check DATABASE_URL and that the database is running.' },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: 'Failed to list chats' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    const body = await req.json();
    const parsed = postSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const { conversationId, title, messages } = parsed.data;
    const titleToUse = title ?? (messages[0]?.role === 'user' ? messages[0].content.slice(0, 80) : 'Chat');

    if (conversationId) {
      const existing = await prisma.conversation.findUnique({
        where: { id: conversationId },
        select: { userId: true },
      });
      if (!existing) return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
      if (existing.userId && existing.userId !== session?.id) {
        return NextResponse.json({ error: 'Not authorized to update this conversation' }, { status: 403 });
      }
      if (!session && existing.userId) {
        return NextResponse.json({ error: 'Log in to update this conversation' }, { status: 401 });
      }
      const updated = await prisma.conversation.update({
        where: { id: conversationId },
        data: {
          messages,
          title: titleToUse,
          updatedAt: new Date(),
          ...(session && !existing.userId ? { userId: session.id } : {}),
        },
      });
      return NextResponse.json(updated);
    }
    const created = await prisma.conversation.create({
      data: {
        title: titleToUse,
        messages,
        userId: session?.id ?? null,
      },
    });
    return NextResponse.json(created);
  } catch (e: unknown) {
    console.error('Save chat failed', e);
    const err = e as { code?: string };
    if (err.code === 'P2021') {
      return NextResponse.json(
        { error: 'Conversation table missing. Run: npx prisma db push' },
        { status: 503 }
      );
    }
    if (err.code === 'P1001' || err.code === 'P1017') {
      return NextResponse.json(
        { error: 'Database connection failed. Check DATABASE_URL and that the database is running.' },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: 'Failed to save chat' }, { status: 500 });
  }
}
