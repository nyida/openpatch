export type SubscriptionTier = 'free' | 'pro';

export type UserProfile = {
  id: string;
  email: string;
  displayName: string;
  tier: SubscriptionTier;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  createdAt: string;
};

export type AuthUser = UserProfile & {
  passwordHash: string;
};

export const PRO_PRICE_LABEL = '$20/mo';
export const PRO_PRICE_AMOUNT = 2000;
