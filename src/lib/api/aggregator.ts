/**
 * Aggregates data from multiple external APIs with graceful degradation.
 * Primary sources are fetched in parallel; failures are logged and omitted.
 */

import { fetchPredScopeMarkets } from './clients/predscope';
import { fetchManifoldMarkets } from './clients/manifold';
import { fetchMetaculusQuestions } from './clients/metaculus';
import { fetchPolyRouterAllPlatforms, isPolyRouterConfigured } from './clients/polyrouter';
import { fetchSimpleFunctionsMarkets, fetchSimpleFunctionsChanges } from './clients/simplefunctions';
import { fetchPolymarketMarkets } from './clients/polymarket';
import { fetchKalshiMarkets } from './clients/kalshi';
import { fetchCoinPaprikaWatchlist } from './clients/coinpaprika';
import { fetchCoinGeckoMarkets, isCoinGeckoConfigured } from './clients/coingecko';
import { fetchCoinMarketCapListings, isCoinMarketCapConfigured } from './clients/coinmarketcap';
import { fetchFredMacroOverview, isFredConfigured } from './clients/fred';
import { fetchGoldRushMarkets, isGoldRushConfigured } from './clients/goldrush';
import { isDomeConfigured } from './clients/dome';
import type {
  AggregatedMarketsResponse,
  ApiMarket,
  CryptoOverviewResponse,
  CryptoTicker,
  DataSource,
  DataSourceStatus,
  MarketChangesResponse,
} from './types/api.types';

const MARKET_CACHE_MS = 90_000;
const CHANGES_CACHE_MS = 60_000;
const CRYPTO_CACHE_MS = 120_000;

let marketCache: { at: number; data: AggregatedMarketsResponse } | null = null;
let changesCache: { at: number; data: MarketChangesResponse } | null = null;
let cryptoCache: { at: number; data: CryptoOverviewResponse } | null = null;

function dedupeMarkets(markets: ApiMarket[]): ApiMarket[] {
  const seen = new Set<string>();
  const out: ApiMarket[] = [];
  for (const m of markets) {
    const key = `${m.platform}:${m.title.toLowerCase().slice(0, 80)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(m);
  }
  return out;
}

/** Fetch prediction markets from all configured sources. */
export async function aggregateMarkets(opts?: {
  includeManifold?: boolean;
  includeMetaculus?: boolean;
  limit?: number;
}): Promise<AggregatedMarketsResponse> {
  if (marketCache && Date.now() - marketCache.at < MARKET_CACHE_MS) {
    return marketCache.data;
  }

  const sources: Record<string, { count: number; ok: boolean }> = {};
  const batches = await Promise.all([
    fetchPredScopeMarkets()
      .then((m) => ({ key: 'predscope', markets: m, ok: true }))
      .catch(() => ({ key: 'predscope', markets: [] as ApiMarket[], ok: false })),
    fetchPolymarketMarkets(100)
      .then((m) => ({ key: 'polymarket', markets: m, ok: true }))
      .catch(() => ({ key: 'polymarket', markets: [] as ApiMarket[], ok: false })),
    fetchKalshiMarkets(2)
      .then((m) => ({ key: 'kalshi', markets: m.slice(0, 100), ok: true }))
      .catch(() => ({ key: 'kalshi', markets: [] as ApiMarket[], ok: false })),
    isPolyRouterConfigured()
      ? fetchPolyRouterAllPlatforms(15)
          .then((m) => ({ key: 'polyrouter', markets: m, ok: true }))
          .catch(() => ({ key: 'polyrouter', markets: [] as ApiMarket[], ok: false }))
      : Promise.resolve({ key: 'polyrouter', markets: [] as ApiMarket[], ok: false }),
    fetchSimpleFunctionsMarkets(30)
      .then((m) => ({ key: 'simplefunctions', markets: m, ok: true }))
      .catch(() => ({ key: 'simplefunctions', markets: [] as ApiMarket[], ok: false })),
    opts?.includeManifold !== false
      ? fetchManifoldMarkets(30)
          .then((m) => ({ key: 'manifold', markets: m, ok: true }))
          .catch(() => ({ key: 'manifold', markets: [] as ApiMarket[], ok: false }))
      : Promise.resolve({ key: 'manifold', markets: [] as ApiMarket[], ok: false }),
    opts?.includeMetaculus
      ? fetchMetaculusQuestions(20)
          .then((m) => ({ key: 'metaculus', markets: m, ok: true }))
          .catch(() => ({ key: 'metaculus', markets: [] as ApiMarket[], ok: false }))
      : Promise.resolve({ key: 'metaculus', markets: [] as ApiMarket[], ok: false }),
  ]);

  let allMarkets: ApiMarket[] = [];
  for (const batch of batches) {
    sources[batch.key] = { count: batch.markets.length, ok: batch.ok };
    allMarkets = allMarkets.concat(batch.markets);
  }

  const markets = dedupeMarkets(allMarkets)
    .sort((a, b) => (b.volume_24h ?? b.volume) - (a.volume_24h ?? a.volume))
    .slice(0, opts?.limit ?? 500);

  const data: AggregatedMarketsResponse = {
    markets,
    sources,
    cached_at: Date.now(),
  };
  marketCache = { at: data.cached_at, data };
  return data;
}

/** Fetch cross-venue market change events. */
export async function aggregateChanges(since = '1h'): Promise<MarketChangesResponse> {
  if (changesCache && Date.now() - changesCache.at < CHANGES_CACHE_MS) {
    return changesCache.data;
  }

  const sources: Record<string, { count: number; ok: boolean }> = {};
  const changes = await fetchSimpleFunctionsChanges(since)
    .then((c) => {
      sources.simplefunctions = { count: c.length, ok: true };
      return c;
    })
    .catch(() => {
      sources.simplefunctions = { count: 0, ok: false };
      return [];
    });

  const data: MarketChangesResponse = {
    changes,
    sources,
    cached_at: Date.now(),
  };
  changesCache = { at: data.cached_at, data };
  return data;
}

/** Fetch crypto tickers from available sources (CoinPaprika primary). */
export async function aggregateCrypto(): Promise<CryptoOverviewResponse> {
  if (cryptoCache && Date.now() - cryptoCache.at < CRYPTO_CACHE_MS) {
    return cryptoCache.data;
  }

  const sources: Record<string, { count: number; ok: boolean }> = {};
  let tickers: CryptoTicker[] = [];

  const paprika = await fetchCoinPaprikaWatchlist()
    .then((t) => {
      sources.coinpaprika = { count: t.length, ok: t.length > 0 };
      return t;
    })
    .catch(() => {
      sources.coinpaprika = { count: 0, ok: false };
      return [] as CryptoTicker[];
    });

  tickers = paprika;

  if (tickers.length === 0 && isCoinGeckoConfigured()) {
    tickers = await fetchCoinGeckoMarkets(10)
      .then((t) => {
        sources.coingecko = { count: t.length, ok: t.length > 0 };
        return t;
      })
      .catch(() => {
        sources.coingecko = { count: 0, ok: false };
        return [] as CryptoTicker[];
      });
  } else if (isCoinGeckoConfigured()) {
    sources.coingecko = { count: 0, ok: true };
  }

  if (isCoinMarketCapConfigured()) {
    const cmc = await fetchCoinMarketCapListings(10).catch(() => []);
    sources.coinmarketcap = { count: cmc.length, ok: cmc.length > 0 };
    if (tickers.length === 0) tickers = cmc;
  }

  const data: CryptoOverviewResponse = {
    tickers,
    sources,
    cached_at: Date.now(),
  };
  cryptoCache = { at: data.cached_at, data };
  return data;
}

/** Health/status for all data sources. */
export function getDataSourceStatuses(): DataSourceStatus[] {
  const keySources: { source: DataSource; env: string }[] = [
    { source: 'polyrouter', env: 'POLYROUTER_API_KEY' },
    { source: 'dome', env: 'DOME_API_KEY' },
    { source: 'coingecko', env: 'COINGECKO_API_KEY' },
    { source: 'coinmarketcap', env: 'COINMARKETCAP_API_KEY' },
    { source: 'fred', env: 'FRED_API_KEY' },
    { source: 'goldrush', env: 'GOLDRUSH_API_KEY' },
  ];

  const freeSources: DataSource[] = [
    'polymarket',
    'kalshi',
    'predscope',
    'simplefunctions',
    'manifold',
    'metaculus',
    'coinpaprika',
  ];

  const statuses: DataSourceStatus[] = freeSources.map((source) => ({
    source,
    available: true,
    requires_key: false,
    has_key: true,
    rate_limit_per_minute: source === 'manifold' ? 1000 : 60,
  }));

  for (const { source, env } of keySources) {
    const hasKey = Boolean(process.env[env]);
    statuses.push({
      source,
      available: hasKey || source === 'polyrouter',
      requires_key: true,
      has_key: hasKey,
      last_error: hasKey ? null : 'API key not configured',
      rate_limit_per_minute: 60,
    });
  }

  return statuses;
}

/** Fetch macro overview (requires FRED key). */
export async function aggregateMacro() {
  if (!isFredConfigured()) return { series: [], cached_at: Date.now() };
  const series = await fetchFredMacroOverview();
  return { series, cached_at: Date.now() };
}

/** Fetch Hyperliquid data (requires GoldRush key). */
export async function aggregateGoldRush() {
  if (!isGoldRushConfigured()) return { markets: [], cached_at: Date.now() };
  const markets = await fetchGoldRushMarkets();
  return { markets, cached_at: Date.now() };
}

/** Reset in-memory caches (for tests). */
export function resetAggregatorCache(): void {
  marketCache = null;
  changesCache = null;
  cryptoCache = null;
}

/** Whether Dome orderbook integration is available. */
export { isDomeConfigured };
