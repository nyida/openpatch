'use client';

import { useEffect, useRef } from 'react';
import { fetchJson } from '@/lib/whale/fetch';
import { startPriceStreams, stopPriceStreams, type PriceSubscription } from '@/services/websocket';
import { usePriceStore } from '@/stores/priceStore';

type SubsResponse = { subs: PriceSubscription[] };

/** Connects Kalshi + Polymarket WebSockets for top arb contracts. */
export function PriceStreamProvider() {
  const setPrice = usePriceStore((s) => s.setPrice);
  const setWsStatus = usePriceStore((s) => s.setWsStatus);
  const started = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function connect() {
      try {
        const data = await fetchJson<SubsResponse>('/api/price_stream/subs?limit=50', undefined, { timeoutMs: 45_000 });
        if (cancelled || !data.subs?.length) return;
        startPriceStreams(data.subs, setPrice, setWsStatus);
        started.current = true;
      } catch {
        setWsStatus('kalshi', false);
        setWsStatus('polymarket', false);
      }
    }

    connect();
    const refresh = setInterval(connect, 120_000);

    return () => {
      cancelled = true;
      clearInterval(refresh);
      stopPriceStreams();
    };
  }, [setPrice, setWsStatus]);

  return null;
}

export function useWebSocket() {
  const wsConnected = usePriceStore((s) => s.wsConnected);
  const lastWsAt = usePriceStore((s) => s.lastWsAt);
  const live = wsConnected.kalshi || wsConnected.polymarket;
  return { wsConnected, lastWsAt, live };
}

export function useLiveSpread(contractId: string | undefined, polyPrice: number, kalshiPrice: number) {
  const live = usePriceStore((s) => (contractId ? s.prices[contractId] : undefined));
  return {
    polyPrice: live?.poly ?? polyPrice,
    kalshiPrice: live?.kalshi ?? kalshiPrice,
    isLive: Boolean(live?.updatedAt && Date.now() - live.updatedAt < 30_000),
    updatedAt: live?.updatedAt,
  };
}
