import { guardProApi } from '@/lib/auth/guardApi';
import { NextResponse } from 'next/server';
import { fetchPmxtArbitrage } from '@/lib/api/pmxt-scanner';
import { cachedResponseAsync } from '@/lib/whale/responseCache';

const CACHE_MS = 30_000;

export async function GET(request: Request) {
  const _denied = await guardProApi(request);
  if (_denied) return _denied;

  try {
    const data = await cachedResponseAsync('pmxt-arbitrage-v2', CACHE_MS, fetchPmxtArbitrage, {
      staleMs: 60_000,
    });

    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to fetch PMXT arbitrage data';
    const rateLimited = /rate exceeded|too many|429/i.test(message);
    return NextResponse.json(
      { error: message, opportunities: [], total: 0, cached_at: Date.now() },
      {
        status: rateLimited ? 429 : 502,
        headers: {
          'Cache-Control': 'no-store',
          ...(rateLimited ? { 'Retry-After': '30' } : {}),
        },
      },
    );
  }
}
