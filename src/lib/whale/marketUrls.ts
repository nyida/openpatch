/** Build reliable outbound links to Polymarket / Kalshi. */

import { getCachedKalshiSeriesTitle } from './kalshiSeries';

type PolySlugSource = {
  slug?: string | null;
  question?: string | null;
  events?: { slug?: string | null; title?: string | null }[] | null;
};

export type KalshiUrlOpts = {
  ticker?: string | null;
  eventTicker?: string | null;
  seriesTicker?: string | null;
  title?: string | null;
  seriesTitle?: string | null;
};

function titleToSlug(title: string): string {
  return title
    .replace(/\s*\[(YES|NO)\]\s*$/i, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Series ticker is the prefix before the first `-` (e.g. KXHIGHNY-25AUG01-T60 → KXHIGHNY). */
export function kalshiSeriesTicker(
  ticker?: string | null,
  eventTicker?: string | null,
): string | null {
  const source = (eventTicker || ticker || '').trim();
  if (!source) return null;
  const series = source.split('-')[0]?.trim();
  return series || null;
}

/** True when a path segment looks like a full market/event ticker, not a series. */
function isKalshiMarketOrEventTicker(segment: string): boolean {
  return /^[A-Z0-9]+-\d/i.test(segment);
}

function parseKalshiUrl(stored: string): {
  series?: string;
  event?: string;
  market?: string;
} {
  try {
    const u = new URL(stored);
    const marketQ = u.searchParams.get('market') || u.searchParams.get('ticker') || undefined;
    const parts = u.pathname.split('/').filter(Boolean);
    if (parts[0]?.toLowerCase() !== 'markets') return { market: marketQ?.toUpperCase() };

    // Legacy: /markets/{FULL_MARKET_TICKER}
    if (parts.length === 1 || (parts.length === 2 && isKalshiMarketOrEventTicker(parts[1]))) {
      const market = (marketQ || parts[parts.length === 1 ? 0 : 1]).toUpperCase();
      const series = kalshiSeriesTicker(market) ?? undefined;
      const segs = market.split('-');
      const event =
        segs.length >= 3 ? segs.slice(0, -1).join('-') : segs.length === 2 ? market : undefined;
      return { series, event, market };
    }

    // Canonical: /markets/{series}/{slug}/{event}
    const series = parts[1]?.toUpperCase();
    const last = parts[parts.length - 1];
    const event =
      parts.length >= 3 && isKalshiMarketOrEventTicker(last) ? last.toUpperCase() : undefined;
    return { series, event, market: marketQ?.toUpperCase() };
  } catch {
    return {};
  }
}

/**
 * Canonical Kalshi web URL:
 *   /markets/{series}/{series-title-slug}/{event}
 * The middle segment must be the series title (e.g. "cpi-core"), NOT the market question.
 */
export function kalshiExternalUrl(
  tickerOrOpts?: string | null | KalshiUrlOpts,
  titleLegacy?: string | null,
): string {
  const opts: KalshiUrlOpts =
    tickerOrOpts != null && typeof tickerOrOpts === 'object'
      ? tickerOrOpts
      : { ticker: tickerOrOpts, title: titleLegacy };

  const series =
    opts.seriesTicker?.trim() ||
    kalshiSeriesTicker(opts.ticker, opts.eventTicker);

  if (!series) {
    const q = opts.title?.trim();
    if (q) return `https://kalshi.com/search?q=${encodeURIComponent(q)}`;
    return 'https://kalshi.com';
  }

  const seriesPath = series.toLowerCase();
  const seriesTitle =
    opts.seriesTitle?.trim() ||
    getCachedKalshiSeriesTitle(series) ||
    series;
  const slug = titleToSlug(seriesTitle) || seriesPath;
  const event = opts.eventTicker?.trim().toLowerCase();

  if (event) {
    return `https://kalshi.com/markets/${seriesPath}/${slug}/${event}`;
  }
  return `https://kalshi.com/markets/${seriesPath}/${slug}`;
}

/** Polymarket `/event/` pages use the event slug, not the market slug. */
export function polymarketExternalUrl(source: PolySlugSource): string {
  const eventSlug = source.events?.[0]?.slug?.trim();
  if (eventSlug) return `https://polymarket.com/event/${eventSlug}`;

  const title = source.question?.trim();
  if (title) return `https://polymarket.com/search?q=${encodeURIComponent(title)}`;

  return 'https://polymarket.com';
}

export function platformExternalUrl(
  platform: string,
  opts: { title: string; ticker?: string | null; eventTicker?: string | null; poly?: PolySlugSource | null },
): string {
  const q = encodeURIComponent(opts.title);
  switch (platform.toLowerCase()) {
    case 'kalshi':
      return kalshiExternalUrl({
        ticker: opts.ticker,
        eventTicker: opts.eventTicker,
        title: opts.title,
      });
    case 'manifold':
      return `https://manifold.markets/search?q=${q}`;
    case 'predictit':
      return `https://www.predictit.org/markets/search?query=${q}`;
    case 'myriad':
      return `https://myriad.markets/search?q=${q}`;
    default:
      if (opts.poly) return polymarketExternalUrl({ ...opts.poly, question: opts.title });
      return `https://polymarket.com/search?q=${q}`;
  }
}

/** Normalize stored DB URLs - always rebuild Kalshi links into the canonical series/slug/event form. */
export function resolveExternalUrl(
  platform: string,
  title: string,
  stored: string | null | undefined,
  opts?: { ticker?: string | null; eventTicker?: string | null },
): string {
  if (platform === 'polymarket' && stored?.includes('polymarket.com/event/')) {
    const slug = stored.split('/event/')[1]?.split(/[?#]/)[0] ?? '';
    // Scraped URLs often put the market question slug in /event/ - those 404.
    if (slug === titleToSlug(title)) {
      return `https://polymarket.com/search?q=${encodeURIComponent(title)}`;
    }
    return stored;
  }

  if (platform === 'kalshi') {
    const parsed = stored?.includes('kalshi.com') ? parseKalshiUrl(stored) : {};
    const ticker = opts?.ticker || parsed.market || null;
    let eventTicker = opts?.eventTicker || parsed.event || null;

    // Derive event ticker from market ticker when missing (drop final outcome segment).
    if (!eventTicker && ticker && isKalshiMarketOrEventTicker(ticker)) {
      const parts = ticker.split('-');
      if (parts.length >= 3) eventTicker = parts.slice(0, -1).join('-');
      else if (parts.length === 2) eventTicker = ticker;
    }

    const series =
      (parsed.series && !isKalshiMarketOrEventTicker(parsed.series) ? parsed.series : null) ||
      kalshiSeriesTicker(ticker, eventTicker);

    return kalshiExternalUrl({
      ticker,
      eventTicker,
      seriesTicker: series,
      title,
    });
  }

  if (stored?.startsWith('http')) return stored;
  return platformExternalUrl(platform, {
    title,
    ticker: opts?.ticker,
    eventTicker: opts?.eventTicker,
  });
}
