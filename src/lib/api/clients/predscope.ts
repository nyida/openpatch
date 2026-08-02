/**
 * PredScope free Polymarket data API.
 * No authentication required. Updated every ~10 minutes. CORS-enabled.
 * @see https://predscope.com/api
 */

import { inferMarketCategory } from '@/lib/whale/categories';
import { apiFetch } from '../http';
import type { ApiMarket } from '../types/api.types';

const BASE = process.env.PREDSCOPE_API_URL ?? 'https://predscope.com';

type PredScopeOutcome = {
  title: string;
  probability: number;
  day_change?: number;
};

type PredScopeMarket = {
  title: string;
  slug: string;
  url?: string;
  volume: number;
  volume_24h?: number;
  liquidity?: number;
  categories?: string[];
  outcomes: PredScopeOutcome[];
};

type PredScopeMarketsResponse = {
  meta?: { total_markets?: number; update_frequency?: string };
  markets: PredScopeMarket[];
};

function toApiMarkets(m: PredScopeMarket): ApiMarket[] {
  const baseUrl = `https://polymarket.com${m.url ?? `/event/${m.slug}`}`;
  const category = m.categories?.[0] ?? inferMarketCategory(m.title);

  return m.outcomes.map((o, i) => ({
    id: `predscope-${m.slug}-${i}`,
    title: m.outcomes.length > 1 ? `${m.title} - ${o.title}` : m.title,
    event_title: m.outcomes.length > 1 ? m.title : null,
    platform: 'polymarket',
    source: 'predscope',
    volume: m.volume,
    volume_24h: m.volume_24h ?? null,
    probability: o.probability,
    category,
    image: null,
    external_url: baseUrl,
    status: 'active',
    change_1d: o.day_change ?? null,
    liquidity: m.liquidity ?? null,
  }));
}

/** Fetch top active Polymarket markets via PredScope. */
export async function fetchPredScopeMarkets(): Promise<ApiMarket[]> {
  const data = await apiFetch<PredScopeMarketsResponse>({
    source: 'predscope',
    baseUrl: BASE,
    path: '/api/markets.json',
    rateLimitPerMinute: 100,
  });
  if (!data?.markets) return [];

  return data.markets.flatMap(toApiMarkets);
}

/** Fetch recently resolved markets for backtesting/research. */
export async function fetchPredScopeResolved(): Promise<PredScopeMarket[]> {
  const data = await apiFetch<{ markets: PredScopeMarket[] }>({
    source: 'predscope',
    baseUrl: BASE,
    path: '/api/resolved.json',
    rateLimitPerMinute: 100,
  });
  return data?.markets ?? [];
}

/** PredScope metadata (total markets, update frequency). */
export async function fetchPredScopeMeta(): Promise<PredScopeMarketsResponse['meta'] | null> {
  const data = await apiFetch<PredScopeMarketsResponse>({
    source: 'predscope',
    baseUrl: BASE,
    path: '/api/markets.json',
    rateLimitPerMinute: 100,
  });
  return data?.meta ?? null;
}
