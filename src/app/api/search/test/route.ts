import { NextResponse } from 'next/server';
import { searchWeb } from '@/lib/searxng';

/**
 * GET /api/search/test
 * Verifies SearXNG integration by running a sample search.
 */
export async function GET() {
  const result = await searchWeb('OpenPatch verification research', {
    maxResults: 5,
    timeoutMs: 10_000,
  });

  if (!result) {
    return NextResponse.json(
      {
        ok: false,
        error: 'SearXNG search failed. Is the service running at SEARXNG_BASE_URL (default http://localhost:8080)?',
      },
      { status: 503 }
    );
  }

  return NextResponse.json({
    ok: true,
    query: result.query,
    resultCount: result.results.length,
    results: result.results,
  });
}
