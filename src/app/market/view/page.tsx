'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { encodeMarketId } from '@/lib/whale/marketRoutes';
import { MarketDetailFallback, MarketDetailView } from '@/components/whale/MarketDetailView';

/** Legacy /market/view?title=… redirects to /market/[id]. */
function LegacyViewRedirect() {
  const sp = useSearchParams();
  const router = useRouter();
  const title = sp.get('title');

  useEffect(() => {
    if (!title) return;
    const platform = sp.get('platform') ?? sp.get('venue') ?? 'polymarket';
    const id = encodeMarketId(title, platform);
    const extra = new URLSearchParams();
    const price = sp.get('price');
    const volume = sp.get('volume');
    const event = sp.get('event');
    if (price) extra.set('price', price);
    if (volume) extra.set('volume', volume);
    if (event) extra.set('event', event);
    const qs = extra.toString();
    router.replace(`/market/${id}${qs ? `?${qs}` : ''}`);
  }, [title, sp, router]);

  if (!title) {
    return <MarketDetailView />;
  }

  return <MarketDetailFallback />;
}

export default function MarketViewPage() {
  return (
    <Suspense fallback={<MarketDetailFallback />}>
      <LegacyViewRedirect />
    </Suspense>
  );
}
