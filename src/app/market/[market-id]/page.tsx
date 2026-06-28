'use client';

import { Suspense } from 'react';
import { MarketDetailFallback, MarketDetailView } from '@/components/whale/MarketDetailView';

export default function MarketIdPage() {
  return (
    <Suspense fallback={<MarketDetailFallback />}>
      <MarketDetailView />
    </Suspense>
  );
}
