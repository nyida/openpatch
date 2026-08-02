import { guardProApi } from '@/lib/auth/guardApi';
import { NextRequest } from 'next/server';
import { getLiveWhaleCount, getLiveWhales } from '@/lib/whale/queries';
import { cachedResponse } from '@/lib/whale/responseCache';
import { whaleError, whaleJson } from '@/lib/whale/api';

const CACHE_MS = 8_000;

export async function GET(req: NextRequest) {
  const _denied = await guardProApi(req);
  if (_denied) return _denied;

  const sp = req.nextUrl.searchParams;
  const minSize = parseFloat(sp.get('min_size') ?? '500');
  const platform = sp.get('platform') ?? 'all';
  const category = sp.get('category') ?? 'all';
  const limit = parseInt(sp.get('limit') ?? '500', 10);
  const cacheKey = `live:${minSize}:${platform}:${category}:${limit}`;
  try {
    const data = cachedResponse(cacheKey, CACHE_MS, () => ({
      trades: getLiveWhales(minSize, platform, limit, category),
      total: getLiveWhaleCount(minSize, platform, category),
    }));
    return whaleJson(data);
  } catch (e) {
    return whaleError(e);
  }
}
