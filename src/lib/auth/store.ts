import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import type { AuthUser, SubscriptionTier, UserProfile } from './types';

type StoreFile = {
  users: AuthUser[];
};

const DATA_DIR = path.join(process.cwd(), 'data');
const STORE_PATH = path.join(DATA_DIR, 'auth-store.json');

const usersById = new Map<string, AuthUser>();
const usersByEmail = new Map<string, AuthUser>();
let loaded = false;

function ensureLoaded() {
  if (loaded) return;
  loaded = true;
  try {
    if (!existsSync(STORE_PATH)) return;
    const raw = readFileSync(STORE_PATH, 'utf8');
    const parsed = JSON.parse(raw) as StoreFile;
    for (const u of parsed.users || []) {
      usersById.set(u.id, u);
      usersByEmail.set(u.email.toLowerCase(), u);
    }
  } catch {
    /* start empty */
  }
}

function persist() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  const users = Array.from(usersById.values());
  writeFileSync(STORE_PATH, JSON.stringify({ users }, null, 2), 'utf8');
}

function toPublic(u: AuthUser): UserProfile {
  return {
    id: u.id,
    email: u.email,
    displayName: u.displayName,
    tier: u.tier,
    stripeCustomerId: u.stripeCustomerId,
    stripeSubscriptionId: u.stripeSubscriptionId,
    createdAt: u.createdAt,
  };
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
}): Promise<AuthUser> {
  ensureLoaded();
  const email = input.email.trim().toLowerCase();
  if (usersByEmail.has(email)) {
    throw new Error('Email already registered');
  }
  const user: AuthUser = {
    id: randomUUID(),
    email,
    displayName: (input.displayName || email.split('@')[0] || 'Trader').trim(),
    passwordHash: input.passwordHash,
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
