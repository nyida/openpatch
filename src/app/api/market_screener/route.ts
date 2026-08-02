import { guardProApi } from '@/lib/auth/guardApi';
import { NextRequest } from 'next/server';
import {
  filterScreener,
  getScreenerData,
  loadScreenerCatalog,
  type ScreenerFilters,
} from '@/lib/whale/screener';
import { cachedResponseAsync } from '@/lib/whale/responseCache';
import { whaleError, whaleJson } from '@/lib/whale/api';

const CATALOG_TTL = 120_000;

function parseFilters(sp: URLSearchParams): ScreenerFilters {
  const probBucket = sp.get('prob') ?? 'all';
  let prob_min = 0;
  let prob_max = 100;
  if (probBucket !== 'all') {
    const [a, b] = probBucket.split('-').map(Number);
    prob_min = a;
    prob_max = b;
  } else {
    prob_min = parseFloat(sp.get('prob_min') ?? '0');
    prob_max = parseFloat(sp.get('prob_max') ?? '100');
  }

  const daysRaw = sp.get('days');
  let days_max: number | null = null;
  if (daysRaw === '0') days_max = 0;
  else if (daysRaw === '9999') days_max = 9999;
  else if (daysRaw) days_max = parseInt(daysRaw, 10);

  return {
    platform: (sp.get('platform') ?? 'all') as ScreenerFilters['platform'],
    prob_min,
    prob_max,
    volume_min: parseFloat(sp.get('volume_min') ?? '0'),
    days_max,
    search: sp.get('search') ?? '',
    matched_only: sp.get('matched_only') === '1' || sp.get('matched_only') === 'true',
    limit: Math.min(parseInt(sp.get('limit') ?? '50', 10), 100),
    offset: parseInt(sp.get('offset') ?? '0', 10),
  };
}

export async function GET(req: NextRequest) {
  const _denied = await guardProApi(req);
  if (_denied) return _denied;

  const sp = req.nextUrl.searchParams;
  try {
    const filters = parseFilters(sp);

    // Heavy fetch cached once; filters applied in-process (fast).
    if (filters.matched_only) {
      const data = await cachedResponseAsync(
        `screener:matched:${sp.get('platform')}:${sp.get('search')}:${filters.offset}:${filters.limit}`,
        60_000,
        () => getScreenerData(filters),
      );
      return whaleJson(data);
    }

    const catalog = await cachedResponseAsync('screener:catalog:v3', CATALOG_TTL, loadScreenerCatalog, {
      staleMs: 300_000,
    });

    let combined = [
      ...catalog.polymarket,
      ...catalog.kalshi,
      ...catalog.manifold,
      ...catalog.extras,
    ];

    const filtered = filterScreener(combined, filters);
    filtered.sort((a, b) => (b.volume_24h ?? b.volume) - (a.volume_24h ?? a.volume));

    const facets = {
      total: combined.length,
      polymarket: catalog.polymarket.length,
      kalshi: catalog.kalshi.length,
      manifold: catalog.manifold.length,
      metaculus: catalog.extras.length,
    };

    return whaleJson({
      rows: filtered.slice(filters.offset, filters.offset + filters.limit),
      total: filtered.length,
      facets,
      cached_at: catalog.at,
    });
  } catch (e) {
    return whaleError(e);
  }
}
