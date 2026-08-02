/**
 * Dome API - real-time orderbooks from Polymarket and Kalshi.
 * Note: Dome was acquired by Polymarket; APIs reach end-of-life April 2026.
 * Requires free API key from domeapi.io.
 * @see https://docs.domeapi.io/
 */

import { apiFetch } from '../http';

const BASE = process.env.DOME_API_URL ?? 'https://api.domeapi.io/v1';

function apiKey(): string | undefined {
  return process.env.DOME_API_KEY;
}

type OrderbookLevel = { price: number; size: number };

export type DomeOrderbook = {
  token_id?: string;
  market_id?: string;
  platform?: string;
  bids?: OrderbookLevel[];
  asks?: OrderbookLevel[];
  timestamp?: string;
};

/** Fetch orderbook for a Polymarket token. */
export async function fetchDomePolymarketOrderbook(tokenId: string): Promise<DomeOrderbook | null> {
  const key = apiKey();
  if (!key) return null;

  return apiFetch<DomeOrderbook>({
    source: 'dome',
    baseUrl: BASE,
    path: `/polymarket/orderbook?token_id=${encodeURIComponent(tokenId)}`,
    apiKey: key,
    apiKeyHeader: 'Authorization',
    rateLimitPerMinute: 60,
  });
}

/** Fetch orderbook for a Kalshi market. */
export async function fetchDomeKalshiOrderbook(ticker: string): Promise<DomeOrderbook | null> {
  const key = apiKey();
  if (!key) return null;

  return apiFetch<DomeOrderbook>({
    source: 'dome',
    baseUrl: BASE,
    path: `/kalshi/orderbook?ticker=${encodeURIComponent(ticker)}`,
    apiKey: key,
    apiKeyHeader: 'Authorization',
    rateLimitPerMinute: 60,
  });
}

/** Fetch current market price for a Polymarket token. */
export async function fetchDomePolymarketPrice(tokenId: string): Promise<{ price: number } | null> {
  const key = apiKey();
  if (!key) return null;

  return apiFetch<{ price: number }>({
    source: 'dome',
    baseUrl: BASE,
    path: `/polymarket/markets/price?token_id=${encodeURIComponent(tokenId)}`,
    apiKey: key,
    apiKeyHeader: 'Authorization',
    rateLimitPerMinute: 60,
  });
}

/** Whether Dome API key is configured. */
export function isDomeConfigured(): boolean {
  return Boolean(apiKey());
}
