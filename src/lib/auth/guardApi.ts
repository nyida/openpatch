import { requireAuth, requirePro } from '@/lib/auth/requireAuth';
import { isProApiPath } from '@/lib/auth/plans';

const PUBLIC_API_PREFIXES = [
  '/api/auth/',
  '/api/checkout',
  '/api/health',
];

export function isPublicApiPath(pathname: string): boolean {
  return PUBLIC_API_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p),
  );
}

/**
 * Auth for data APIs:
 * - Public auth/checkout/health: open
 * - Pro APIs: require Pro subscription
 * - Everything else: require signed-in (Free tier)
 */
export async function guardProApi(request: Request): Promise<Response | null> {
  const path = new URL(request.url).pathname;
  if (isPublicApiPath(path)) return null;

  if (isProApiPath(path)) {
    const auth = await requirePro(request);
    if (auth instanceof Response) return auth;
    return null;
  }

  const auth = await requireAuth(request);
  if (auth instanceof Response) return auth;
  return null;
}

/** Alias - same smart guard. */
export const guardApi = guardProApi;
