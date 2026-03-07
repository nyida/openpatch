/**
 * CORTEX: proxy to Python FastAPI backend for confidence-optimized routing.
 * Set CORTEX_API_URL (default http://localhost:8000) to point to the Cortex backend.
 */
import { NextRequest, NextResponse } from 'next/server';

const CORTEX_API_URL = process.env.CORTEX_API_URL ?? 'http://localhost:8000';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
    if (!prompt) {
      return NextResponse.json({ error: 'prompt required' }, { status: 400 });
    }
    const res = await fetch(`${CORTEX_API_URL.replace(/\/$/, '')}/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    });
    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { error: `CORTEX backend error: ${res.status} ${text}` },
        { status: 502 }
      );
    }
    const data = await res.json();
    return NextResponse.json(data);
  } catch (e) {
    console.error('CORTEX proxy error', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'CORTEX proxy failed' },
      { status: 500 }
    );
  }
}
