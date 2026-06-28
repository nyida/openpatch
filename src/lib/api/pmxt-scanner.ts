const PMXT_ARB_URL = 'https://api.pmxt.dev/v1/arbitrage';

export type PmxtMarketSide = {
  title: string;
  platform: string;
  yes_price: number;
  no_price: number;
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
};

type PmxtApiResponse = {
  opportunities?: PmxtArbitrageOpportunity[];
};

function getApiKey(): string {
  const key = process.env.PMXT_API_KEY?.trim();
  if (!key) {
    throw new Error('PMXT_API_KEY is not set. Add it to .env.local');
  }
  return key;
}

/** Fetch cross-venue arbitrage opportunities from PMXT. */
export async function fetchPmxtArbitrage(): Promise<PmxtArbitrageResult> {
  const apiKey = getApiKey();

  const res = await fetch(PMXT_ARB_URL, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/json',
    },
    cache: 'no-store',
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    let message = `PMXT API error (${res.status})`;
    try {
      const parsed = JSON.parse(body) as { error?: string };
      if (parsed.error) message = parsed.error;
    } catch {
      if (body) message = body.slice(0, 200);
    }
    throw new Error(message);
  }

  const data = (await res.json()) as PmxtApiResponse;
  const opportunities = Array.isArray(data.opportunities) ? data.opportunities : [];

  return {
    opportunities: opportunities.sort((a, b) => b.net_profit - a.net_profit),
    cached_at: Date.now(),
  };
}
