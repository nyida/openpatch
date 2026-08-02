import { guardProApi } from '@/lib/auth/guardApi';
import { aggregateMarkets } from '@/lib/api/aggregator';
import { cachedResponseAsync } from '@/lib/whale/responseCache';
import { whaleError, whaleJson } from '@/lib/whale/api';

const CACHE_MS = 90_000;

export async function GET(req: Request) {
  const _denied = await guardProApi(req);
  if (_denied) return _denied;

  try {
    const url = new URL(req.url);
    const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '200', 10) || 200, 500);
    const includeManifold = url.searchParams.get('manifold') !== 'false';
    const includeMetaculus = url.searchParams.get('metaculus') === 'true';

    const data = await cachedResponseAsync(`markets:aggregate:${limit}:${includeManifold}:${includeMetaculus}`, CACHE_MS, () =>
      aggregateMarkets({ limit, includeManifold, includeMetaculus }),
    );
    return whaleJson(data);
  } catch (e) {
    return whaleError(e);
  }
}
