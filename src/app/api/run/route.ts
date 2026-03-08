import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { executeRun } from '@/lib/pipeline/run';
import { z } from 'zod';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 min for multi-candidate LLM pipeline

const bodySchema = z.object({
  inputText: z.string().min(1).max(50000),
  urls: z.array(z.string().url()).optional(),
  attachmentIds: z.array(z.string()).optional(),
  attachments: z.array(z.object({ id: z.string(), name: z.string() })).optional(),
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
    const { attachmentIds, attachments, ...rest } = parsed.data;
    const effectiveAttachmentIds = attachments?.map((a) => a.id) ?? attachmentIds ?? [];
    const attachmentNames = attachments ? Object.fromEntries(attachments.map((a) => [a.id, a.name])) : undefined;
    const result = await executeRun({
      ...rest,
      attachmentIds: effectiveAttachmentIds,
      attachmentNames,
      userId: session?.id,
      improvedMode: parsed.data.improvedMode,
    });
    return NextResponse.json(result);
  } catch (e) {
    console.error('Run failed', e);
    const msg = e instanceof Error ? e.message : 'Run failed';
    const isConfigError =
      msg.includes('DATABASE_URL') ||
      msg.includes('No LLM configured') ||
      msg.includes('No embed model') ||
      msg.includes('Supabase not configured');
    const error = isConfigError ? `${msg} Visit /setup to configure.` : msg;
    return NextResponse.json({ error }, { status: isConfigError ? 503 : 500 });
  }
}
