import { guardProApi } from '@/lib/auth/guardApi';
import { getAllMarkets } from '@/lib/whale/queries';
import { whaleError, whaleJson } from '@/lib/whale/api';

export async function GET(request: Request) {
  const _denied = await guardProApi(request);
  if (_denied) return _denied;

  try {
    return whaleJson(getAllMarkets());
  } catch (e) {
    return whaleError(e);
  }
}
