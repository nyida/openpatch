import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { executeRun } from '@/lib/pipeline/run';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  inputText: z.string().min(1).max(50000),
  urls: z.array(z.string().url()).optional(),
  attachmentIds: z.array(z.string()).optional(),
  conversationHistory: z.array(z.object({ role: z.string(), content: z.string() })).optional(),
  improvedMode: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    const body = await req.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const result = await executeRun({
      ...parsed.data,
      userId: session?.id,
      improvedMode: parsed.data.improvedMode,
    });
    return NextResponse.json(result);
  } catch (e) {
    console.error('Run failed', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Run failed' },
      { status: 500 }
    );
  }
}
