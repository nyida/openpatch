const PMXT_ENDPOINTS = [
  'https://api.pmxt.dev/v0/arbitrage',
  'https://api.pmxt.dev/v1/arbitrage',
] as const;

const FETCH_TIMEOUT_MS = 10_000;
const MAX_OPPORTUNITIES = 30;

export type PmxtMarketSide = {
  title: string;
  platform: string;
  yes_price: number;
  no_price: number;
  url: string | null;
  ticker: string | null;
};

export type PmxtArbitrageOpportunity = {
  market_a: PmxtMarketSide;
  market_b: PmxtMarketSide;
  spread: number;
  net_profit: number;
  opportunity_type: string;
};

export type PmxtArbitrageResult = {
  opportunities: PmxtArbitrageOpportunity[];
  cached_at: number;
  total: number;
};

class PmxtRequestError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'PmxtRequestError';
    this.status = status;
  }
}

type RawOutcome = { price?: number | null; bestBid?: number | null; bestAsk?: number | null };
type RawMarket = {
  title?: string;
  sourceExchange?: string;
  platform?: string;
  lastPrice?: number | null;
  url?: string | null;
  slug?: string | null;
  ticker?: string | null;
  marketId?: string | null;
  id?: string | null;
  yes?: RawOutcome | null;
  no?: RawOutcome | null;
  outcomes?: RawOutcome[] | null;
};
type RawOpportunity = {
  market_a?: RawMarket;
  market_b?: RawMarket;
  marketA?: RawMarket;
  marketB?: RawMarket;
  spread?: number;
  net_profit?: number;
  buyPrice?: number;
  sellPrice?: number;
  opportunity_type?: string;
  relation?: string;
};

function getApiKey(): string {
  const key = process.env.PMXT_API_KEY?.trim();
  if (!key) throw new Error('PMXT_API_KEY is not set. Add it to .env.local');
  return key;
}

function outcomePrice(o?: RawOutcome | null): number {
  if (!o) return 0;
  const n = o.price ?? o.bestAsk ?? o.bestBid;
  return typeof n === 'number' && Number.isFinite(n) ? n : 0;
}

function normalizeSide(raw?: RawMarket | null): PmxtMarketSide {
  const yes =
    outcomePrice(raw?.yes) ||
    outcomePrice(raw?.outcomes?.[1]) ||
    (typeof raw?.lastPrice === 'number' ? raw.lastPrice : 0);
  const no =
    outcomePrice(raw?.no) ||
    outcomePrice(raw?.outcomes?.[0]) ||
    (yes > 0 ? Math.max(0, 1 - yes) : 0);

  const url = typeof raw?.url === 'string' && raw.url.startsWith('http') ? raw.url : null;
  const ticker =
    (typeof raw?.ticker === 'string' && raw.ticker) ||
    (typeof raw?.slug === 'string' && raw.slug) ||
    null;

  return {
    title: raw?.title?.trim() || 'Unknown market',
    platform: (raw?.sourceExchange || raw?.platform || 'unknown').toLowerCase(),
    yes_price: yes,
    no_price: no,
    url,
    ticker,
  };
}

function normalizeOpportunity(raw: RawOpportunity): PmxtArbitrageOpportunity | null {
  const market_a = normalizeSide(raw.market_a ?? raw.marketA);
  const market_b = normalizeSide(raw.market_b ?? raw.marketB);
  if (!market_a.title || !market_b.title) return null;

  const spread = typeof raw.spread === 'number' ? raw.spread : 0;
  const netFromPrices =
    typeof raw.sellPrice === 'number' && typeof raw.buyPrice === 'number'
      ? raw.sellPrice - raw.buyPrice
      : undefined;
  const net_profit = typeof raw.net_profit === 'number' ? raw.net_profit : (netFromPrices ?? spread);

  return {
    market_a,
    market_b,
    spread,
    net_profit,
    opportunity_type: raw.opportunity_type || raw.relation || 'cross-venue',
  };
}

function extractRawOpportunities(payload: unknown): RawOpportunity[] {
  if (!payload || typeof payload !== 'object') return [];
  const obj = payload as Record<string, unknown>;

  if (Array.isArray(obj.opportunities)) return obj.opportunities as RawOpportunity[];
  if (Array.isArray(obj.data)) return obj.data as RawOpportunity[];
  if (obj.data && typeof obj.data === 'object') {
    const data = obj.data as Record<string, unknown>;
    if (Array.isArray(data.opportunities)) return data.opportunities as RawOpportunity[];
  }
  return [];
}

async function fetchFromPmxt(url: string, apiKey: string): Promise<PmxtArbitrageOpportunity[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
      cache: 'no-store',
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      let detail = `HTTP ${res.status}`;
      try {
        const parsed = JSON.parse(body) as { error?: string };
        if (parsed.error) detail = parsed.error;
      } catch {
        if (body && !body.startsWith('<!')) detail = body.slice(0, 120);
      }
      throw new PmxtRequestError(res.status, detail);
    }

    const payload = await res.json();
    return extractRawOpportunities(payload)
      .map(normalizeOpportunity)
      .filter((o): o is PmxtArbitrageOpportunity => o != null);
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      throw new Error('PMXT request timed out');
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

/** Fetch cross-venue arbitrage opportunities from PMXT (v0 primary, v1 fallback). */
export async function fetchPmxtArbitrage(): Promise<PmxtArbitrageResult> {
  const apiKey = getApiKey();
  let lastError: Error | undefined;

  for (let i = 0; i < PMXT_ENDPOINTS.length; i++) {
    const url = PMXT_ENDPOINTS[i];
    const isLast = i === PMXT_ENDPOINTS.length - 1;

    try {
      const opportunities = await fetchFromPmxt(url, apiKey);
      const sorted = opportunities.sort((a, b) => b.net_profit - a.net_profit);

      return {
        opportunities: sorted.slice(0, MAX_OPPORTUNITIES),
        total: sorted.length,
        cached_at: Date.now(),
      };
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
      if (isLast) break;
      if (e instanceof PmxtRequestError && (e.status === 401 || e.status === 403)) break;
    }
  }

  throw lastError ?? new Error('PMXT arbitrage fetch failed');
}
