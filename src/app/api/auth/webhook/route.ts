import { error, json } from '@/lib/auth/http';
import { getStripe } from '@/lib/auth/stripe';
import { setTier, upgradeToPro } from '@/lib/auth/store';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    if (!request.headers.get('stripe-signature')) {
      return error('Missing stripe-signature header', 400);
    }
    return await handleStripe(request);
  } catch (err) {
    console.error('webhook error', err);
    const msg = err instanceof Error ? err.message : 'Webhook processing failed';
    if (/signature|StripeSignature/i.test(msg)) {
      return error('Invalid Stripe signature', 400);
    }
    return error('Webhook processing failed', 500);
  }
}

async function handleStripe(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = request.headers.get('stripe-signature');

  if (!secret) {
    return error('STRIPE_WEBHOOK_SECRET is not configured', 503, {
      code: 'WEBHOOK_SECRET_MISSING',
    });
  }
  if (!signature) {
    return error('Missing stripe-signature header', 400);
  }

  const stripe = getStripe();
  const raw = await request.text();
  const event = stripe.webhooks.constructEvent(raw, signature, secret);

  const obj = event.data.object as unknown as Record<string, unknown>;

  switch (event.type) {
    case 'checkout.session.completed': {
      const userId =
        (obj.metadata as { userId?: string } | undefined)?.userId ||
        (obj.client_reference_id as string | undefined);
      const customerId = obj.customer as string | undefined;
      const subscriptionId = obj.subscription as string | undefined;
      if (userId) {
        await upgradeToPro(userId, customerId, subscriptionId);
      }
      break;
    }
    case 'customer.subscription.deleted': {
      const userId = (obj.metadata as { userId?: string } | undefined)?.userId;
      if (userId) await setTier(userId, 'free');
      break;
    }
    default:
      break;
  }

  return json({ received: true });
}
