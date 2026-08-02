import Stripe from 'stripe';
import { PRO_PRICE_AMOUNT } from './types';

let stripe: Stripe | null = null;

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error('STRIPE_SECRET_KEY is not configured');
  }
  if (key.startsWith('rk_')) {
    console.warn(
      '[stripe] STRIPE_SECRET_KEY looks like a restricted key (rk_). Checkout usually needs a secret key (sk_test_… or sk_live_…).',
    );
  }
  if (!stripe) {
    stripe = new Stripe(key, { typescript: true });
  }
  return stripe;
}

export { PRO_PRICE_AMOUNT };
export const PRO_PRICE_ID = process.env.STRIPE_PRICE_ID || '';
