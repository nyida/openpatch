import { error, json } from '@/lib/auth/http';
import { requireAuth } from '@/lib/auth/requireAuth';
import { getStripe } from '@/lib/auth/stripe';
import { upgradeToPro } from '@/lib/auth/store';

export const runtime = 'nodejs';

/** After Stripe redirects back, confirm the session and upgrade if paid. */
export async function POST(request: Request) {
  const auth = await requireAuth(request);
  if (auth instanceof Response) return auth;

  if (auth.user.tier === 'pro') {
    return json({ user: auth.user, upgraded: false });
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return error('Stripe is not configured', 503);
  }

  const body = (await request.json().catch(() => ({}))) as {
    sessionId?: string;
  };
  if (!body.sessionId) {
    return error('sessionId is required', 400);
  }

  const stripe = getStripe();
  const session = await stripe.checkout.sessions.retrieve(body.sessionId);
  const userId =
    session.metadata?.userId || session.client_reference_id || undefined;

  if (userId !== auth.user.id) {
    return error('Session does not match this account', 403);
  }

  // Only upgrade when Stripe confirms payment for this checkout
  if (
    session.payment_status === 'paid' ||
    (session.status === 'complete' && session.payment_status !== 'unpaid')
  ) {
    const profile = await upgradeToPro(
      auth.user.id,
      typeof session.customer === 'string' ? session.customer : undefined,
      typeof session.subscription === 'string' ? session.subscription : undefined,
    );
    return json({ user: profile, upgraded: true });
  }

  return json({ user: auth.user, upgraded: false, status: session.status });
}
