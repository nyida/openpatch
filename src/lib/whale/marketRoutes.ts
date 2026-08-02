export type MarketVenue = 'polymarket' | 'kalshi';

const ID_SEP = '~';

export function cleanMarketTitle(title: string): string {
  return title.replace(/\s*\[(YES|NO)\]\s*$/i, '').trim();
}

export function normalizeMarketVenue(platform: string): MarketVenue {
  return platform === 'kalshi' ? 'kalshi' : 'polymarket';
}

function toBase64Url(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(b64: string): string {
  const padded = b64.replace(/-/g, '+').replace(/_/g, '/');
  const padLen = (4 - (padded.length % 4)) % 4;
  const bin = atob(padded + '='.repeat(padLen));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function safeDecodeTitle(raw: string): string {
  let s = raw.trim();
  for (let i = 0; i < 3; i++) {
    if (!/%[0-9A-Fa-f]{2}/.test(s)) break;
    try {
      const next = decodeURIComponent(s);
      if (next === s) break;
      s = next;
    } catch {
      break;
    }
  }
  return s.replace(/\+/g, ' ').trim();
}

export function encodeMarketId(title: string, platform: string): string {
  const venue = normalizeMarketVenue(platform);
  const clean = cleanMarketTitle(title);
  return `${venue}${ID_SEP}${toBase64Url(clean)}`;
}

export function decodeMarketId(
  marketId: string,
): { title: string; platform: MarketVenue } | null {
  const raw = marketId.trim();
  if (!raw) return null;

  const tilde = raw.indexOf(ID_SEP);
  if (tilde > 0) {
    const platform = raw.slice(0, tilde);
    if (platform === 'polymarket' || platform === 'kalshi') {
      try {
        const title = fromBase64Url(raw.slice(tilde + 1));
        if (title) return { title: cleanMarketTitle(title), platform };
      } catch {
        /* try legacy */
      }
    }
  }

  const legacySep = raw.indexOf('--');
  if (legacySep > 0) {
    const platform = raw.slice(0, legacySep);
    if (platform === 'polymarket' || platform === 'kalshi') {
      const title = safeDecodeTitle(raw.slice(legacySep + 2));
      if (title) return { title: cleanMarketTitle(title), platform };
    }
  }

  return null;
}

export type MarketLinkExtras = {
  price?: number;
  volume?: number;
  event?: string | null;
};

/** Build canonical market detail URL using encoded ID. */
export function marketDetailPath(
  title: string,
  platform: string,
  extras?: MarketLinkExtras,
): string {
  const id = encodeMarketId(title, platform);
  const params = new URLSearchParams();
  if (extras?.price != null && Number.isFinite(extras.price)) {
    params.set('price', String(extras.price));
  }
  if (extras?.volume != null && Number.isFinite(extras.volume)) {
    params.set('volume', String(extras.volume));
  }
  if (extras?.event) params.set('event', extras.event);
  const qs = params.toString();
  return `/market/${id}${qs ? `?${qs}` : ''}`;
}

/** Prefer explicit query params - they survive URL encoding issues. */
export function resolveMarketIdentity(
  marketId: string,
  searchParams: { title?: string | null; platform?: string | null; venue?: string | null },
): { title: string; platform: MarketVenue } | null {
  const titleRaw = searchParams.title?.trim();
  if (titleRaw) {
    return {
      title: cleanMarketTitle(safeDecodeTitle(titleRaw)),
      platform: normalizeMarketVenue(searchParams.platform ?? searchParams.venue ?? 'polymarket'),
    };
  }

  return decodeMarketId(marketId);
}

export function titlesMatch(a: string, b: string): boolean {
  const ca = cleanMarketTitle(a).toLowerCase();
  const cb = cleanMarketTitle(b).toLowerCase();
  if (!ca || !cb) return false;
  if (ca === cb) return true;
  return ca.includes(cb) || cb.includes(ca);
}
