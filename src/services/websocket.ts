export type PriceSubscription = {
  contractId: string;
  polyTitle: string;
  kalshiTitle: string;
  kalshiTicker: string | null;
  polyTokenId: string | null;
  polySlug: string | null;
};

export const KALSHI_WS_URL = 'wss://api.elections.kalshi.com/trade-api/ws/v2';
export const POLY_WS_URL = 'wss://ws-subscriptions-clob.polymarket.com/ws/market';

export function kalshiTickerFromUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const fromQuery = u.searchParams.get('market') || u.searchParams.get('ticker');
    if (fromQuery?.trim()) return fromQuery.trim().toUpperCase();

    const parts = u.pathname.split('/').filter(Boolean);
    // Legacy broken links: /markets/{FULL_MARKET_TICKER}
    if (parts[0]?.toLowerCase() === 'markets' && parts.length === 2) {
      const seg = parts[1];
      if (/^[A-Z0-9]+-\d/i.test(seg)) return seg.toUpperCase();
    }
    // Canonical: /markets/{series}/{slug}/{event} - event ticker is usable for many books
    if (parts[0]?.toLowerCase() === 'markets' && parts.length >= 3) {
      const last = parts[parts.length - 1];
      if (/^[A-Z0-9]+-\d/i.test(last)) return last.toUpperCase();
    }
  } catch {
    const m = url.match(/[?&]market=([^&#]+)/i);
    if (m?.[1]) return decodeURIComponent(m[1]).toUpperCase();
  }
  return null;
}

export function polySlugFromUrl(url: string): string | null {
  const m = url.match(/polymarket\.com\/event\/([^/?#]+)/i);
  return m?.[1] ?? null;
}

type KalshiTickerMsg = {
  type?: string;
  msg?: {
    market_ticker?: string;
    yes_bid?: number;
    yes_ask?: number;
    price?: number;
  };
};

type PolyMarketMsg = {
  event_type?: string;
  asset_id?: string;
  price?: string | number;
  price_changes?: { asset_id?: string; price?: string | number }[];
};

export class KalshiPriceSocket {
  private ws: WebSocket | null = null;
  private tickers = new Map<string, string>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private onPrice: (ticker: string, price: number) => void;
  private onStatus: (connected: boolean) => void;

  constructor(
    onPrice: (ticker: string, price: number) => void,
    onStatus: (connected: boolean) => void,
  ) {
    this.onPrice = onPrice;
    this.onStatus = onStatus;
  }

  subscribe(subs: PriceSubscription[]) {
    this.tickers.clear();
    for (const s of subs) {
      if (s.kalshiTicker) this.tickers.set(s.kalshiTicker, s.contractId);
    }
    this.connect();
  }

  private connect() {
    if (typeof window === 'undefined') return;
    this.ws?.close();
    if (this.tickers.size === 0) {
      this.onStatus(false);
      return;
    }

    try {
      this.ws = new WebSocket(KALSHI_WS_URL);
    } catch {
      this.scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      this.onStatus(true);
      let id = 1;
      for (const ticker of this.tickers.keys()) {
        this.ws?.send(
          JSON.stringify({
            id: id++,
            cmd: 'subscribe',
            params: { channels: ['ticker'], market_ticker: ticker },
          }),
        );
      }
    };

    this.ws.onmessage = (ev) => {
      try {
        const data = JSON.parse(String(ev.data)) as KalshiTickerMsg;
        if (data.type !== 'ticker' || !data.msg?.market_ticker) return;
        const ticker = data.msg.market_ticker;
        const bid = data.msg.yes_bid ?? 0;
        const ask = data.msg.yes_ask ?? 0;
        const mid =
          bid > 0 && ask > 0
            ? (bid + ask) / 200
            : data.msg.price != null
              ? data.msg.price / 100
              : bid > 0
                ? bid / 100
                : ask / 100;
        if (mid > 0) this.onPrice(ticker, mid);
      } catch {
        /* ignore parse errors */
      }
    };

    this.ws.onclose = () => {
      this.onStatus(false);
      this.scheduleReconnect();
    };

    this.ws.onerror = () => {
      this.onStatus(false);
    };
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => this.connect(), 5000);
  }

  disconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close();
    this.ws = null;
    this.onStatus(false);
  }
}

export class PolymarketPriceSocket {
  private ws: WebSocket | null = null;
  private tokens = new Map<string, string>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private onPrice: (tokenId: string, price: number) => void;
  private onStatus: (connected: boolean) => void;

  constructor(
    onPrice: (tokenId: string, price: number) => void,
    onStatus: (connected: boolean) => void,
  ) {
    this.onPrice = onPrice;
    this.onStatus = onStatus;
  }

  subscribe(subs: PriceSubscription[]) {
    this.tokens.clear();
    for (const s of subs) {
      if (s.polyTokenId) this.tokens.set(s.polyTokenId, s.contractId);
    }
    this.connect();
  }

  private connect() {
    if (typeof window === 'undefined') return;
    this.ws?.close();
    if (this.tokens.size === 0) {
      this.onStatus(false);
      return;
    }

    try {
      this.ws = new WebSocket(POLY_WS_URL);
    } catch {
      this.scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      this.onStatus(true);
      this.ws?.send(
        JSON.stringify({
          type: 'market',
          assets_ids: Array.from(this.tokens.keys()),
        }),
      );
    };

    this.ws.onmessage = (ev) => {
      try {
        const data = JSON.parse(String(ev.data)) as PolyMarketMsg;
        if (data.event_type === 'price_change' && data.asset_id) {
          const p = parseFloat(String(data.price ?? 0));
          if (p > 0) this.onPrice(data.asset_id, p);
        }
        if (data.price_changes) {
          for (const ch of data.price_changes) {
            if (!ch.asset_id) continue;
            const p = parseFloat(String(ch.price ?? 0));
            if (p > 0) this.onPrice(ch.asset_id, p);
          }
        }
      } catch {
        /* ignore */
      }
    };

    this.ws.onclose = () => {
      this.onStatus(false);
      this.scheduleReconnect();
    };

    this.ws.onerror = () => this.onStatus(false);
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => this.connect(), 5000);
  }

  disconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close();
    this.ws = null;
    this.onStatus(false);
  }
}

let kalshiSocket: KalshiPriceSocket | null = null;
let polySocket: PolymarketPriceSocket | null = null;

export function startPriceStreams(
  subs: PriceSubscription[],
  setPrice: (contractId: string, venue: 'poly' | 'kalshi', price: number) => void,
  setWsStatus: (venue: 'kalshi' | 'polymarket', connected: boolean) => void,
) {
  stopPriceStreams();

  const tickerToContract = new Map<string, string>();
  const tokenToContract = new Map<string, string>();
  for (const s of subs) {
    if (s.kalshiTicker) tickerToContract.set(s.kalshiTicker, s.contractId);
    if (s.polyTokenId) tokenToContract.set(s.polyTokenId, s.contractId);
  }

  kalshiSocket = new KalshiPriceSocket(
    (ticker, price) => {
      const cid = tickerToContract.get(ticker);
      if (cid) setPrice(cid, 'kalshi', price);
    },
    (c) => setWsStatus('kalshi', c),
  );

  polySocket = new PolymarketPriceSocket(
    (tokenId, price) => {
      const cid = tokenToContract.get(tokenId);
      if (cid) setPrice(cid, 'poly', price);
    },
    (c) => setWsStatus('polymarket', c),
  );

  kalshiSocket.subscribe(subs);
  polySocket.subscribe(subs);
}

export function stopPriceStreams() {
  kalshiSocket?.disconnect();
  polySocket?.disconnect();
  kalshiSocket = null;
  polySocket = null;
}
