import type { NetROIResult } from '@/utils/arbMath';

export type Venue = 'polymarket' | 'kalshi';

export type UnifiedMarket = {
  id: string;
  title: string;
  event_title: string | null;
  venue: Venue;
  volume: number;
  volume_24h: number | null;
  probability: number;
  category: string;
  image: string | null;
  external_url: string;
  status: string;
};

export type ArbitrageSpread = {
  id: string;
  title: string;
  poly_title: string;
  kalshi_title: string;
  poly_price: number;
  kalshi_price: number;
  spread: number;
  spread_cents: number;
  net_profit_cents: number;
  net_profit_pct: number;
  roi: NetROIResult;
  direction: 'buy_poly' | 'buy_kalshi' | 'neutral';
  last_seen_at: number;
  first_seen_at: number;
  poly_url: string;
  kalshi_url: string;
  kalshi_ticker: string | null;
};

export type UnifiedSearchParams = {
  q: string;
  venue?: 'all' | Venue;
  min_volume?: number;
  category?: string;
  limit?: number;
};

export const FEE_ESTIMATE_CENTS = 1.5;
