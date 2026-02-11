import * as cheerio from 'cheerio';
import { logger } from '@/lib/logger';

export async function fetchUrlContent(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'OpenPatch/1.0' },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const html = await res.text();
    const $ = cheerio.load(html);
    $('script, style, nav, footer').remove();
    const text = $('body').text().replace(/\s+/g, ' ').trim().slice(0, 100000);
    return text || null;
  } catch (e) {
    logger.warn('URL fetch failed', { url, error: String(e) });
    return null;
  }
}
