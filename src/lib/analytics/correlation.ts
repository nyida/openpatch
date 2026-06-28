import { inferMarketCategory } from '@/lib/whale/categories';
import { titlesMatch } from '@/lib/whale/marketRoutes';

export type CorrelationLink = {
  title: string;
  platform: string;
  probability: number;
  relation: 'same_event' | 'same_category' | 'inverse' | 'correlated';
  strength: number;
};

type MarketRef = {
  title: string;
  platform: string;
  probability: number;
  event_title?: string | null;
};

/** Heuristic related-market links for correlation trading MVP. */
export function findRelatedMarkets(
  target: MarketRef,
  catalog: MarketRef[],
  limit = 6,
): CorrelationLink[] {
  const results: CorrelationLink[] = [];
  const targetCat = inferMarketCategory(target.title);
  const targetEvent = (target.event_title ?? '').toLowerCase();

  for (const m of catalog) {
    if (m.title === target.title && m.platform === target.platform) continue;

    let relation: CorrelationLink['relation'] | null = null;
    let strength = 0;

    if (targetEvent && m.event_title && targetEvent === m.event_title.toLowerCase()) {
      relation = 'same_event';
      strength = 0.95;
    } else if (titlesMatch(target.title, m.title)) {
      relation = 'same_event';
      strength = 0.9;
    } else if (inferMarketCategory(m.title) === targetCat && targetCat !== 'Other') {
      relation = 'same_category';
      strength = 0.45 + Math.min(0.3, Math.abs(target.probability - m.probability));
    } else if (
      (target.title.toLowerCase().includes('yes') && m.title.toLowerCase().includes('no')) ||
      (target.title.toLowerCase().includes('trump') && m.title.toLowerCase().includes('harris'))
    ) {
      relation = 'inverse';
      strength = 0.55;
    }

    if (!relation) continue;
    results.push({
      title: m.title,
      platform: m.platform,
      probability: m.probability,
      relation,
      strength,
    });
  }

  return results.sort((a, b) => b.strength - a.strength).slice(0, limit);
}
