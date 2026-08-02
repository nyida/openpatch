import { bearerToken, verifyToken } from './crypto';
import { error } from './http';
import { findUserById, getPublicUser } from './store';
import type { UserProfile } from './types';

export type AuthContext = {
  userId: string;
  email: string;
  user: UserProfile;
};

export async function requireAuth(
  request: Request,
): Promise<AuthContext | Response> {
  const token = bearerToken(request);
  if (!token) return error('Unauthorized', 401);
  const payload = verifyToken(token);
  if (!payload) return error('Invalid or expired token', 401);
  const user = await getPublicUser(payload.sub);
  if (!user) return error('User not found', 401);
  return { userId: payload.sub, email: payload.email, user };
}

export async function requirePro(
  request: Request,
): Promise<AuthContext | Response> {
  const auth = await requireAuth(request);
  if (auth instanceof Response) return auth;
  if (auth.user.tier !== 'pro') {
    return error('Pro subscription required', 402, { code: 'PRO_REQUIRED' });
  }
  return auth;
}

export async function optionalAuth(
  request: Request,
): Promise<AuthContext | null> {
  const token = bearerToken(request);
  if (!token) return null;
  const payload = verifyToken(token);
  if (!payload) return null;
  const full = await findUserById(payload.sub);
  if (!full) return null;
  const user = await getPublicUser(payload.sub);
  if (!user) return null;
  return { userId: payload.sub, email: payload.email, user };
}
