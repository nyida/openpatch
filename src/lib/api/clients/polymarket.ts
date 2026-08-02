/**
 * Polymarket Gamma API client.
 * Public read-only endpoints - no API key required.
 * @see https://docs.polymarket.com/api-reference/introduction
 */

import { inferMarketCategory } from '@/lib/whale/categories';
import { polymarketExternalUrl } from '@/lib/whale/marketUrls';
import { apiFetch } from '../http';
import type { ApiMarket } from '../types/api.types';

const BASE = process.env.POLY_GAMMA_URL ?? 'https://gamma-api.polymarket.com';

type GammaMarket = {
  id?: string;
  question?: string;
  slug?: string;
  outcomePrices?: string;
  volume?: string;
  volume24hr?: number;
  image?: string;
  active?: boolean;
  closed?: boolean;
  oneDayPriceChange?: number;
  events?: { title?: string; image?: string; slug?: string }[];
  groupItemTitle?: string;
};

function parseProb(outcomePrices?: string): number {
  try {
    const arr = JSON.parse(outcomePrices ?? '["0.5"]') as string[];
    return parseFloat(arr[0]) || 0.5;
  } catch {
    return 0.5;
  }
}

function toApiMarket(m: GammaMarket, eventTitle?: string | null): ApiMarket {
  const title = m.question ?? 'Unknown';
  return {
    id: `poly-${m.id ?? m.slug ?? title}`,
    title,
    event_title: eventTitle ?? m.groupItemTitle ?? null,
    platform: 'polymarket',
    source: 'polymarket',
    volume: parseFloat(m.volume ?? '0') || 0,
    volume_24h: m.volume24hr ?? null,
    probability: parseProb(m.outcomePrices),
    category: inferMarketCategory(title),
    image: m.image ?? m.events?.[0]?.image ?? null,
    external_url: polymarketExternalUrl(m),
    status: m.closed ? 'closed' : m.active ? 'active' : 'unknown',
    change_1d: m.oneDayPriceChange ?? null,
  };
}

/** Search Polymarket events/markets by keyword. */
export async function searchPolymarketMarkets(q: string, limit = 30): Promise<ApiMarket[]> {
  const data = await apiFetch<{ events?: { title?: string; slug?: string; image?: string; markets?: GammaMarket[] }[] }>({
    source: 'polymarket',
    baseUrl: BASE,
    path: `/public-search?q=${encodeURIComponent(q)}&limit=${limit}`,
    rateLimitPerMinute: 600,
  });
  if (!data) return [];

  const rows: ApiMarket[] = [];
  for (const ev of data.events ?? []) {
    for (const m of ev.markets ?? []) {
      rows.push(toApiMarket({ ...m, slug: m.slug ?? ev.slug, image: m.image ?? ev.image }, ev.title));
    }
  }
  return rows;
}

/** Fetch top Polymarket markets by 24h volume. */
export async function fetchPolymarketMarkets(limit = 100): Promise<ApiMarket[]> {
  const rows: ApiMarket[] = [];
  for (let offset = 0; offset < limit; offset += 100) {
    const markets = await apiFetch<GammaMarket[]>({
      source: 'polymarket',
      baseUrl: BASE,
      path: `/markets?active=true&closed=false&limit=100&offset=${offset}&order=volume24hr&ascending=false`,
      rateLimitPerMinute: 600,
    });
    if (!markets?.length) break;
    for (const m of markets) rows.push(toApiMarket(m));
    if (markets.length < 100) break;
  }
  return rows;
}
