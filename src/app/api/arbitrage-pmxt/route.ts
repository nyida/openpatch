import { NextResponse } from 'next/server';
import { fetchPmxtArbitrage } from '@/lib/api/pmxt-scanner';
import { cachedResponseAsync } from '@/lib/whale/responseCache';

const CACHE_MS = 30_000;

export async function GET() {
  try {
    const data = await cachedResponseAsync('pmxt-arbitrage', CACHE_MS, fetchPmxtArbitrage);
    return NextResponse.json(data);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to fetch PMXT arbitrage data';
    return NextResponse.json({ error: message, opportunities: [], cached_at: Date.now() }, { status: 502 });
  }
}
