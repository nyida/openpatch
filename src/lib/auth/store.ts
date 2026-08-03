import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { createHash, randomUUID } from 'crypto';
import type { AuthUser, SubscriptionTier, UserProfile } from './types';
import { resolveDataDir } from '@/lib/paths';

type StoreFile = {
  users: AuthUser[];
};

function storePaths() {
  const dataDir = resolveDataDir();
  return {
    dataDir,
    storePath: path.join(dataDir, 'auth-store.json'),
  };
}

const usersById = new Map<string, AuthUser>();
const usersByEmail = new Map<string, AuthUser>();
let loaded = false;

function normalizeUser(raw: AuthUser): AuthUser {
  const oauth = raw.passwordHash?.startsWith('oauth:');
  const emailVerified = oauth
    ? true
    : typeof raw.emailVerified === 'boolean'
      ? raw.emailVerified
      : true; // grandfather pre-verification accounts
  return { ...raw, emailVerified };
}

function ensureLoaded() {
  if (loaded) return;
  loaded = true;
  const { storePath } = storePaths();
  try {
    if (!existsSync(storePath)) return;
    const raw = readFileSync(storePath, 'utf8');
    const parsed = JSON.parse(raw) as StoreFile;
    for (const u of parsed.users || []) {
      const user = normalizeUser(u);
      usersById.set(user.id, user);
      usersByEmail.set(user.email.toLowerCase(), user);
    }
  } catch {
    /* start empty */
  }
}

function persist() {
  const { dataDir, storePath } = storePaths();
  if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });
  const users = Array.from(usersById.values());
  writeFileSync(storePath, JSON.stringify({ users }, null, 2), 'utf8');
}

function toPublic(u: AuthUser): UserProfile {
  return {
    id: u.id,
    email: u.email,
    displayName: u.displayName,
    tier: u.tier,
    emailVerified: Boolean(u.emailVerified),
    stripeCustomerId: u.stripeCustomerId,
    stripeSubscriptionId: u.stripeSubscriptionId,
    createdAt: u.createdAt,
  };
}

export function hashVerifyToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function findUserById(id: string): Promise<AuthUser | null> {
  ensureLoaded();
  return usersById.get(id) || null;
}

export async function findUserByEmail(email: string): Promise<AuthUser | null> {
  ensureLoaded();
  return usersByEmail.get(email.toLowerCase()) || null;
}

export async function createUser(input: {
  email: string;
  passwordHash: string;
  displayName?: string;
  emailVerified?: boolean;
}): Promise<AuthUser> {
  ensureLoaded();
  const email = input.email.trim().toLowerCase();
  if (usersByEmail.has(email)) {
    throw new Error('Email already registered');
  }
  const oauth = input.passwordHash.startsWith('oauth:');
  const user: AuthUser = {
    id: randomUUID(),
    email,
    displayName: (input.displayName || email.split('@')[0] || 'Trader').trim(),
    passwordHash: input.passwordHash,
    emailVerified: input.emailVerified ?? oauth,
    tier: 'free',
    createdAt: new Date().toISOString(),
  };
  usersById.set(user.id, user);
  usersByEmail.set(email, user);
  persist();
  return user;
}

export function toPublicUser(u: AuthUser): UserProfile {
  return toPublic(u);
}

export async function getPublicUser(id: string): Promise<UserProfile | null> {
  const u = await findUserById(id);
  return u ? toPublic(u) : null;
}

export async function setVerificationToken(
  userId: string,
  rawToken: string,
  expiresAt: Date,
): Promise<void> {
  ensureLoaded();
  const user = usersById.get(userId);
  if (!user) throw new Error('User not found');
  user.emailVerifyTokenHash = hashVerifyToken(rawToken);
  user.emailVerifyExpiresAt = expiresAt.toISOString();
  usersById.set(userId, user);
  usersByEmail.set(user.email, user);
  persist();
}

export async function markEmailVerified(userId: string): Promise<UserProfile> {
  ensureLoaded();
  const user = usersById.get(userId);
  if (!user) throw new Error('User not found');
  user.emailVerified = true;
  delete user.emailVerifyTokenHash;
  delete user.emailVerifyExpiresAt;
  usersById.set(userId, user);
  usersByEmail.set(user.email, user);
  persist();
  return toPublic(user);
}

export async function verifyEmailWithToken(
  rawToken: string,
): Promise<UserProfile | null> {
  ensureLoaded();
  const hash = hashVerifyToken(rawToken);
  const now = Date.now();
  for (const user of usersById.values()) {
    if (!user.emailVerifyTokenHash || user.emailVerifyTokenHash !== hash) continue;
    if (
      user.emailVerifyExpiresAt &&
      new Date(user.emailVerifyExpiresAt).getTime() < now
    ) {
      return null;
    }
    return markEmailVerified(user.id);
  }
  return null;
}

export async function upgradeToPro(
  userId: string,
  stripeCustomerId?: string,
  stripeSubscriptionId?: string,
): Promise<UserProfile> {
  ensureLoaded();
  const profile = usersById.get(userId);
  if (!profile) throw new Error('User not found');
  profile.tier = 'pro';
  if (stripeCustomerId) profile.stripeCustomerId = stripeCustomerId;
  if (stripeSubscriptionId) profile.stripeSubscriptionId = stripeSubscriptionId;
  usersById.set(userId, profile);
  usersByEmail.set(profile.email, profile);
  persist();
  return toPublic(profile);
}

export async function setTier(
  userId: string,
  tier: SubscriptionTier,
): Promise<UserProfile> {
  ensureLoaded();
  const profile = usersById.get(userId);
  if (!profile) throw new Error('User not found');
  profile.tier = tier;
  usersById.set(userId, profile);
  usersByEmail.set(profile.email, profile);
  persist();
  return toPublic(profile);
}

export async function findUserByStripeCustomerId(
  customerId: string,
): Promise<AuthUser | null> {
  ensureLoaded();
  for (const u of usersById.values()) {
    if (u.stripeCustomerId === customerId) return u;
  }
  return null;
}

export async function findUserByStripeSubscriptionId(
  subscriptionId: string,
): Promise<AuthUser | null> {
  ensureLoaded();
  for (const u of usersById.values()) {
    if (u.stripeSubscriptionId === subscriptionId) return u;
  }
  return null;
}
