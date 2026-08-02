import { hashPassword, signToken } from '@/lib/auth/crypto';
import { error, json } from '@/lib/auth/http';
import { clientIp, rateLimit } from '@/lib/auth/rateLimit';
import { createUser, findUserByEmail } from '@/lib/auth/store';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const ip = clientIp(request);
  const rl = rateLimit(`signup:${ip}`, 8, 60_000);
  if (!rl.allowed) return error('Too many attempts. Try again shortly.', 429);

  try {
    const body = await request.json();
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    const displayName = String(body.displayName || '').trim();

    if (!email || !email.includes('@')) {
      return error('Enter a valid email', 400, { code: 'INVALID_EMAIL' });
    }
    if (password.length < 8) {
      return error('Password must be at least 8 characters', 400, {
        code: 'WEAK_PASSWORD',
      });
    }
    if (await findUserByEmail(email)) {
      return error('An account with that email already exists', 409, {
        code: 'EMAIL_TAKEN',
      });
    }

    const user = await createUser({
      email,
      passwordHash: hashPassword(password),
      displayName: displayName || undefined,
    });
    const token = signToken({ sub: user.id, email: user.email });
    const { passwordHash: _, ...profile } = user;
    return json({ token, user: profile });
  } catch (err) {
    if (err instanceof Error && /already registered/i.test(err.message)) {
      return error('An account with that email already exists', 409, {
        code: 'EMAIL_TAKEN',
      });
    }
    console.error('signup', err);
    return error('Could not create account', 500);
  }
}
