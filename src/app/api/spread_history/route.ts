import { guardProApi } from '@/lib/auth/guardApi';
import { NextRequest } from 'next/server';
import { getSpreadHistory, getSpreadHistoryByTitle } from '@/services/cacheService';
import { whaleError, whaleJson } from '@/lib/whale/api';

export async function GET(req: NextRequest) {
  const _denied = await guardProApi(req);
  if (_denied) return _denied;

  const sp = req.nextUrl.searchParams;
  const id = sp.get('id');
  const title = sp.get('title');
  try {
    const points = id ? getSpreadHistory(id) : title ? getSpreadHistoryByTitle(title) : [];
    return whaleJson({ points, count: points.length });
  } catch (e) {
    return whaleError(e);
  }
}
