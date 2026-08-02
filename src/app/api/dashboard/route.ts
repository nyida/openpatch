import { guardProApi } from '@/lib/auth/guardApi';
import { getDashboard } from '@/lib/whale/queries';
import type { Platform } from '@/lib/whale/utils';
import { cachedResponse } from '@/lib/whale/responseCache';
import { whaleError, whaleJson } from '@/lib/whale/api';

const CACHE_MS = 60_000;

export async function GET(req: Request) {
  const _denied = await guardProApi(req);
  if (_denied) return _denied;

  try {
    const platform = new URL(req.url).searchParams.get('platform') ?? 'all';
    const data = cachedResponse(`dashboard:${platform}`, CACHE_MS, () =>
      getDashboard(platform as Platform | 'all'),
    );
    return whaleJson(data);
  } catch (e) {
    return whaleError(e);
  }
}
