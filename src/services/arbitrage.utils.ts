import type { ArbitrageSpread } from './types';

export function normalizeTitle(t: string): string {
  return t
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function titleTokens(t: string): string[] {
  return normalizeTitle(t)
    .split(' ')
    .filter((w) => w.length > 2);
}

export function titleSimilarity(a: string, b: string): number {
  const ta = new Set(titleTokens(a));
  const tb = new Set(titleTokens(b));
  if (!ta.size || !tb.size) return 0;
  let inter = 0;
  for (const w of ta) if (tb.has(w)) inter++;
  return inter / Math.max(ta.size, tb.size);
}

type Titled = { title: string; event_title?: string | null };

/** Inverted token index for O(candidates) matching instead of O(n×m). */
export function buildTitleIndex<T extends Titled>(markets: T[]): Map<string, T[]> {
  const index = new Map<string, T[]>();
  const add = (token: string, m: T) => {
    const bucket = index.get(token);
    if (bucket) {
      if (!bucket.includes(m)) bucket.push(m);
    } else {
      index.set(token, [m]);
    }
  };
  for (const m of markets) {
    for (const token of titleTokens(m.title)) add(token, m);
    if (m.event_title) {
      for (const token of titleTokens(m.event_title)) add(token, m);
    }
  }
  return index;
}

export function findBestMatch<T extends Titled>(
  query: Titled,
  index: Map<string, T[]>,
  minSim = 0.35,
): { item: T; sim: number } | null {
  const candidates = new Map<T, number>();

  const scoreCandidates = (text: string) => {
    for (const token of titleTokens(text)) {
      for (const item of index.get(token) ?? []) {
        candidates.set(item, (candidates.get(item) ?? 0) + 1);
      }
    }
  };

  scoreCandidates(query.title);
  if (query.event_title) scoreCandidates(query.event_title);

  let best: T | null = null;
  let bestSim = 0;

  for (const [item] of candidates) {
    const sim = Math.max(
      titleSimilarity(query.title, item.title),
      query.event_title ? titleSimilarity(query.event_title, item.title) : 0,
    );
    if (sim > bestSim) {
      bestSim = sim;
      best = item;
    }
  }

  if (!best || bestSim < minSim) return null;
  return { item: best, sim: bestSim };
}

export function lookupSpread(
  byPolyTitle: Record<string, ArbitrageSpread>,
  marketTitle: string,
): ArbitrageSpread | null {
  if (byPolyTitle[marketTitle]) return byPolyTitle[marketTitle];
  const norm = normalizeTitle(marketTitle);
  for (const [title, spread] of Object.entries(byPolyTitle)) {
    if (normalizeTitle(title) === norm) return spread;
    if (titleSimilarity(title, marketTitle) > 0.6) return spread;
  }
  return null;
}
