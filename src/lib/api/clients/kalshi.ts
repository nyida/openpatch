/**
 * Kalshi Trade API client.
 * Public market data endpoints - no API key required for reads.
 * @see https://trading-api.readme.io/reference/getmarkets-1
 */

import { inferMarketCategory } from '@/lib/whale/categories';
import { kalshiExternalUrl, kalshiSeriesTicker } from '@/lib/whale/marketUrls';
import { warmKalshiSeriesTitles, getCachedKalshiSeriesTitle } from '@/lib/whale/kalshiSeries';
import { apiFetch } from '../http';
import type { ApiMarket } from '../types/api.types';

const BASE = process.env.KALSHI_API_URL ?? 'https://api.elections.kalshi.com/trade-api/v2';

type KalshiMarket = {
  ticker?: string;
  event_ticker?: string;
  title?: string;
  yes_sub_title?: string;
  subtitle?: string;
  last_price_dollars?: string;
  previous_price_dollars?: string;
  volume_fp?: string;
  volume_24h_fp?: string;
  status?: string;
};

function toApiMarket(m: KalshiMarket): ApiMarket {
  const title = m.title ?? m.ticker ?? 'Unknown';
  const eventTitle = m.yes_sub_title ?? m.subtitle ?? null;
  const last = parseFloat(m.last_price_dollars ?? '0') || 0;
  const prev = parseFloat(m.previous_price_dollars ?? '0') || 0;
  const series = kalshiSeriesTicker(m.ticker, m.event_ticker);
  return {
    id: `kalshi-${m.ticker ?? title}`,
    title,
    event_title: eventTitle !== title ? eventTitle : null,
    platform: 'kalshi',
    source: 'kalshi',
    volume: parseFloat(m.volume_fp ?? '0') || 0,
    volume_24h: parseFloat(m.volume_24h_fp ?? '0') || null,
    probability: last,
    category: inferMarketCategory(`${title} ${eventTitle ?? ''}`),
    image: null,
    external_url: kalshiExternalUrl({
      ticker: m.ticker,
      eventTicker: m.event_ticker,
      seriesTicker: series,
      seriesTitle: series ? getCachedKalshiSeriesTitle(series) : null,
      title: m.title,
    }),
    status: m.status ?? 'active',
    change_1d: prev > 0 || last > 0 ? last - prev : null,
  };
}

async function mapWithSeries(markets: KalshiMarket[]): Promise<ApiMarket[]> {
  await warmKalshiSeriesTitles(
    markets.map((m) => kalshiSeriesTicker(m.ticker, m.event_ticker)).filter((s): s is string => Boolean(s)),
  );
  return markets.map(toApiMarket);
}

/** Search open Kalshi markets by keyword. */
export async function searchKalshiMarkets(q: string, limit = 30): Promise<ApiMarket[]> {
  const data = await apiFetch<{ markets: KalshiMarket[] }>({
    source: 'kalshi',
    baseUrl: BASE,
    path: `/markets?status=open&limit=${Math.min(limit, 100)}&mve_filter=exclude&query=${encodeURIComponent(q)}`,
    rateLimitPerMinute: 100,
  });
  return mapWithSeries(data?.markets ?? []);
}

/** Fetch top Kalshi markets by volume. */
export async function fetchKalshiMarkets(maxPages = 3): Promise<ApiMarket[]> {
  const all: KalshiMarket[] = [];
  let cursor: string | undefined;

  for (let i = 0; i < maxPages; i++) {
    const params = new URLSearchParams({ status: 'open', limit: '1000', mve_filter: 'exclude' });
    if (cursor) params.set('cursor', cursor);

    const data = await apiFetch<{ markets: KalshiMarket[]; cursor?: string }>({
      source: 'kalshi',
      baseUrl: BASE,
      path: `/markets?${params}`,
      rateLimitPerMinute: 100,
    });
    if (!data) break;

    all.push(...(data.markets ?? []));
    cursor = data.cursor;
    if (!cursor || (data.markets?.length ?? 0) < 1000) break;
  }

  const mapped = await mapWithSeries(all);
  return mapped
    .filter((m) => m.volume > 0 || m.probability > 0)
    .sort((a, b) => b.volume - a.volume);
}
