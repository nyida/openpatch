import { guardProApi } from '@/lib/auth/guardApi';
import { getAllTraders } from '@/lib/whale/queries';
import { cachedResponse } from '@/lib/whale/responseCache';
import { whaleError, whaleJson } from '@/lib/whale/api';

const CACHE_MS = 60_000;

export async function GET(request: Request) {
  const _denied = await guardProApi(request);
  if (_denied) return _denied;

  try {
    return whaleJson(cachedResponse('all-traders', CACHE_MS, getAllTraders));
  } catch (e) {
    return whaleError(e);
  }
}
