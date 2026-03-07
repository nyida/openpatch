/**
 * Crossref REST API client (https://api.crossref.org/).
 * No API key required; use for scholarly metadata and citations.
 */

const CROSSREF_BASE = 'https://api.crossref.org';

export interface CrossrefResult {
  title: string;
  url: string;
  content: string;
  doi?: string;
}

export interface CrossrefSearchResponse {
  query: string;
  results: CrossrefResult[];
  totalResults?: number;
}

export interface CrossrefSearchOptions {
  maxResults?: number;
}

/**
 * Search Crossref works by query. Returns title, DOI URL, and abstract/snippet
 * for use as context in the research pipeline.
 */
export async function crossrefSearch(
  query: string,
  options: CrossrefSearchOptions = {}
): Promise<CrossrefSearchResponse | null> {
  const { maxResults = 5 } = options;

  try {
    const params = new URLSearchParams({
      query: query.trim(),
      rows: String(Math.min(20, maxResults)),
    });
    const url = `${CROSSREF_BASE}/works?${params}`;
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(12000),
    });

    if (!res.ok) {
      const err = await res.text();
      console.warn('Crossref search failed', { status: res.status, body: err });
      return null;
    }

    const data = (await res.json()) as {
      status?: string;
      message?: {
        'total-results'?: number;
        items?: Array<{
          title?: string[];
          DOI?: string;
          URL?: string;
          abstract?: string;
          'container-title'?: string[];
          author?: Array<{ given?: string; family?: string }>;
        }>;
      };
    };

    const items = data.message?.items ?? [];
    const totalResults = data.message?.['total-results'];

    const results: CrossrefResult[] = items.map((item) => {
      const title = item.title?.[0] ?? 'Unknown';
      const doi = item.DOI;
      const url = item.URL ?? (doi ? `https://doi.org/${doi}` : '');
      const abstract = item.abstract
        ? item.abstract.replace(/<[^>]+>/g, '').trim()
        : '';
      const container = item['container-title']?.[0];
      const authors = item.author
        ?.slice(0, 3)
        .map((a) => [a.given, a.family].filter(Boolean).join(' '))
        .join(', ');
      const content = abstract || [container, authors].filter(Boolean).join(' — ') || title;

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
      totalResults,
    };
  } catch (e) {
    console.warn('Crossref search error', e);
    return null;
  }
}
