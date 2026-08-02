import { guardProApi } from '@/lib/auth/guardApi';
import { NextRequest } from 'next/server';
import { getArbitragePairs } from '@/services/arbitrage.service';
import { kalshiTickerFromUrl, polySlugFromUrl, type PriceSubscription } from '@/services/websocket';
import { cachedResponseAsync } from '@/lib/whale/responseCache';
import { whaleError, whaleJson } from '@/lib/whale/api';

export const dynamic = 'force-dynamic';

const GAMMA = process.env.POLY_GAMMA_URL ?? 'https://gamma-api.polymarket.com';
const TOKEN_CACHE_MS = 86_400_000;
const SUBS_CACHE_MS = 120_000;

const tokenCache = new Map<string, { id: string; at: number }>();

async function fetchPolyTokenId(slug: string): Promise<string | null> {
  const hit = tokenCache.get(slug);
  if (hit && Date.now() - hit.at < TOKEN_CACHE_MS) return hit.id;

  try {
    const res = await fetch(`${GAMMA}/markets?slug=${encodeURIComponent(slug)}&limit=1`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return hit?.id ?? null;
    const markets = (await res.json()) as { clobTokenIds?: string }[];
    const m = markets[0];
    if (!m?.clobTokenIds) return hit?.id ?? null;
    const ids = JSON.parse(m.clobTokenIds) as string[];
    const id = ids[0] ?? null;
    if (id) tokenCache.set(slug, { id, at: Date.now() });
    return id;
  } catch {
    return hit?.id ?? null;
  }
}

export async function GET(req: NextRequest) {
  const _denied = await guardProApi(req);
  if (_denied) return _denied;

  const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') ?? '50', 10), 50);
  try {
    const data = await cachedResponseAsync(`price-subs:${limit}`, SUBS_CACHE_MS, async () => {
      const { pairs } = await getArbitragePairs(0);
      const top = pairs.slice(0, limit);

      const subs: PriceSubscription[] = await Promise.all(
        top.map(async (p) => {
          const kalshiTicker = p.kalshi_ticker || kalshiTickerFromUrl(p.kalshi_url);
          const polySlug = polySlugFromUrl(p.poly_url);
          const polyTokenId = polySlug ? await fetchPolyTokenId(polySlug) : null;
          return {
            contractId: p.id,
            polyTitle: p.poly_title,
            kalshiTitle: p.kalshi_title,
            kalshiTicker,
            polyTokenId,
            polySlug,
          };
        }),
      );

      return {
        subs: subs.filter((s) => s.kalshiTicker || s.polyTokenId),
        count: subs.length,
      };
    });

    return whaleJson(data);
  } catch (e) {
    return whaleError(e);
  }
}
