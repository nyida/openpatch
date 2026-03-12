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
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120_000);
    const res = await fetch(`${CORTEX_API_URL.replace(/\/$/, '')}/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
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
    const msg = e instanceof Error ? e.message : 'CORTEX proxy failed';
    const isConnection =
      msg.includes('ECONNREFUSED') ||
      msg.includes('ECONNRESET') ||
      msg.includes('ENOTFOUND') ||
      msg.includes('fetch failed') ||
      msg.includes('Failed to fetch') ||
      msg.includes('abort');
    const error = isConnection
      ? 'CORTEX backend unreachable. Ensure it is running at ' + CORTEX_API_URL
      : msg;
    return NextResponse.json({ error }, { status: isConnection ? 503 : 500 });
  }
}
