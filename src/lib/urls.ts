import * as cheerio from 'cheerio';
import { logger } from '@/lib/logger';

const MAX_IMAGES_PER_PAGE = 15;

function resolveUrl(base: string, href: string): string {
  try {
    return new URL(href, base).href;
  } catch {
    return href;
  }
}

export async function fetchUrlContentAndImages(
  url: string
): Promise<{ text: string | null; imageUrls: string[] }> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'OpenPatch/1.0' },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return { text: null, imageUrls: [] };
    const html = await res.text();
    const $ = cheerio.load(html);
    $('script, style, nav, footer').remove();
    const text = $('body').text().replace(/\s+/g, ' ').trim().slice(0, 100000) || null;

    const imageUrls: string[] = [];
    $('img').each((_, el) => {
      const src = $(el).attr('src');
      if (src && !src.startsWith('data:')) {
        const absolute = resolveUrl(url, src);
        if (!imageUrls.includes(absolute)) imageUrls.push(absolute);
      }
    });

    return { text: text ?? null, imageUrls: imageUrls.slice(0, MAX_IMAGES_PER_PAGE) };
  } catch (e) {
    logger.warn('URL fetch failed', { url, error: String(e) });
    return { text: null, imageUrls: [] };
  }
}

export async function fetchUrlContent(url: string): Promise<string | null> {
  const result = await fetchUrlContentAndImages(url);
  return result.text;
}
