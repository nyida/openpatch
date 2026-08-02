'use client';

import { usePathname } from 'next/navigation';
import { Nav } from '@/components/Nav';
import { DataFeedBar } from '@/components/whale/DataFeedBar';
import { LiveDataProviders } from '@/components/whale/LiveDataProviders';
import { AppFooter } from '@/components/AppFooter';
import { AuthModal } from '@/components/auth/AuthModal';
import { Gate, isMarketingPath } from '@/components/auth/Gate';

/**
 * Marketing (/ , /research, /pricing): own shell - no app nav/feeds/footer.
 * Billing (/paywall, /account): slim nav.
 * Pro app: full chrome.
 */
export function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const marketing = isMarketingPath(pathname);
  const isBilling = pathname === '/paywall' || pathname === '/account';
  const showNav = !marketing;
  const showFeeds = showNav && !isBilling;
  const showAppFooter = showNav;

  return (
    <>
      {showNav ? <Nav /> : null}
      {showFeeds ? (
        <>
          <DataFeedBar />
          <LiveDataProviders />
        </>
      ) : null}
      <main className="flex-1 w-full relative z-[1]">
        <Gate>{children}</Gate>
      </main>
      {showAppFooter ? <AppFooter /> : null}
      <AuthModal />
    </>
  );
}
