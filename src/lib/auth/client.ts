import type { UserProfile } from './types';

const TOKEN_KEY = 'algomarket_token';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function authHeaders(extra?: HeadersInit): Headers {
  const headers = new Headers(extra);
  const token = getToken();
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  return headers;
}

/** fetch() with Bearer token attached when available. */
export function authFetch(input: RequestInfo | URL, init?: RequestInit) {
  return fetch(input, {
    ...init,
    headers: authHeaders(init?.headers),
  });
}

export function setToken(token: string | null) {
  if (typeof window === 'undefined') return;
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

async function api<T>(
  path: string,
  opts: RequestInit & { auth?: boolean } = {},
): Promise<T> {
  const headers = new Headers(opts.headers);
  if (!headers.has('Content-Type') && opts.body) {
    headers.set('Content-Type', 'application/json');
  }
  if (opts.auth !== false) {
    const token = getToken();
    if (token) headers.set('Authorization', `Bearer ${token}`);
  }
  const res = await fetch(path, { ...opts, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      typeof data?.error === 'string' ? data.error : `Request failed (${res.status})`;
    const err = new Error(msg) as Error & { status?: number; code?: string };
    err.status = res.status;
    err.code = data?.code;
    throw err;
  }
  return data as T;
}

export async function signup(p: {
  email: string;
  password: string;
  displayName?: string;
}) {
  return api<{ token: string; user: UserProfile }>('/api/auth/signup', {
    method: 'POST',
    body: JSON.stringify(p),
    auth: false,
  });
}

export async function login(p: { email: string; password: string }) {
  return api<{ token: string; user: UserProfile }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(p),
    auth: false,
  });
}

export async function fetchMe() {
  return api<{ user: UserProfile }>('/api/auth/me', { method: 'GET' });
}

export async function createCheckoutSession(p?: {
  successUrl?: string;
  cancelUrl?: string;
}) {
  return api<{
    sessionId: string | null;
    url: string | null;
    alreadyPro?: boolean;
    dev?: boolean;
    amount?: number;
  }>('/api/checkout', {
    method: 'POST',
    body: JSON.stringify(p || {}),
  });
}

export async function confirmCheckout(sessionId: string) {
  return api<{ user: UserProfile; upgraded: boolean }>('/api/checkout/confirm', {
    method: 'POST',
    body: JSON.stringify({ sessionId }),
  });
}

export async function startWebCheckout() {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const session = await createCheckoutSession({
    successUrl: `${origin}/paywall?success=1&session_id={CHECKOUT_SESSION_ID}`,
    cancelUrl: `${origin}/paywall?canceled=1`,
  });
  if (session.alreadyPro || session.dev) {
    return { upgraded: true as const };
  }
  if (!session.url) throw new Error('No checkout URL');
  window.location.href = session.url;
  return { upgraded: false as const };
}
