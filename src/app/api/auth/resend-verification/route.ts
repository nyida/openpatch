import { issueAndSendVerificationEmail } from '@/lib/auth/email';
import { error, json } from '@/lib/auth/http';
import { clientIp, rateLimit } from '@/lib/auth/rateLimit';
import { requireAuth } from '@/lib/auth/requireAuth';
import { findUserById } from '@/lib/auth/store';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const auth = await requireAuth(request);
  if (auth instanceof Response) return auth;

  const ip = clientIp(request);
  const rl = rateLimit(`resend-verify:${auth.user.id}`, 5, 60_000);
  if (!rl.allowed) return error('Too many emails. Wait a minute and try again.', 429);

  try {
    const user = await findUserById(auth.user.id);
    if (!user) return error('User not found', 404);
    if (user.emailVerified || user.passwordHash.startsWith('oauth:')) {
      return json({ alreadyVerified: true });
    }

    const mail = await issueAndSendVerificationEmail({
      userId: user.id,
      email: user.email,
      displayName: user.displayName,
    });

    return json({
      sent: mail.sent,
      ...(mail.error ? { emailError: mail.error } : null),
      ...(mail.verifyUrl && process.env.NODE_ENV !== 'production'
        ? { verifyPreview: mail.verifyUrl }
        : null),
    });
  } catch (err) {
    console.error('resend-verification', err);
    return error('Could not send verification email', 500);
  }
}
