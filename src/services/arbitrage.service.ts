import { fetchTopKalshi } from './kalshi.service';
import { fetchTopPolymarket } from './polymarket.service';
import { buildTitleIndex, findBestMatch, normalizeTitle } from './arbitrage.utils';
import { getLastSeen, recordSpreadSnapshots } from './cacheService';
import { calculateNetROI } from '@/utils/arbMath';
import { resolveExternalUrl } from '@/lib/whale/marketUrls';
import type { ArbitrageSpread } from './types';

const ARB_CACHE_MS = 30_000;
const KALSHI_MATCH_CAP = 800;
const KALSHI_PAGES = 3;
const POLY_TOP = 300;

let cache: { at: number; pairs: ArbitrageSpread[]; byPolyTitle: Map<string, ArbitrageSpread> } | null =
  null;
let pending: Promise<ArbitrageSpread[]> | null = null;

function buildSpread(
  polyTitle: string,
  kalshiTitle: string,
  polyPrice: number,
  kalshiPrice: number,
  polyUrl: string,
  kalshiUrl: string,
  kalshiTicker: string | null = null,
): ArbitrageSpread {
  const spread = polyPrice - kalshiPrice;
  const roi = calculateNetROI(kalshiPrice, polyPrice);
  const id = `${normalizeTitle(polyTitle)}::${normalizeTitle(kalshiTitle)}`;
  const seen = getLastSeen(id);
  const now = Date.now();

  return {
    id,
    title: polyTitle,
    poly_title: polyTitle,
    kalshi_title: kalshiTitle,
    poly_price: polyPrice,
    kalshi_price: kalshiPrice,
    spread,
    spread_cents: spread * 100,
    net_profit_cents: roi.netCents,
    net_profit_pct: roi.roiPercent,
    roi,
    direction: roi.direction,
    poly_url: polyUrl,
    kalshi_url: kalshiUrl,
    kalshi_ticker: kalshiTicker,
    first_seen_at: seen?.first_seen_at ?? now,
    last_seen_at: seen?.last_seen_at ?? now,
  };
}

async function computeArbitragePairs(minSpread: number): Promise<{
  pairs: ArbitrageSpread[];
  byPolyTitleMap: Map<string, ArbitrageSpread>;
  at: number;
}> {
  const [polyMarkets, kalshiMarkets] = await Promise.all([
    fetchTopPolymarket(POLY_TOP),
    fetchTopKalshi(KALSHI_PAGES),
  ]);

  const kalshiCandidates = kalshiMarkets.slice(0, KALSHI_MATCH_CAP);
  const kalshiIndex = buildTitleIndex(kalshiCandidates);

  const pairs: ArbitrageSpread[] = [];
  const byPolyTitleMap = new Map<string, ArbitrageSpread>();

  for (const poly of polyMarkets) {
    const match = findBestMatch(
      { title: poly.title, event_title: poly.event_title },
      kalshiIndex,
    );
    if (!match) continue;
    const bestKalshi = match.item;
    if (poly.probability <= 0 && bestKalshi.probability <= 0) continue;

    const kalshiTicker = bestKalshi.id.startsWith('kalshi-')
      ? bestKalshi.id.slice('kalshi-'.length)
      : null;
    const spread = buildSpread(
      poly.title,
      bestKalshi.title,
      poly.probability,
      bestKalshi.probability,
      poly.external_url,
      resolveExternalUrl('kalshi', bestKalshi.title, bestKalshi.external_url, {
        ticker: kalshiTicker,
      }),
      kalshiTicker,
    );
    if (Math.abs(spread.spread) >= minSpread) {
      pairs.push(spread);
      byPolyTitleMap.set(poly.title, spread);
    }
  }

  pairs.sort((a, b) => b.net_profit_cents - a.net_profit_cents);
  recordSpreadSnapshots(pairs);

  return { pairs, byPolyTitleMap, at: Date.now() };
}

export async function getArbitragePairs(minSpread = 0, sortByNet = false): Promise<{
  pairs: ArbitrageSpread[];
  byPolyTitle: Record<string, ArbitrageSpread>;
  cached_at: number;
}> {
  if (cache && Date.now() - cache.at < ARB_CACHE_MS) {
    return formatResult(cache.pairs, minSpread, sortByNet);
  }

  if (!pending) {
    pending = computeArbitragePairs(0)
      .then(({ pairs, byPolyTitleMap, at }) => {
        cache = { at, pairs, byPolyTitle: byPolyTitleMap };
        return pairs;
      })
      .finally(() => {
        pending = null;
      });
  }

  await pending;
  return formatResult(cache!.pairs, minSpread, sortByNet);
}

function formatResult(allPairs: ArbitrageSpread[], minSpread: number, sortByNet: boolean) {
  let pairs =
    minSpread > 0 ? allPairs.filter((p) => Math.abs(p.spread) >= minSpread) : allPairs;
  if (sortByNet) {
    pairs = [...pairs].sort((a, b) => b.net_profit_cents - a.net_profit_cents);
  }
  const byPolyTitle: Record<string, ArbitrageSpread> = {};
  for (const p of pairs) byPolyTitle[p.poly_title] = p;
  return { pairs, byPolyTitle, cached_at: cache!.at };
}
