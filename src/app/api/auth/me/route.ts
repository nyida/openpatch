import { json } from '@/lib/auth/http';
import { requireAuth } from '@/lib/auth/requireAuth';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const auth = await requireAuth(request);
  if (auth instanceof Response) return auth;
  return json({ user: auth.user });
}

export async function POST(request: Request) {
  return GET(request);
}
