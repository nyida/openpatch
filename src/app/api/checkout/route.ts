import type Stripe from 'stripe';
import { error, json } from '@/lib/auth/http';
import { clientIp, rateLimit } from '@/lib/auth/rateLimit';
import { requireAuth } from '@/lib/auth/requireAuth';
import { getStripe, PRO_PRICE_AMOUNT, PRO_PRICE_ID } from '@/lib/auth/stripe';
import { upgradeToPro } from '@/lib/auth/store';

export const runtime = 'nodejs';

/**
 * Create Stripe Checkout for Algomarket Pro.
 * If Stripe is not configured and ALLOW_DEV_SUBSCRIBE=1, instantly upgrades (local only).
 */
export async function POST(request: Request) {
  const ip = clientIp(request);
  const rl = rateLimit(`checkout:${ip}`, 10, 60_000);
  if (!rl.allowed) return error('Rate limit exceeded', 429);

  const auth = await requireAuth(request);
  if (auth instanceof Response) return auth;

  const { user } = auth;
  if (user.tier === 'pro') {
    return json({ alreadyPro: true, url: null, sessionId: null });
  }

  const body = (await request.json().catch(() => ({}))) as {
    successUrl?: string;
    cancelUrl?: string;
  };

  if (!process.env.STRIPE_SECRET_KEY) {
    if (process.env.ALLOW_DEV_SUBSCRIBE === '1') {
      await upgradeToPro(user.id);
      return json({
        alreadyPro: true,
        url: null,
        sessionId: null,
        dev: true,
      });
    }
    return error(
      'Stripe is not configured. Set STRIPE_SECRET_KEY and optionally STRIPE_PRICE_ID.',
      503,
      { code: 'STRIPE_MISSING' },
    );
  }

  if (process.env.STRIPE_SECRET_KEY.startsWith('rk_')) {
    return error(
      'Stripe secret key must be a full secret key (sk_test_… / sk_live_…), not a restricted key (rk_…).',
      503,
      { code: 'STRIPE_RESTRICTED_KEY' },
    );
  }

  const rawSuccess =
    body.successUrl ||
    process.env.STRIPE_SUCCESS_URL ||
    'http://localhost:3000/paywall?success=1';
  const successUrl = rawSuccess.includes('{CHECKOUT_SESSION_ID}')
    ? rawSuccess
    : `${rawSuccess}${rawSuccess.includes('?') ? '&' : '?'}session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl =
    body.cancelUrl ||
    process.env.STRIPE_CANCEL_URL ||
    'http://localhost:3000/paywall?canceled=1';

  const stripe = getStripe();
  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = PRO_PRICE_ID
    ? [{ price: PRO_PRICE_ID, quantity: 1 }]
    : [
        {
          price_data: {
            currency: 'usd',
            unit_amount: PRO_PRICE_AMOUNT,
            recurring: { interval: 'month' },
            product_data: {
              name: 'Algomarket Pro',
              description:
                'Account billing for Algomarket - whale analytics, arbs, and screener stay available on free.',
            },
          },
          quantity: 1,
        },
      ];

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer_email: user.email,
    client_reference_id: user.id,
    metadata: { userId: user.id },
    line_items: lineItems,
    success_url: successUrl,
    cancel_url: cancelUrl,
    subscription_data: {
      metadata: { userId: user.id },
    },
  });

  return json({
    sessionId: session.id,
    url: session.url,
    amount: PRO_PRICE_AMOUNT,
  });
}
