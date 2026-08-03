export type SubscriptionTier = 'free' | 'pro';

export type UserProfile = {
  id: string;
  email: string;
  displayName: string;
  tier: SubscriptionTier;
  /** False until email link confirmed. Google/Apple users are always verified. */
  emailVerified: boolean;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  createdAt: string;
};

export type AuthUser = UserProfile & {
  passwordHash: string;
  /** SHA-256 hex of the raw verification token (never store plaintext). */
  emailVerifyTokenHash?: string;
  emailVerifyExpiresAt?: string;
};

export const PRO_PRICE_LABEL = '$20/mo';
export const PRO_PRICE_AMOUNT = 2000;
