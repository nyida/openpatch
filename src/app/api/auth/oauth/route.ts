import { signToken } from '@/lib/auth/crypto';
import { error, json } from '@/lib/auth/http';
import { verifyAppleIdToken, verifyGoogleIdToken } from '@/lib/auth/oauth';
import { clientIp, rateLimit } from '@/lib/auth/rateLimit';
import {
  createUser,
  findUserByEmail,
  markEmailVerified,
  toPublicUser,
} from '@/lib/auth/store';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const ip = clientIp(request);
  const rl = rateLimit(`oauth:${ip}`, 20, 60_000);
  if (!rl.allowed) return error('Too many attempts. Try again shortly.', 429);

  try {
    const body = await request.json();
    const provider = String(body.provider || '') as 'google' | 'apple';
    const idToken = String(body.idToken || '');
    const emailHint = body.email
      ? String(body.email).trim().toLowerCase()
      : undefined;
    const displayName = body.displayName
      ? String(body.displayName).trim()
      : undefined;

    if (!idToken) return error('idToken is required', 400);
    if (provider !== 'google' && provider !== 'apple') {
      return error('provider must be google or apple', 400);
    }

    if (
      (process.env.ALLOW_DEV_OAUTH === '1' ||
        process.env.NODE_ENV !== 'production') &&
      (idToken === 'dev-google' || idToken === 'dev-apple')
    ) {
      const email =
        emailHint ||
        (provider === 'google'
          ? 'google.dev@algomarket.app'
          : 'apple.dev@algomarket.app');
      return await issueSession(email, displayName || 'Dev User', provider);
    }

    const profile =
      provider === 'google'
        ? await verifyGoogleIdToken(idToken)
        : await verifyAppleIdToken(idToken, emailHint, displayName);

    return await issueSession(
      profile.email,
      displayName || profile.name,
      provider,
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'OAUTH_FAILED';
    console.error('oauth', msg, err);
    if (msg.includes('GOOGLE') || msg.includes('APPLE') || msg.includes('INVALID')) {
      return error('Could not verify social sign-in. Try again.', 401, {
        code: msg,
      });
    }
    return error('Social sign-in failed', 500);
  }
}

async function issueSession(
  emailRaw: string,
  displayName: string | undefined,
  provider: 'google' | 'apple',
) {
  const email = emailRaw.trim().toLowerCase();
  let user = await findUserByEmail(email);
  if (!user) {
    user = await createUser({
      email,
      passwordHash: `oauth:${provider}`,
      displayName: displayName || email.split('@')[0],
      emailVerified: true,
    });
  } else if (!user.emailVerified) {
    await markEmailVerified(user.id);
    user = (await findUserByEmail(email))!;
  }

  const token = signToken({ sub: user.id, email: user.email });
  return json({ token, user: toPublicUser(user), provider });
}
