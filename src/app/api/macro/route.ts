import { guardProApi } from '@/lib/auth/guardApi';
import { aggregateMacro } from '@/lib/api/aggregator';
import { cachedResponseAsync } from '@/lib/whale/responseCache';
import { whaleError, whaleJson } from '@/lib/whale/api';

const CACHE_MS = 300_000;

export async function GET(request: Request) {
  const _denied = await guardProApi(request);
  if (_denied) return _denied;

  try {
    const data = await cachedResponseAsync('macro:fred', CACHE_MS, aggregateMacro);
    return whaleJson(data);
  } catch (e) {
    return whaleError(e);
  }
}
