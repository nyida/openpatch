'use client';

import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { motion, useReducedMotion } from 'framer-motion';
import { useAuthOptional } from '@/lib/auth/AuthProvider';
import { useAuthModalOptional } from '@/lib/auth/AuthModalContext';
import { EASE_OUT } from '@/lib/motion';

const NAV = [
  { href: '/', label: 'Home' },
  { href: '/research', label: 'Research' },
  { href: '/pricing', label: 'Pricing' },
] as const;

function navActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function MarketingShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      <SiteHeader />
      <main>{children}</main>
      <SiteFooter />
    </div>
  );
}

export function Section({
  id,
  children,
  className = '',
  wide = false,
}: {
  id?: string;
  children: ReactNode;
  className?: string;
  wide?: boolean;
}) {
  return (
    <section
      id={id}
      className={`mx-auto px-5 sm:px-6 ${wide ? 'max-w-[1100px]' : 'max-w-[880px]'} ${className}`}
    >
      {children}
    </section>
  );
}

function SiteHeader() {
  const pathname = usePathname();
  const auth = useAuthOptional();
  const authModal = useAuthModalOptional();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const reduce = useReducedMotion();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => setOpen(false), [pathname]);

  const appHref = auth?.isSignedIn ? '/dashboard' : '/paywall';

  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-50">
      <div className="flex justify-center px-3 pt-3 sm:px-4 sm:pt-4">
        <motion.div
          className="pointer-events-auto relative w-full max-w-[560px] sm:max-w-[620px]"
          initial={reduce ? false : { y: -18, opacity: 0 }}
          animate={{ y: 0, opacity: 1, scale: scrolled ? 0.96 : 1 }}
          transition={{
            y: { duration: 0.55, ease: EASE_OUT },
            opacity: { duration: 0.55, ease: EASE_OUT },
            scale: { type: 'spring', stiffness: 380, damping: 32 },
          }}
        >
          <div
            className={`flex items-center justify-between rounded-lg border backdrop-blur-md transition-all duration-300 ${
              scrolled ? 'h-10 px-2 sm:px-2.5' : 'h-12 px-2.5 sm:px-3'
            }`}
            style={{
              borderColor: 'rgba(255,255,255,0.12)',
              background: 'rgba(10,9,8,0.72)',
              boxShadow: '0 10px 32px rgba(0,0,0,0.35)',
            }}
          >
            <Link href="/" className="relative z-10 flex shrink-0 items-center gap-2 pl-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logo.png"
                alt=""
                className={`rounded object-cover transition-all ${scrolled ? 'h-4 w-4' : 'h-[18px] w-[18px]'}`}
                width={18}
                height={18}
              />
              <span
                className={`font-semibold tracking-tight text-white transition-all ${
                  scrolled ? 'text-[12px]' : 'text-[13px] sm:text-[14px]'
                }`}
                style={{ fontFamily: 'var(--font-sans)' }}
              >
                Algomarket
              </span>
            </Link>

            <nav className="absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 items-center gap-5 md:flex">
              {NAV.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className={`text-[12px] transition sm:text-[13px] ${
                    navActive(pathname, l.href)
                      ? 'font-medium text-white'
                      : 'text-white/55 hover:text-white'
                  }`}
                >
                  {l.label}
                </Link>
              ))}
            </nav>

            <div className="relative z-10 flex items-center gap-1.5">
              {auth?.ready && !auth.isSignedIn ? (
                <button
                  type="button"
                  onClick={() => authModal?.openAuth({ mode: 'login', next: '/dashboard' })}
                  className="hidden px-1.5 text-[12px] text-white/55 transition hover:text-white sm:inline"
                >
                  Sign in
                </button>
              ) : null}
              {auth?.ready && auth.isSignedIn ? (
                <Link
                  href="/account"
                  className="hidden px-1.5 text-[12px] text-white/55 transition hover:text-white sm:inline"
                >
                  Account
                </Link>
              ) : null}

              <Link
                href={appHref}
                onClick={(e) => {
                  if (!auth?.isSignedIn) {
                    e.preventDefault();
                    authModal?.openAuth({ mode: 'signup', next: '/dashboard' });
                  }
                }}
                className={`hidden items-center rounded-md bg-white/95 font-medium text-black transition hover:bg-white sm:inline-flex ${
                  scrolled ? 'h-7 px-2.5 text-[11px]' : 'h-8 px-3 text-[12px]'
                }`}
              >
                Open app
              </Link>

              <button
                type="button"
                aria-label="Menu"
                aria-expanded={open}
                className="flex h-7 w-7 items-center justify-center rounded-md border border-white/15 text-white md:hidden"
                onClick={() => setOpen((v) => !v)}
              >
                <span className="flex w-3 flex-col gap-[3px]">
                  <span className={`h-px w-full bg-white transition ${open ? 'translate-y-[4px] rotate-45' : ''}`} />
                  <span className={`h-px w-full bg-white transition ${open ? 'opacity-0' : ''}`} />
                  <span className={`h-px w-full bg-white transition ${open ? '-translate-y-[4px] -rotate-45' : ''}`} />
                </span>
              </button>
            </div>
          </div>

          {open ? (
            <motion.div
              className="mt-2 overflow-hidden rounded-lg border border-white/12 px-3.5 py-2.5 backdrop-blur-md md:hidden"
              style={{ background: 'rgba(10,9,8,0.88)' }}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
            >
              {NAV.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className="block py-2 text-[13px] text-white/75"
                  onClick={() => setOpen(false)}
                >
                  {l.label}
                </Link>
              ))}
              <Link
                href={appHref}
                className="mt-1.5 flex h-9 items-center justify-center rounded-md bg-white text-[12px] font-medium text-black"
                onClick={() => setOpen(false)}
              >
                Open app
              </Link>
            </motion.div>
          ) : null}
        </motion.div>
      </div>
    </header>
  );
}

function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer style={{ background: '#050504', color: 'var(--text)' }}>
      <div className="mx-auto max-w-[1100px] px-5 pb-10 pt-16 sm:px-6 md:pt-20">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2 lg:col-span-1">
            <Link href="/" className="inline-flex items-center gap-2.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt="" className="h-5 w-5 rounded object-cover" width={20} height={20} />
              <span className="text-[15px] font-semibold tracking-tight" style={{ fontFamily: 'var(--font-sans)' }}>
                Algomarket
              </span>
            </Link>
            <p className="mt-4 max-w-[240px] text-[14px] leading-relaxed" style={{ color: 'var(--text-3)' }}>
              Cross-venue whale analytics for Polymarket and Kalshi.
            </p>
          </div>

          <div>
            <p className="font-sans text-[14px] font-bold tracking-tight" style={{ color: 'var(--text-3)' }}>
              Explore
            </p>
            <ul className="mt-4 space-y-3 text-[14px]" style={{ color: 'var(--text-2)' }}>
              <li><Link href="/#platform" className="hover:text-white transition">Product</Link></li>
              <li><Link href="/pricing" className="hover:text-white transition">Pricing</Link></li>
              <li><Link href="/research" className="hover:text-white transition">Research</Link></li>
            </ul>
          </div>

          <div>
            <p className="font-sans text-[14px] font-bold tracking-tight" style={{ color: 'var(--text-3)' }}>
              Product
            </p>
            <ul className="mt-4 space-y-3 text-[14px]" style={{ color: 'var(--text-2)' }}>
              <li><Link href="/dashboard" className="hover:text-white transition">Dashboard</Link></li>
              <li><Link href="/arbs" className="hover:text-white transition">Arbitrage</Link></li>
              <li><Link href="/screener" className="hover:text-white transition">Screener</Link></li>
            </ul>
          </div>

          <div>
            <p className="font-sans text-[14px] font-bold tracking-tight" style={{ color: 'var(--text-3)' }}>
              Account
            </p>
            <ul className="mt-4 space-y-3 text-[14px]" style={{ color: 'var(--text-2)' }}>
              <li><Link href="/account" className="hover:text-white transition">Account</Link></li>
              <li><Link href="/paywall" className="hover:text-white transition">Subscribe</Link></li>
            </ul>
          </div>
        </div>

        <div className="mt-14 flex flex-col gap-3 border-t pt-6 sm:flex-row sm:items-center sm:justify-between"
          style={{ borderColor: 'var(--line)' }}
        >
          <p className="text-[13px]" style={{ color: 'var(--text-3)' }}>
            © Algomarket {year}
          </p>
          <p className="text-[13px]" style={{ color: 'var(--text-3)' }}>
            Polymarket &amp; Kalshi analytics
          </p>
        </div>
      </div>
    </footer>
  );
}
