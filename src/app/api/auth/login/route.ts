import { signToken, verifyPassword } from '@/lib/auth/crypto';
import { error, json } from '@/lib/auth/http';
import { clientIp, rateLimit } from '@/lib/auth/rateLimit';
import { findUserByEmail, toPublicUser } from '@/lib/auth/store';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const ip = clientIp(request);
  const rl = rateLimit(`login:${ip}`, 12, 60_000);
  if (!rl.allowed) return error('Too many attempts. Try again shortly.', 429);

  try {
    const body = await request.json();
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');

    if (!email || !password) {
      return error('Email and password are required', 400);
    }

    const user = await findUserByEmail(email);
    if (!user) {
      return error('Invalid email or password', 401, { code: 'BAD_CREDENTIALS' });
    }
    if (user.passwordHash.startsWith('oauth:')) {
      return error('This account uses Google sign-in', 400, {
        code: 'USE_OAUTH',
      });
    }
    if (!user.passwordHash || !verifyPassword(password, user.passwordHash)) {
      return error('Invalid email or password', 401, { code: 'BAD_CREDENTIALS' });
    }

    const token = signToken({ sub: user.id, email: user.email });
    return json({
      token,
      user: toPublicUser(user),
      needsVerification: !user.emailVerified,
    });
  } catch (err) {
    console.error('login', err);
    return error('Could not sign in', 500);
  }
}
