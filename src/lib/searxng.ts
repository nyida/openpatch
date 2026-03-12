/**
 * SearXNG web search client.
 * Calls a self-hosted SearXNG instance at SEARXNG_BASE_URL (default http://localhost:8080).
 * No API key required.
 */

const DEFAULT_BASE = 'http://localhost:8080';
const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_RETRIES = 2;

export interface SearXNGResult {
  title: string;
  url: string;
  content: string;
  engine?: string;
}

export interface SearXNGImage {
  url: string;
  thumbnail?: string;
  title?: string;
  source?: string;
}

export interface SearXNGSearchResponse {
  query: string;
  results: SearXNGResult[];
  images?: SearXNGImage[];
}

/** Raw SearXNG JSON response shape */
interface SearXNGRawResult {
  url?: string;
  title?: string;
  content?: string;
  engine?: string;
  img_src?: string;
  thumbnail_src?: string;
  [key: string]: unknown;
}

interface SearXNGRawResponse {
  query?: string;
  results?: SearXNGRawResult[];
  [key: string]: unknown;
}

async function fetchSearXNG(
  baseUrl: string,
  params: URLSearchParams,
  timeoutMs: number
): Promise<SearXNGRawResponse | null> {
  const url = `${baseUrl}/search?${params.toString()}`;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      const res = await fetch(url, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (!res.ok) throw new Error(`SearXNG HTTP ${res.status}`);
      return (await res.json()) as SearXNGRawResponse;
    } catch {
      if (attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
      }
    }
  }
  return null;
}

/**
 * Run a web search via local SearXNG.
 * Optionally fetches images in parallel for visual context.
 */
export async function searchWeb(
  query: string,
  options: { maxResults?: number; maxImages?: number; timeoutMs?: number; includeImages?: boolean } = {}
): Promise<SearXNGSearchResponse | null> {
  const baseUrl = (process.env.SEARXNG_BASE_URL ?? DEFAULT_BASE).replace(/\/$/, '');
  const {
    maxResults = 8,
    maxImages = 8,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    includeImages = true,
  } = options;

  const q = query.trim();
  if (!q) return null;

  const webParams = new URLSearchParams({ q, format: 'json' });
  const imageParams = new URLSearchParams({
    q,
    format: 'json',
    categories: 'images',
  });

  const [webData, imageData] = await Promise.all([
    fetchSearXNG(baseUrl, webParams, timeoutMs),
    includeImages ? fetchSearXNG(baseUrl, imageParams, timeoutMs) : Promise.resolve(null),
  ]);

  if (!webData) {
    // Skip warning during Next.js production build (SearXNG typically unavailable)
    if (process.env.NEXT_PHASE !== 'phase-production-build') {
      console.warn('SearXNG web search failed', { query: q.slice(0, 50) });
    }
    return null;
  }

  const rawResults = webData.results ?? [];
  const results: SearXNGResult[] = rawResults
    .slice(0, maxResults)
    .filter((r) => r?.url)
    .map((r) => ({
      title: String(r.title ?? '').trim() || 'Untitled',
      url: String(r.url ?? ''),
      content: String(r.content ?? '').trim(),
      engine: r.engine ? String(r.engine) : undefined,
    }));

  let images: SearXNGImage[] | undefined;
  if (imageData?.results?.length) {
    images = imageData.results
      .filter((r) => r?.img_src || r?.url)
      .slice(0, maxImages)
      .map((r) => ({
        url: String(r.img_src ?? r.url ?? ''),
        thumbnail: r.thumbnail_src ? String(r.thumbnail_src) : undefined,
        title: r.title ? String(r.title) : undefined,
        source: r.url ? String(r.url) : undefined,
      }));
  }

  return {
    query: webData.query ?? query,
    results,
    ...(images?.length ? { images } : {}),
  };
}
