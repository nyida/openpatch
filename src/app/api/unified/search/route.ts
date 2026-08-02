import { guardProApi } from '@/lib/auth/guardApi';
import { NextRequest } from 'next/server';
import { searchAllVenues } from '@/services/searchService';
import { whaleError, whaleJson } from '@/lib/whale/api';
import type { Venue } from '@/services/types';

export async function GET(req: NextRequest) {
  const _denied = await guardProApi(req);
  if (_denied) return _denied;

  const sp = req.nextUrl.searchParams;
  const q = sp.get('q') ?? '';
  const venue = (sp.get('venue') ?? 'all') as 'all' | Venue;
  const minVolume = parseFloat(sp.get('min_volume') ?? '0');
  const category = sp.get('category') ?? 'all';
  const limit = parseInt(sp.get('limit') ?? '40', 10);

  try {
    const results = await searchAllVenues({
      q,
      venue,
      min_volume: minVolume,
      category,
      limit,
    });
    return whaleJson({ results, count: results.length });
  } catch (e) {
    return whaleError(e);
  }
}
