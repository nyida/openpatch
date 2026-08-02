import { guardProApi } from '@/lib/auth/guardApi';
import { NextRequest } from 'next/server';
import { getArbitragePairs } from '@/services/arbitrage.service';
import { checkApiKey, apiUnauthorized } from '@/lib/apiAuth';
import { whaleError, whaleJson } from '@/lib/whale/api';
import { resolveExternalUrl } from '@/lib/whale/marketUrls';

export async function GET(req: NextRequest) {
  const _denied = await guardProApi(req);
  if (_denied) return _denied;

  if (!checkApiKey(req)) return apiUnauthorized();

  const sp = req.nextUrl.searchParams;
  const limit = Math.min(parseInt(sp.get('limit') ?? '10', 10), 50);
  const minSpread = parseFloat(sp.get('min_spread') ?? '0.02');

  try {
    const { pairs, cached_at } = await getArbitragePairs(minSpread, true);
    const top = pairs.slice(0, limit).map((p) => ({
      id: p.id,
      title: p.title,
      poly_title: p.poly_title,
      kalshi_title: p.kalshi_title,
      poly_price: p.poly_price,
      kalshi_price: p.kalshi_price,
      gross_spread_cents: p.roi.grossSpreadCents,
      net_profit_cents: p.net_profit_cents,
      net_profit_pct: p.net_profit_pct,
      direction: p.direction,
      tier: p.roi.tier,
      last_seen_at: p.last_seen_at,
      poly_url: p.poly_url,
      kalshi_url: resolveExternalUrl('kalshi', p.kalshi_title, p.kalshi_url),
    }));

    return whaleJson({
      arbs: top,
      count: top.length,
      total_matching: pairs.length,
      cached_at,
      min_spread: minSpread,
    });
  } catch (e) {
    return whaleError(e);
  }
}
