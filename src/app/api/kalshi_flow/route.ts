import { guardProApi } from '@/lib/auth/guardApi';
import { NextRequest } from 'next/server';
import { getKalshiNetFlow } from '@/lib/whale/queries';
import { cachedResponse } from '@/lib/whale/responseCache';
import { whaleError, whaleJson } from '@/lib/whale/api';

const CACHE_MS = 20_000;

export async function GET(req: NextRequest) {
  const _denied = await guardProApi(req);
  if (_denied) return _denied;

  const sp = req.nextUrl.searchParams;
  const hours = parseFloat(sp.get('hours') ?? '1');
  const minSize = parseFloat(sp.get('min_size') ?? '0');
  const limit = parseInt(sp.get('limit') ?? '1000', 10);
  const cacheKey = `kalshi_flow:${hours}:${minSize}:${limit}`;
  try {
    const data = cachedResponse(cacheKey, CACHE_MS, () => ({
      flows: getKalshiNetFlow(hours, minSize, limit),
      count: 0,
    }));
    return whaleJson({ flows: data.flows, count: data.flows.length });
  } catch (e) {
    return whaleError(e);
  }
}
