'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, Search, X } from 'lucide-react';
import { useScrapeStatus } from '@/lib/whale/useScrapeStatus';
import { useWebSocket } from '@/hooks/useWebSocket';
import { SearchBar } from '@/components/whale/SearchBar';
import { useAlertsStore } from '@/stores/alertsStore';
import { DUR, EASE_OUT, SPRING_SOFT } from '@/lib/motion';
import { useAuthOptional } from '@/lib/auth/AuthProvider';
import { useAuthModalOptional } from '@/lib/auth/AuthModalContext';

const HIGHLIGHT_SPRING = SPRING_SOFT;

const links = [
  { href: '/dashboard', label: 'Dashboard', title: 'Whale holdings vs market odds', pro: false },
  { href: '/arbs', label: 'Arbs', title: 'Cross-venue arbitrage scanner', pro: true },
  { href: '/screener', label: 'Screener', title: 'Filter markets by volume, prob, date', pro: false },
  { href: '/live', label: 'Live', title: 'Large fills and market alerts', pro: true },
  { href: '/traders', label: 'Traders', title: 'Whale leaderboard by P&L', pro: false },
  { href: '/markets', label: 'Exposure', title: 'Markets ranked by whale notional', pro: true },
  { href: '/alerts', label: 'Alerts', title: 'Price, whale, and arb alerts', pro: false },
  { href: '/tools/kelly', label: 'Kelly', title: 'Position sizing calculator', pro: false },
  { href: '/profile', label: 'Profile', title: 'Wallet positions and history', pro: false },
];

function isActive(pathname: string, href: string) {
  if (href === '/dashboard') return pathname === '/dashboard' || pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLinkItem({
  href,
  label,
  title,
  active,
  layoutId,
  onClick,
  pro,
  showProBadge,
}: {
  href: string;
  label: string;
  title?: string;
  active: boolean;
  layoutId: string;
  onClick?: () => void;
  pro?: boolean;
  showProBadge?: boolean;
}) {
  return (
    <Link href={href} className="nav-link" data-active={active} title={title} onClick={onClick}>
      {active && (
        <motion.span
          layoutId={layoutId}
          className="nav-slide-highlight"
          transition={HIGHLIGHT_SPRING}
          aria-hidden
        />
      )}
      <span className="nav-slide-label inline-flex items-center gap-1">
        {label}
        {pro && showProBadge ? (
          <span
            className="text-[8px] font-semibold uppercase tracking-wider"
            style={{ color: 'var(--mint)' }}
          >
            Pro
          </span>
        ) : null}
      </span>
    </Link>
  );
}

export function Nav() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const { status } = useScrapeStatus();
  const { live: wsLive } = useWebSocket();
  const unreadAlerts = useAlertsStore((s) => s.unreadCount());
  const feedFresh = status?.live_feed_fresh ?? false;
  const auth = useAuthOptional();
  const authModal = useAuthModalOptional();
  const showProBadge = Boolean(auth?.ready && auth.isSignedIn && !auth.isPro);


  const toggleSearch = useCallback(() => setSearchOpen((v) => !v), []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen((v) => !v);
      }
      if (e.key === 'Escape') setSearchOpen(false);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    setSearchOpen(false);
    setMobileOpen(false);
  }, [pathname]);

  const liveLabel = wsLive ? 'WS live' : feedFresh ? 'Live' : 'Syncing';
  const liveColor = wsLive ? 'var(--mint)' : feedFresh ? 'var(--text-2)' : 'var(--text-3)';

  return (
    <header className="nav-header sticky top-0 z-30">
      <div className="shell !py-0 !max-w-[1280px] relative">
        <div className="flex items-center justify-between h-11 gap-3">
          <Link href="/dashboard" className="flex items-center gap-2 shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo.png"
              alt="Algomarket"
              className="h-6 w-6 rounded object-cover shrink-0"
              width={24}
              height={24}
            />
            <span className="text-sm font-semibold tracking-tight" style={{ color: 'var(--text)' }}>
              Algomarket
            </span>
          </Link>

          <nav className="hidden lg:flex items-center gap-0.5">
            {links.map(({ href, label, title, pro }) => (
              <NavLinkItem
                key={href}
                href={href}
                label={label}
                title={title}
                active={isActive(pathname, href)}
                layoutId="main-nav-highlight"
                pro={pro}
                showProBadge={showProBadge}
              />
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <button
              type="button"
              className="search-trigger"
              onClick={toggleSearch}
              aria-label="Search markets"
              aria-expanded={searchOpen}
            >
              <Search className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Search</span>
              <kbd>⌘K</kbd>
            </button>

            <Link href="/alerts" className="search-trigger relative hidden sm:inline-flex" title="Alerts">
              Alerts
              {unreadAlerts > 0 && <span className="nav-alert-badge">{unreadAlerts}</span>}
            </Link>

            <span
              className="hidden md:inline text-[10px] uppercase tracking-wider font-medium"
              style={{ color: liveColor }}
              title={wsLive ? 'WebSocket price stream active' : feedFresh ? 'Live feed updating' : 'Live feed catching up'}
            >
              {liveLabel}
            </span>

            {auth?.ready ? (
              auth.isSignedIn ? (
                <Link
                  href="/account"
                  className="search-trigger hidden sm:inline-flex"
                  title="Account"
                >
                  {auth.isPro ? 'Pro' : 'Account'}
                </Link>
              ) : (
                <button
                  type="button"
                  className="search-trigger hidden sm:inline-flex"
                  onClick={() => authModal?.openAuth({ mode: 'login', next: pathname })}
                >
                  Sign in
                </button>
              )
            ) : null}

            {!auth?.isPro && auth?.ready ? (
              <Link href="/paywall" className="search-trigger hidden md:inline-flex" title="Upgrade to Pro">
                Upgrade
              </Link>
            ) : null}

            <button
              type="button"
              className="btn btn-ghost !p-1.5 lg:hidden"
              onClick={() => setMobileOpen((v) => !v)}
              aria-label="Menu"
            >
              {mobileOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <AnimatePresence>
          {searchOpen && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: DUR.base, ease: EASE_OUT }}
              className="unified-search-wrap unified-search-wrap--overlay !px-0 !py-2"
            >
              <SearchBar autoFocus onClose={() => setSearchOpen(false)} />
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence initial={false}>
          {mobileOpen && (
            <motion.nav
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: DUR.base, ease: EASE_OUT }}
              className="lg:hidden flex flex-wrap gap-1 pb-2 pt-2 border-t"
              style={{ borderColor: 'var(--line)' }}
            >
              {links.map(({ href, label, title, pro }) => (
                <NavLinkItem
                  key={href}
                  href={href}
                  label={label}
                  title={title}
                  active={isActive(pathname, href)}
                  layoutId="main-nav-mobile-highlight"
                  onClick={() => setMobileOpen(false)}
                  pro={pro}
                  showProBadge={showProBadge}
                />
              ))}
              {auth?.ready && !auth.isSignedIn ? (
                <button
                  type="button"
                  className="nav-link"
                  onClick={() => {
                    setMobileOpen(false);
                    authModal?.openAuth({ mode: 'login', next: pathname });
                  }}
                >
                  <span className="nav-slide-label">Sign in</span>
                </button>
              ) : null}
              {auth?.isSignedIn ? (
                <NavLinkItem
                  href="/account"
                  label={auth.isPro ? 'Pro' : 'Account'}
                  title="Account"
                  active={isActive(pathname, '/account')}
                  layoutId="main-nav-mobile-highlight"
                  onClick={() => setMobileOpen(false)}
                />
              ) : null}
              {!auth?.isPro ? (
                <NavLinkItem
                  href="/paywall"
                  label="Upgrade"
                  title="Upgrade to Pro"
                  active={isActive(pathname, '/paywall')}
                  layoutId="main-nav-mobile-highlight"
                  onClick={() => setMobileOpen(false)}
                />
              ) : null}
            </motion.nav>
          )}
        </AnimatePresence>
      </div>
    </header>
  );
}
