/**
 * CORE API v3 client (https://api.core.ac.uk/).
 * Open access research papers. Requires CORE_API_KEY in env.
 */

const CORE_BASE = 'https://api.core.ac.uk/v3';

export interface CoreResult {
  title: string;
  url: string;
  content: string;
  doi?: string;
}

export interface CoreSearchResponse {
  query: string;
  results: CoreResult[];
  totalHits?: number;
}

export interface CoreSearchOptions {
  maxResults?: number;
}

/**
 * Search CORE works by query. Returns title, URL, and abstract/snippet
 * for use as context in the research pipeline.
 */
export async function coreSearch(
  query: string,
  options: CoreSearchOptions = {}
): Promise<CoreSearchResponse | null> {
  const apiKey = process.env.CORE_API_KEY;
  if (!apiKey?.trim()) {
    return null;
  }

  const { maxResults = 5 } = options;

  try {
    const res = await fetch(`${CORE_BASE}/search/works`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        q: query.trim(),
        limit: Math.min(20, maxResults),
        offset: 0,
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      const err = await res.text();
      console.warn('CORE search failed', { status: res.status, body: err });
      return null;
    }

    const data = (await res.json()) as {
      totalHits?: number;
      total_hits?: number;
      results?: Array<{
        metadata?: {
          title?: string;
          abstract?: string;
          doi?: string;
          authors?: Array<{ name?: string }>;
          yearPublished?: number;
          year_published?: number;
          publisher?: string;
        };
        id?: string;
        downloadUrl?: string;
        download_url?: string;
      }>;
      hits?: Array<{
        metadata?: {
          title?: string;
          abstract?: string;
          doi?: string;
          authors?: Array<{ name?: string }>;
          yearPublished?: number;
          year_published?: number;
          publisher?: string;
        };
        id?: string;
        downloadUrl?: string;
        download_url?: string;
      }>;
    };

    const items = data.results ?? data.hits ?? [];

    const results: CoreResult[] = items.map((item) => {
      const meta = item.metadata ?? {};
      const title = meta.title ?? 'Unknown';
      const doi = meta.doi;
      const downloadUrl = item.downloadUrl ?? item.download_url;
      const url = doi ? `https://doi.org/${doi}` : downloadUrl ?? `https://core.ac.uk/works/${item.id ?? ''}`;
      const abstract = meta.abstract ? meta.abstract.replace(/<[^>]+>/g, '').trim() : '';
      const authors = meta.authors?.slice(0, 3).map((a) => a.name).filter(Boolean).join(', ');
      const year = meta.yearPublished ?? meta.year_published;
      const content = abstract || [meta.publisher, authors, year].filter(Boolean).join(' — ') || title;

      return {
        title,
        url,
        content,
        doi,
      };
    });

    return {
      query,
      results,
      totalHits: data.totalHits ?? data.total_hits,
    };
  } catch (e) {
    console.warn('CORE search error', e);
    return null;
  }
}
