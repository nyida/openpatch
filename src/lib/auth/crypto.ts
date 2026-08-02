import {
  createHmac,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from 'crypto';

const TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

function authSecret(): string {
  return (
    process.env.AUTH_SECRET ||
    process.env.JWT_SECRET ||
    'algomarket-dev-secret-change-me'
  );
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const next = scryptSync(password, salt, 64);
  const prev = Buffer.from(hash, 'hex');
  if (next.length !== prev.length) return false;
  return timingSafeEqual(next, prev);
}

function b64url(input: Buffer | string): string {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
  return buf
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function fromB64url(input: string): Buffer {
  const pad = input.length % 4 === 0 ? '' : '='.repeat(4 - (input.length % 4));
  const b64 = input.replace(/-/g, '+').replace(/\//g, '/') + pad;
  return Buffer.from(b64, 'base64');
}

function hmac(data: string): Buffer {
  return createHmac('sha256', authSecret()).update(data).digest();
}

export function signToken(payload: { sub: string; email: string }): string {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64url(
    JSON.stringify({
      ...payload,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor((Date.now() + TOKEN_TTL_MS) / 1000),
    }),
  );
  const data = `${header}.${body}`;
  return `${data}.${b64url(hmac(data))}`;
}

export function verifyToken(token: string): { sub: string; email: string } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [header, body, sig] = parts;
    const data = `${header}.${body}`;
    const expected = b64url(hmac(data));
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    const payload = JSON.parse(fromB64url(body).toString('utf8')) as {
      sub?: string;
      email?: string;
      exp?: number;
    };
    if (!payload.sub || !payload.email) return null;
    if (payload.exp && payload.exp * 1000 < Date.now()) return null;
    return { sub: payload.sub, email: payload.email };
  } catch {
    return null;
  }
}

export function bearerToken(request: Request): string | null {
  const h = request.headers.get('authorization') || request.headers.get('Authorization');
  if (!h) return null;
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m?.[1]?.trim() || null;
}
