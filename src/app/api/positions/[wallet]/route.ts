import { guardProApi } from '@/lib/auth/guardApi';
import { getPositions } from '@/lib/whale/queries';
import { whaleError, whaleJson } from '@/lib/whale/api';

export async function GET(_req: Request, { params }: { params: { wallet: string } }) {
  const _denied = await guardProApi(_req);
  if (_denied) return _denied;

  try {
    return whaleJson(getPositions(params.wallet));
  } catch (e) {
    return whaleError(e);
  }
}
