import { NextRequest, NextResponse } from 'next/server';
import { getOrCreateUserByEmail, setSession } from '@/lib/auth';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({ email: z.string().email() });

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
  }
  const user = await getOrCreateUserByEmail(parsed.data.email);
  await setSession(user.id);
  return NextResponse.json({ ok: true, email: user.email });
}
