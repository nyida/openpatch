import { createPublicKey, createVerify } from 'crypto';

export type OAuthProfile = {
  email: string;
  name?: string;
  sub: string;
  provider: 'google' | 'apple';
};

function googleAudiences(): string[] {
  const raw =
    process.env.GOOGLE_CLIENT_IDS ||
    process.env.GOOGLE_CLIENT_ID ||
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ||
    '';
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Verify Google ID token via Google's tokeninfo endpoint. */
export async function verifyGoogleIdToken(
  idToken: string,
): Promise<OAuthProfile> {
  const res = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`,
  );
  if (!res.ok) {
    throw new Error('INVALID_GOOGLE_TOKEN');
  }
  const data = (await res.json()) as {
    email?: string;
    email_verified?: string | boolean;
    name?: string;
    sub?: string;
    aud?: string;
  };

  const audiences = googleAudiences();
  if (audiences.length && data.aud && !audiences.includes(data.aud)) {
    throw new Error('GOOGLE_AUD_MISMATCH');
  }

  const verified =
    data.email_verified === true || data.email_verified === 'true';
  if (!data.email || !verified || !data.sub) {
    throw new Error('GOOGLE_EMAIL_UNVERIFIED');
  }

  return {
    provider: 'google',
    email: data.email,
    name: data.name,
    sub: data.sub,
  };
}

type AppleKey = {
  kty: string;
  kid: string;
  use: string;
  alg: string;
  n: string;
  e: string;
};

let appleKeysCache: { at: number; keys: AppleKey[] } | null = null;

async function appleKeys(): Promise<AppleKey[]> {
  if (appleKeysCache && Date.now() - appleKeysCache.at < 60 * 60 * 1000) {
    return appleKeysCache.keys;
  }
  const res = await fetch('https://appleid.apple.com/auth/keys');
  if (!res.ok) throw new Error('APPLE_KEYS_FAILED');
  const data = (await res.json()) as { keys: AppleKey[] };
  appleKeysCache = { at: Date.now(), keys: data.keys || [] };
  return appleKeysCache.keys;
}

function b64urlToBuf(input: string): Buffer {
  const pad = input.length % 4 === 0 ? '' : '='.repeat(4 - (input.length % 4));
  return Buffer.from(input.replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64');
}

/** Verify Apple identity token (RS256 + Apple JWKS). */
export async function verifyAppleIdToken(
  idToken: string,
  emailHint?: string,
  nameHint?: string,
): Promise<OAuthProfile> {
  const parts = idToken.split('.');
  if (parts.length !== 3) throw new Error('INVALID_APPLE_TOKEN');

  const header = JSON.parse(b64urlToBuf(parts[0]).toString('utf8')) as {
    kid?: string;
    alg?: string;
  };
  const payload = JSON.parse(b64urlToBuf(parts[1]).toString('utf8')) as {
    iss?: string;
    aud?: string;
    exp?: number;
    sub?: string;
    email?: string;
    email_verified?: boolean | string;
  };

  if (payload.iss !== 'https://appleid.apple.com') {
    throw new Error('APPLE_ISS_INVALID');
  }
  if (payload.exp && payload.exp * 1000 < Date.now()) {
    throw new Error('APPLE_TOKEN_EXPIRED');
  }

  const allowedAud = (
    process.env.APPLE_CLIENT_IDS ||
    process.env.APPLE_CLIENT_ID ||
    process.env.NEXT_PUBLIC_APPLE_CLIENT_ID ||
    ''
  )
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  if (allowedAud.length && payload.aud && !allowedAud.includes(payload.aud)) {
    throw new Error('APPLE_AUD_MISMATCH');
  }

  const keys = await appleKeys();
  const jwk = keys.find((k) => k.kid === header.kid);
  if (!jwk) throw new Error('APPLE_KEY_NOT_FOUND');

  const key = createPublicKey({ key: jwk, format: 'jwk' });
  const verifier = createVerify('RSA-SHA256');
  verifier.update(`${parts[0]}.${parts[1]}`);
  verifier.end();
  const ok = verifier.verify(key, b64urlToBuf(parts[2]));
  if (!ok) throw new Error('INVALID_APPLE_SIGNATURE');

  const email = payload.email || emailHint;
  if (!email) throw new Error('APPLE_EMAIL_MISSING');

  return {
    provider: 'apple',
    email,
    name: nameHint,
    sub: payload.sub || email,
  };
}
