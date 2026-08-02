import { guardProApi } from '@/lib/auth/guardApi';
import { NextRequest } from 'next/server';
import { getActivity } from '@/lib/whale/queries';
import { whaleError, whaleJson } from '@/lib/whale/api';

export async function GET(req: NextRequest, { params }: { params: { wallet: string } }) {
  const _denied = await guardProApi(req);
  if (_denied) return _denied;

  const limit = parseInt(req.nextUrl.searchParams.get('limit') ?? '50', 10);
  try {
    return whaleJson(getActivity(params.wallet, limit));
  } catch (e) {
    return whaleError(e);
  }
}
