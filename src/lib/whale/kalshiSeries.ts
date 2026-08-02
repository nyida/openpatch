/** In-memory Kalshi series title cache for correct web URLs. */

const titles = new Map<string, string>();
const KALSHI = process.env.KALSHI_API_URL ?? 'https://api.elections.kalshi.com/trade-api/v2';

export function getCachedKalshiSeriesTitle(seriesTicker: string): string | null {
  return titles.get(seriesTicker.toUpperCase()) ?? null;
}

export function setCachedKalshiSeriesTitle(seriesTicker: string, title: string) {
  const key = seriesTicker.toUpperCase();
  const t = title.trim();
  if (key && t) titles.set(key, t);
}

/** Resolve series titles for a set of series tickers (best-effort, concurrent). */
export async function warmKalshiSeriesTitles(seriesTickers: Iterable<string>): Promise<void> {
  const missing = [...new Set([...seriesTickers].map((s) => s.toUpperCase()).filter(Boolean))].filter(
    (s) => !titles.has(s),
  );
  if (missing.length === 0) return;

  await Promise.all(
    missing.map(async (series) => {
      try {
        const res = await fetch(`${KALSHI}/series/${encodeURIComponent(series)}`, {
          cache: 'force-cache',
        });
        if (!res.ok) return;
        const data = (await res.json()) as { series?: { title?: string } };
        const title = data.series?.title?.trim();
        if (title) titles.set(series, title);
      } catch {
        /* ignore - URL builder will fall back */
      }
    }),
  );
}
