import { Resend } from 'resend';
import { randomBytes } from 'crypto';
import { setVerificationToken } from './store';

const VERIFY_TTL_MS = 1000 * 60 * 60 * 24; // 24h

function appOrigin(): string {
  return (
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.RENDER_EXTERNAL_URL ||
    'http://localhost:3000'
  ).replace(/\/$/, '');
}

function fromAddress(): string {
  return process.env.EMAIL_FROM || 'Algomarket <noreply@algomarket.lol>';
}

function resendClient(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

export function createRawVerifyToken(): string {
  return randomBytes(32).toString('hex');
}

export type SendVerificationResult = {
  sent: boolean;
  verifyUrl: string;
  preview?: boolean;
  error?: string;
};

export async function issueAndSendVerificationEmail(input: {
  userId: string;
  email: string;
  displayName: string;
}): Promise<SendVerificationResult> {
  const raw = createRawVerifyToken();
  const expires = new Date(Date.now() + VERIFY_TTL_MS);
  await setVerificationToken(input.userId, raw, expires);

  const verifyUrl = `${appOrigin()}/verify?token=${encodeURIComponent(raw)}`;
  const client = resendClient();

  if (!client) {
    console.info(
      `[auth] RESEND_API_KEY not set — verification link for ${input.email}:\n${verifyUrl}`,
    );
    return { sent: false, verifyUrl, preview: true };
  }

  const { error } = await client.emails.send({
    from: fromAddress(),
    to: input.email,
    subject: 'Verify your Algomarket email',
    html: verificationHtml({
      name: input.displayName,
      verifyUrl,
    }),
    text: `Hi ${input.displayName},\n\nConfirm your Algomarket email:\n${verifyUrl}\n\nThis link expires in 24 hours.`,
  });

  if (error) {
    const msg =
      typeof error === 'object' && error && 'message' in error
        ? String((error as { message: string }).message)
        : 'EMAIL_SEND_FAILED';
    console.error('[auth] Resend error', error);
    console.info(`[auth] verification link (email failed) for ${input.email}:\n${verifyUrl}`);
    return { sent: false, verifyUrl, error: msg };
  }

  return { sent: true, verifyUrl };
}

function verificationHtml(p: { name: string; verifyUrl: string }) {
  return `<!DOCTYPE html>
<html>
<body style="font-family: system-ui, sans-serif; background:#0c0b0a; color:#f5f2eb; padding:32px;">
  <div style="max-width:480px;margin:0 auto;background:#161412;border:1px solid #2a2622;border-radius:12px;padding:28px;">
    <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;opacity:0.55;">Algomarket</p>
    <h1 style="margin:0 0 12px;font-size:22px;font-weight:600;">Confirm your email</h1>
    <p style="margin:0 0 20px;font-size:14px;line-height:1.5;opacity:0.85;">
      Hi ${escapeHtml(p.name)}, click below to verify your account and unlock the desk.
    </p>
    <a href="${p.verifyUrl}"
       style="display:inline-block;background:#f5f2eb;color:#0c0b0a;text-decoration:none;font-weight:600;font-size:13px;padding:12px 18px;border-radius:6px;">
      Verify email
    </a>
    <p style="margin:24px 0 0;font-size:12px;line-height:1.5;opacity:0.5;">
      Link expires in 24 hours. If you did not create an account, ignore this email.
    </p>
  </div>
</body>
</html>`;
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
