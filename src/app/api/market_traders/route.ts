import { guardProApi } from '@/lib/auth/guardApi';
import { NextRequest } from 'next/server';
import { getMarketTraders } from '@/lib/whale/queries';
import { whaleError, whaleJson } from '@/lib/whale/api';

export async function GET(req: NextRequest) {
  const _denied = await guardProApi(req);
  if (_denied) return _denied;

  const sp = req.nextUrl.searchParams;
  const market = sp.get('market');
  if (!market) {
    return whaleJson({ error: 'Missing market parameter' }, 400);
  }
  const platform = sp.get('platform') ?? 'polymarket';
  try {
    return whaleJson(getMarketTraders(market, platform));
  } catch (e) {
    return whaleError(e);
  }
}
