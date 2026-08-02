import { guardProApi } from '@/lib/auth/guardApi';
import { NextRequest } from 'next/server';
import { getArbitragePairs } from '@/services/arbitrage.service';
import { whaleError, whaleJson } from '@/lib/whale/api';

export async function GET(req: NextRequest) {
  const _denied = await guardProApi(req);
  if (_denied) return _denied;

  const sp = req.nextUrl.searchParams;
  const minSpread = parseFloat(sp.get('min_spread') ?? '0');

  try {
    const { pairs, byPolyTitle, cached_at } = await getArbitragePairs(minSpread, minSpread > 0);
    return whaleJson({ pairs, byPolyTitle, count: pairs.length, cached_at });
  } catch (e) {
    return whaleError(e);
  }
}
