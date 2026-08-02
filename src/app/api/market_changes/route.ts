import { guardProApi } from '@/lib/auth/guardApi';
import { aggregateChanges } from '@/lib/api/aggregator';
import { cachedResponseAsync } from '@/lib/whale/responseCache';
import { whaleError, whaleJson } from '@/lib/whale/api';

const CACHE_MS = 60_000;

export async function GET(req: Request) {
  const _denied = await guardProApi(req);
  if (_denied) return _denied;

  try {
    const since = new URL(req.url).searchParams.get('since') ?? '1h';
    const data = await cachedResponseAsync(`market_changes:${since}`, CACHE_MS, () =>
      aggregateChanges(since),
    );
    return whaleJson(data);
  } catch (e) {
    return whaleError(e);
  }
}
