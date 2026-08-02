export type ScreenerRow = {
  platform: 'polymarket' | 'kalshi' | 'manifold' | 'metaculus';
  market_title: string;
  event_title: string | null;
  probability: number;
  price_open: number | null;
  price_high: number | null;
  price_low: number | null;
  change_1d: number | null;
  volume: number;
  volume_24h: number | null;
  days_to_resolution: number | null;
  status: string;
  external_url: string;
  source?: string;
};

export type ScreenerFacets = {
  total: number;
  polymarket: number;
  kalshi: number;
  manifold: number;
  metaculus: number;
};

export type ScreenerFilters = {
  platform: 'all' | 'polymarket' | 'kalshi' | 'manifold' | 'metaculus';
  prob_min: number;
  prob_max: number;
  volume_min: number;
  days_max: number | null;
  search: string;
  matched_only: boolean;
  limit: number;
  offset: number;
};

export type ScreenerCatalog = {
  at: number;
  polymarket: ScreenerRow[];
  kalshi: ScreenerRow[];
  manifold: ScreenerRow[];
  extras: ScreenerRow[];
};

import { getArbitragePairs } from '@/services/arbitrage.service';
import { titleSimilarity } from '@/services/arbitrage.utils';
import { kalshiExternalUrl, kalshiSeriesTicker } from '@/lib/whale/marketUrls';
import { warmKalshiSeriesTitles, getCachedKalshiSeriesTitle } from '@/lib/whale/kalshiSeries';

const CACHE_MS = 120_000;
const KALSHI_MAX_PAGES = 1;

let cache: ScreenerCatalog | null = null;
let refreshPromise: Promise<ScreenerCatalog> | null = null;
let extrasPromise: Promise<void> | null = null;

function parseNum(v: unknown): number {
  const n = typeof v === 'string' ? parseFloat(v) : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function daysUntil(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const end = new Date(iso).getTime();
  if (Number.isNaN(end)) return null;
  return Math.ceil((end - Date.now()) / 86_400_000);
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { next: { revalidate: 120 } });
  if (!res.ok) throw new Error(`Fetch failed ${res.status}: ${url}`);
  return res.json() as Promise<T>;
}

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
  close_time?: string;
  latest_expiration_time?: string;
  status?: string;
};

async function fetchKalshi(): Promise<ScreenerRow[]> {
  const all: KalshiMarket[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < KALSHI_MAX_PAGES; page++) {
    const params = new URLSearchParams({
      status: 'open',
      limit: '1000',
      mve_filter: 'exclude',
    });
    if (cursor) params.set('cursor', cursor);
    const data = await fetchJson<{ markets: KalshiMarket[]; cursor?: string }>(
      `https://api.elections.kalshi.com/trade-api/v2/markets?${params}`,
    );
    all.push(...(data.markets ?? []));
    cursor = data.cursor;
    if (!cursor || (data.markets?.length ?? 0) < 1000) break;
  }

  await warmKalshiSeriesTitles(
    all.map((m) => kalshiSeriesTicker(m.ticker, m.event_ticker)).filter((s): s is string => Boolean(s)),
  );

  const rows: ScreenerRow[] = [];
  for (const m of all) {
    const last = parseNum(m.last_price_dollars);
    const prev = parseNum(m.previous_price_dollars);
    const vol = parseNum(m.volume_fp);
    if (vol < 100 && last <= 0) continue;

    const eventTitle = m.yes_sub_title ?? m.subtitle ?? null;
    const change = prev > 0 || last > 0 ? last - prev : null;
    const series = kalshiSeriesTicker(m.ticker, m.event_ticker);
    rows.push({
      platform: 'kalshi',
      market_title: m.title ?? m.ticker ?? 'Unknown',
      event_title: eventTitle && eventTitle !== m.title ? eventTitle : null,
      probability: last,
      price_open: prev > 0 ? prev : null,
      price_high: change != null ? Math.max(last, prev) : null,
      price_low: change != null ? Math.min(last, prev) : null,
      change_1d: change,
      volume: vol,
      volume_24h: parseNum(m.volume_24h_fp) || null,
      days_to_resolution: daysUntil(m.close_time ?? m.latest_expiration_time),
      status: m.status ?? 'active',
      external_url: kalshiExternalUrl({
        ticker: m.ticker,
        eventTicker: m.event_ticker,
        seriesTicker: series,
        seriesTitle: series ? getCachedKalshiSeriesTitle(series) : null,
        title: m.title,
      }),
    });
  }

  return rows.sort((a, b) => b.volume - a.volume);
}

function predscopeToRows(
  markets: {
    title: string;
    event_title: string | null;
    probability: number;
    volume: number;
    volume_24h: number | null;
    change_1d?: number | null;
    status: string;
    external_url: string;
    source?: string;
  }[],
): ScreenerRow[] {
  return markets.map((m) => ({
    platform: 'polymarket' as const,
    market_title: m.title,
    event_title: m.event_title,
    probability: m.probability,
    price_open: m.change_1d != null ? m.probability - m.change_1d : null,
    price_high: null,
    price_low: null,
    change_1d: m.change_1d ?? null,
    volume: m.volume,
    volume_24h: m.volume_24h,
    days_to_resolution: null,
    status: m.status,
    external_url: m.external_url,
    source: m.source ?? 'predscope',
  }));
}

/** Fast core catalog: PredScope (1 req) + Kalshi page (1 req). */
async function refreshCoreCatalog(): Promise<ScreenerCatalog> {
  const { fetchPredScopeMarkets } = await import('@/lib/api/clients/predscope');

  const [predscopeRaw, kalshi] = await Promise.all([
    fetchPredScopeMarkets().catch(() => []),
    fetchKalshi().catch(() => [] as ScreenerRow[]),
  ]);

  const polymarket = predscopeToRows(
    predscopeRaw.map((m) => ({
      title: m.title,
      event_title: m.event_title,
      probability: m.probability,
      volume: m.volume,
      volume_24h: m.volume_24h,
      change_1d: m.change_1d,
      status: m.status,
      external_url: m.external_url,
      source: 'predscope',
    })),
  );

  cache = { at: Date.now(), polymarket, kalshi, manifold: [], extras: [] };
  return cache;
}

/** Secondary sources loaded in background - not on critical path. */
async function refreshExtras(): Promise<void> {
  const { fetchManifoldMarkets } = await import('@/lib/api/clients/manifold');
  const { fetchMetaculusQuestions } = await import('@/lib/api/clients/metaculus');

  const [manifoldRaw, metaculusRaw] = await Promise.all([
    fetchManifoldMarkets(25).catch(() => []),
    fetchMetaculusQuestions(15).catch(() => []),
  ]);

  if (!cache) return;

  cache.manifold = manifoldRaw.map((m) => ({
    platform: 'manifold' as const,
    market_title: m.title,
    event_title: m.event_title,
    probability: m.probability,
    price_open: null,
    price_high: null,
    price_low: null,
    change_1d: m.change_1d ?? null,
    volume: m.volume,
    volume_24h: m.volume_24h,
    days_to_resolution: null,
    status: m.status,
    external_url: m.external_url,
    source: 'manifold',
  }));

  cache.extras = metaculusRaw.map((m) => ({
    platform: 'metaculus' as const,
    market_title: m.title,
    event_title: m.event_title,
    probability: m.probability,
    price_open: null,
    price_high: null,
    price_low: null,
    change_1d: null,
    volume: m.volume,
    volume_24h: null,
    days_to_resolution: null,
    status: m.status,
    external_url: m.external_url,
    source: 'metaculus',
  }));
  cache.at = Date.now();
}

function scheduleExtrasRefresh(): void {
  if (extrasPromise) return;
  extrasPromise = refreshExtras().finally(() => {
    extrasPromise = null;
  });
}

export async function loadScreenerCatalog(): Promise<ScreenerCatalog> {
  if (cache && Date.now() - cache.at < CACHE_MS) {
    scheduleExtrasRefresh();
    return cache;
  }

  if (cache) {
    if (!refreshPromise) {
      refreshPromise = refreshCoreCatalog()
        .then((c) => {
          scheduleExtrasRefresh();
          return c;
        })
        .finally(() => {
          refreshPromise = null;
        });
    }
    return cache;
  }

  const core = await refreshCoreCatalog();
  scheduleExtrasRefresh();
  return core;
}

export function filterScreener(rows: ScreenerRow[], f: ScreenerFilters): ScreenerRow[] {
  const q = f.search.trim().toLowerCase();
  return rows.filter((r) => {
    if (f.platform !== 'all' && r.platform !== f.platform) return false;
    const pct = r.probability * 100;
    if (pct < f.prob_min || pct > f.prob_max) return false;
    if (f.volume_min > 0 && r.volume < f.volume_min) return false;
    if (f.days_max != null && f.days_max < 9999) {
      if (f.days_max === 0) {
        if (r.days_to_resolution !== 0) return false;
      } else if (r.days_to_resolution == null || r.days_to_resolution > f.days_max) {
        return false;
      }
    }
    if (f.days_max === 9999) {
      if (r.days_to_resolution == null || r.days_to_resolution <= 90) return false;
    }
    if (q) {
      const hay = `${r.market_title} ${r.event_title ?? ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return r.status === 'active' || r.status === 'open' || r.status === 'initialized';
  });
}

function filterMatchedRows(rows: ScreenerRow[], matchedTitles: { poly: string; kalshi: string }[]): ScreenerRow[] {
  if (!matchedTitles.length) return [];
  return rows.filter((r) => {
    for (const m of matchedTitles) {
      if (r.platform === 'polymarket' && titleSimilarity(r.market_title, m.poly) >= 0.35) return true;
      if (r.platform === 'kalshi' && titleSimilarity(r.market_title, m.kalshi) >= 0.35) return true;
    }
    return false;
  });
}

function buildFacets(catalog: ScreenerCatalog, combined: ScreenerRow[]): ScreenerFacets {
  return {
    total: combined.length,
    polymarket: catalog.polymarket.length,
    kalshi: catalog.kalshi.length,
    manifold: catalog.manifold.length,
    metaculus: catalog.extras.length,
  };
}

export async function getScreenerData(filters: ScreenerFilters) {
  const catalog = await loadScreenerCatalog();
  let combined = [
    ...catalog.polymarket,
    ...catalog.kalshi,
    ...catalog.manifold,
    ...catalog.extras,
  ];

  if (filters.matched_only) {
    const { pairs } = await getArbitragePairs(0);
    const matchedTitles = pairs.map((p) => ({ poly: p.poly_title, kalshi: p.kalshi_title }));
    combined = filterMatchedRows(combined, matchedTitles);
  }

  const filtered = filterScreener(combined, filters);
  filtered.sort((a, b) => (b.volume_24h ?? b.volume) - (a.volume_24h ?? a.volume));

  const facets = buildFacets(catalog, combined);

  return {
    rows: filtered.slice(filters.offset, filters.offset + filters.limit),
    total: filtered.length,
    facets,
    cached_at: catalog.at,
  };
}
