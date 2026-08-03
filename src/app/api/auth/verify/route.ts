import { error, json } from '@/lib/auth/http';
import { clientIp, rateLimit } from '@/lib/auth/rateLimit';
import { verifyEmailWithToken } from '@/lib/auth/store';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const ip = clientIp(request);
  const rl = rateLimit(`verify:${ip}`, 20, 60_000);
  if (!rl.allowed) return error('Too many attempts. Try again shortly.', 429);

  try {
    const body = await request.json().catch(() => ({}));
    const token = String(body.token || '').trim();
    if (!token || token.length < 16) {
      return error('Invalid verification link', 400, { code: 'BAD_TOKEN' });
    }

    const user = await verifyEmailWithToken(token);
    if (!user) {
      return error('This link is invalid or has expired. Request a new one.', 400, {
        code: 'TOKEN_EXPIRED',
      });
    }

    return json({ user, verified: true });
  } catch (err) {
    console.error('verify', err);
    return error('Could not verify email', 500);
  }
}
