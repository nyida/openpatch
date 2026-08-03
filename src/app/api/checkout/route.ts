import type Stripe from 'stripe';
import { error, json } from '@/lib/auth/http';
import { clientIp, rateLimit } from '@/lib/auth/rateLimit';
import { requireAuth } from '@/lib/auth/requireAuth';
import { getStripe, PRO_PRICE_AMOUNT, PRO_PRICE_ID } from '@/lib/auth/stripe';
import { upgradeToPro } from '@/lib/auth/store';

export const runtime = 'nodejs';

function allowDevSubscribe(): boolean {
  if (process.env.ALLOW_DEV_SUBSCRIBE !== '1') return false;
  // Never allow free Pro upgrades on Render / production
  if (process.env.NODE_ENV === 'production') return false;
  if (process.env.RENDER === 'true' || process.env.RENDER_SERVICE_ID) return false;
  return true;
}

function defaultAppOrigin(): string {
  return (
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.RENDER_EXTERNAL_URL ||
    'http://localhost:3000'
  ).replace(/\/$/, '');
}

/**
 * Create Stripe Checkout for Algomarket Pro.
 * Uses the same Stripe account / price as AuditGPT when STRIPE_PRICE_ID is set.
 * ALLOW_DEV_SUBSCRIBE only works locally (never on Render).
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

  if (!user.emailVerified) {
    return error('Verify your email before upgrading to Pro', 403, {
      code: 'EMAIL_UNVERIFIED',
    });
  }

  const body = (await request.json().catch(() => ({}))) as {
    successUrl?: string;
    cancelUrl?: string;
  };

  if (!process.env.STRIPE_SECRET_KEY) {
    if (allowDevSubscribe()) {
      await upgradeToPro(user.id);
      return json({
        alreadyPro: true,
        url: null,
        sessionId: null,
        dev: true,
      });
    }
    return error(
      'Stripe is not configured. Set STRIPE_SECRET_KEY and STRIPE_PRICE_ID on Render.',
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

  const origin = defaultAppOrigin();
  const rawSuccess =
    body.successUrl ||
    process.env.STRIPE_SUCCESS_URL ||
    `${origin}/paywall?success=1`;
  const successUrl = rawSuccess.includes('{CHECKOUT_SESSION_ID}')
    ? rawSuccess
    : `${rawSuccess}${rawSuccess.includes('?') ? '&' : '?'}session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl =
    body.cancelUrl ||
    process.env.STRIPE_CANCEL_URL ||
    `${origin}/paywall?canceled=1`;

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
                'Cross-venue arbs, live whale flow, and market exposure.',
            },
          },
          quantity: 1,
        },
      ];

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer_email: user.email,
    client_reference_id: user.id,
    metadata: {
      userId: user.id,
      product: 'algomarket',
      app: 'algomarket',
    },
    line_items: lineItems,
    success_url: successUrl,
    cancel_url: cancelUrl,
    subscription_data: {
      metadata: {
        userId: user.id,
        product: 'algomarket',
        app: 'algomarket',
      },
    },
  });

  return json({
    sessionId: session.id,
    url: session.url,
    amount: PRO_PRICE_AMOUNT,
  });
}
