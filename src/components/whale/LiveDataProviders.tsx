'use client';

import { usePathname } from 'next/navigation';
import { SpreadHistoryRecorder } from '@/components/whale/SpreadHistoryRecorder';
import { PriceStreamProvider } from '@/hooks/useWebSocket';

/** Live WS only where spread charts matter - not the whale dashboard. */
function needsLiveData(pathname: string): boolean {
  return (
    pathname.startsWith('/arbs') ||
    pathname.startsWith('/screener') ||
    pathname.startsWith('/market')
  );
}

export function LiveDataProviders() {
  const pathname = usePathname() ?? '';
  if (!needsLiveData(pathname)) return null;
  return (
    <>
      <SpreadHistoryRecorder />
      <PriceStreamProvider />
    </>
  );
}
