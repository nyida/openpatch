import { guardProApi } from '@/lib/auth/guardApi';
import { NextRequest } from 'next/server';
import { getTraders } from '@/lib/whale/queries';
import { checkApiKey, apiUnauthorized } from '@/lib/apiAuth';
import { whaleError, whaleJson } from '@/lib/whale/api';

export async function GET(req: NextRequest) {
  const _denied = await guardProApi(req);
  if (_denied) return _denied;

  if (!checkApiKey(req)) return apiUnauthorized();

  const sp = req.nextUrl.searchParams;
  const limit = Math.min(parseInt(sp.get('limit') ?? '25', 10), 250);

  try {
    const traders = getTraders().slice(0, limit).map((t) => ({
      wallet: t.wallet,
      display_name: t.display_name,
      alltime_profit: t.alltime_profit,
      rank: t.rank,
    }));

    return whaleJson({ whales: traders, count: traders.length });
  } catch (e) {
    return whaleError(e);
  }
}
