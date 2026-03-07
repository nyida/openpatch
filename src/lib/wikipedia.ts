/**
 * Wikipedia API client (https://en.wikipedia.org/w/api.php).
 * No API key required; use for general knowledge and definitions.
 */

const WIKIPEDIA_API = 'https://en.wikipedia.org/w/api.php';

export interface WikipediaResult {
  title: string;
  url: string;
  content: string;
  pageId?: number;
}

export interface WikipediaSearchResponse {
  query: string;
  results: WikipediaResult[];
}

export interface WikipediaSearchOptions {
  maxResults?: number;
}

/**
 * Search Wikipedia and return title, URL, and snippet for each result.
 * Uses action=query&list=search; no auth required.
 */
export async function wikipediaSearch(
  query: string,
  options: WikipediaSearchOptions = {}
): Promise<WikipediaSearchResponse | null> {
  const { maxResults = 5 } = options;

  try {
    const params = new URLSearchParams({
      action: 'query',
      list: 'search',
      srsearch: query.trim(),
      format: 'json',
      origin: '*',
      srlimit: String(Math.min(10, maxResults)),
    });
    const url = `${WIKIPEDIA_API}?${params}`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'OpenPatch/1.0 (research pipeline; https://github.com)' },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      const err = await res.text();
      console.warn('Wikipedia search failed', { status: res.status, body: err });
      return null;
    }

    const data = (await res.json()) as {
      query?: {
        search?: Array<{
          title?: string;
          pageid?: number;
          snippet?: string;
        }>;
      };
    };

    const search = data.query?.search ?? [];

    const results: WikipediaResult[] = search.map((item) => {
      const title = item.title ?? 'Unknown';
      const slug = encodeURIComponent(title.replace(/ /g, '_'));
      const url = `https://en.wikipedia.org/wiki/${slug}`;
      const content = (item.snippet ?? '').replace(/<[^>]+>/g, '').trim();

      return {
        title,
        url,
        content: content || title,
        pageId: item.pageid,
      };
    });

    return {
      query,
      results,
    };
  } catch (e) {
    console.warn('Wikipedia search error', e);
    return null;
  }
}
