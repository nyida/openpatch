const TAVILY_SEARCH_URL = 'https://api.tavily.com/search';

export interface TavilyResult {
  title: string;
  url: string;
  content: string;
  score?: number;
}

export interface TavilyImage {
  url: string;
  description?: string;
}

export interface TavilySearchResponse {
  query: string;
  results: TavilyResult[];
  images?: TavilyImage[];
  answer?: string;
}

export interface TavilySearchOptions {
  maxResults?: number;
  searchDepth?: 'basic' | 'advanced' | 'fast' | 'ultra-fast';
  includeImages?: boolean;
  includeImageDescriptions?: boolean;
}

/**
 * Run a web search via Tavily. Requires TAVILY_API_KEY in env.
 * Returns search results (and optionally images) for use as context.
 */
export async function tavilySearch(
  query: string,
  options: TavilySearchOptions = {}
): Promise<TavilySearchResponse | null> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey?.trim()) {
    return null;
  }

  const {
    maxResults = 8,
    searchDepth = 'basic',
    includeImages = true,
    includeImageDescriptions = true,
  } = options;

  try {
    const res = await fetch(TAVILY_SEARCH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        query,
        max_results: maxResults,
        search_depth: searchDepth,
        include_images: includeImages,
        include_image_descriptions: includeImageDescriptions,
        include_answer: false,
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      const err = await res.text();
      console.warn('Tavily search failed', { status: res.status, body: err });
      return null;
    }

    const data = (await res.json()) as {
      query?: string;
      results?: Array<{ title?: string; url?: string; content?: string; score?: number }>;
      images?: Array<{ url?: string; description?: string }>;
      answer?: string;
    };

    return {
      query: data.query ?? query,
      results: (data.results ?? []).map((r) => ({
        title: r.title ?? '',
        url: r.url ?? '',
        content: r.content ?? '',
        score: r.score,
      })),
      images: data.images?.map((img) => ({
        url: img.url ?? '',
        description: img.description,
      })),
      answer: data.answer,
    };
  } catch (e) {
    console.warn('Tavily search error', e);
    return null;
  }
}
