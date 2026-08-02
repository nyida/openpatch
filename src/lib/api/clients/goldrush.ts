/**
 * GoldRush API - Hyperliquid ecosystem data.
 * Free credits for early builders. Requires API key.
 * @see https://goldrush.dev
 */

import { apiFetch } from '../http';

const BASE = process.env.GOLDRUSH_API_URL ?? 'https://api.goldrush.dev';

function apiKey(): string | undefined {
  return process.env.GOLDRUSH_API_KEY;
}

export type GoldRushMarket = {
  symbol?: string;
  name?: string;
  price?: number;
  volume_24h?: number;
  open_interest?: number;
  funding_rate?: number;
};

/** Fetch Hyperliquid market overview. */
export async function fetchGoldRushMarkets(): Promise<GoldRushMarket[]> {
  const key = apiKey();
  if (!key) return [];

  const data = await apiFetch<{ markets?: GoldRushMarket[]; data?: GoldRushMarket[] }>({
    source: 'goldrush',
    baseUrl: BASE,
    path: '/v1/markets',
    apiKey: key,
    apiKeyHeader: 'Authorization',
    rateLimitPerMinute: 60,
  });
  return data?.markets ?? data?.data ?? [];
}

/** Fetch a single Hyperliquid asset. */
export async function fetchGoldRushAsset(symbol: string): Promise<GoldRushMarket | null> {
  const key = apiKey();
  if (!key) return null;

  return apiFetch<GoldRushMarket>({
    source: 'goldrush',
    baseUrl: BASE,
    path: `/v1/markets/${encodeURIComponent(symbol)}`,
    apiKey: key,
    apiKeyHeader: 'Authorization',
    rateLimitPerMinute: 60,
  });
}

/** Whether GoldRush API key is configured. */
export function isGoldRushConfigured(): boolean {
  return Boolean(apiKey());
}
