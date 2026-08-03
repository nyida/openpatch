import { hashPassword, signToken } from '@/lib/auth/crypto';
import { issueAndSendVerificationEmail } from '@/lib/auth/email';
import { error, json } from '@/lib/auth/http';
import { clientIp, rateLimit } from '@/lib/auth/rateLimit';
import { createUser, findUserByEmail, toPublicUser } from '@/lib/auth/store';

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
      emailVerified: false,
    });

    let verifyUrl: string | undefined;
    let emailSent = false;
    let emailError: string | undefined;
    try {
      const mail = await issueAndSendVerificationEmail({
        userId: user.id,
        email: user.email,
        displayName: user.displayName,
      });
      verifyUrl = mail.verifyUrl;
      emailSent = mail.sent;
      emailError = mail.error;
    } catch (mailErr) {
      console.error('signup verification email', mailErr);
      emailError =
        mailErr instanceof Error ? mailErr.message : 'Could not send email';
    }

    const token = signToken({ sub: user.id, email: user.email });
    return json({
      token,
      user: toPublicUser(user),
      needsVerification: true,
      emailSent,
      ...(emailError ? { emailError } : null),
      ...(verifyUrl && process.env.NODE_ENV !== 'production'
        ? { verifyPreview: verifyUrl }
        : null),
    });
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
