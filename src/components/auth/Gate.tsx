'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth/AuthProvider';
import { useAuthModal } from '@/lib/auth/AuthModalContext';
import { isProAppPath } from '@/lib/auth/plans';
import { PRO_PRICE_LABEL } from '@/lib/auth/types';

/** Public routes - no login required. */
export function isPublicPath(pathname: string) {
  if (pathname === '/') return true;
  if (pathname === '/paywall' || pathname === '/account') return true;
  if (pathname === '/verify') return true;
  if (pathname === '/research' || pathname.startsWith('/research/')) return true;
  if (pathname === '/pricing') return true;
  return false;
}

/** Marketing surfaces use their own chrome (not the app nav). */
export function isMarketingPath(pathname: string) {
  if (pathname === '/') return true;
  if (pathname === '/verify') return true;
  if (pathname === '/research' || pathname.startsWith('/research/')) return true;
  if (pathname === '/pricing') return true;
  return false;
}

function AuthRequired({ next }: { next: string }) {
  const { openAuth } = useAuthModal();

  useEffect(() => {
    openAuth({ mode: 'login', next });
  }, [openAuth, next]);

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-6 text-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo.png" alt="" className="h-10 w-10 rounded-lg object-cover" width={40} height={40} />
      <h1
        className="mt-5 text-2xl font-semibold tracking-tight"
        style={{ fontFamily: 'var(--font-sans)', color: 'var(--text)' }}
      >
        Sign in to continue
      </h1>
      <p className="mt-2 max-w-sm text-sm leading-relaxed" style={{ color: 'var(--text-2)' }}>
        Create a free account for the core desk, or upgrade to Pro for arbs, live flow, and exposure.
      </p>
      <div className="mt-6 flex gap-2">
        <button
          type="button"
          className="btn btn-primary text-sm px-5 h-10"
          onClick={() => openAuth({ mode: 'login', next })}
        >
          Sign in
        </button>
        <button
          type="button"
          className="btn btn-ghost text-sm px-5 h-10"
          onClick={() => openAuth({ mode: 'signup', next: '/dashboard' })}
        >
          Free account
        </button>
      </div>
    </div>
  );
}

function ProRequired({ feature }: { feature: string }) {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-6 text-center">
      <span
        className="rounded-md border px-2.5 py-1 font-sans text-[13px] font-semibold tracking-tight"
        style={{ borderColor: 'var(--line)', color: 'var(--mint)', background: 'var(--mint-dim)' }}
      >
        Pro
      </span>
      <h1
        className="mt-5 text-2xl font-semibold tracking-tight"
        style={{ fontFamily: 'var(--font-sans)', color: 'var(--text)' }}
      >
        {feature} is a Pro feature
      </h1>
      <p className="mt-2 max-w-sm text-sm leading-relaxed" style={{ color: 'var(--text-2)' }}>
        Your free account keeps the core desk. Upgrade for arbitrage, live whale flow, and market
        exposure - {PRO_PRICE_LABEL}.
      </p>
      <div className="mt-6 flex gap-2">
        <Link href="/paywall" className="btn btn-primary text-sm px-5 h-10 inline-flex items-center">
          Upgrade to Pro
        </Link>
        <Link href="/dashboard" className="btn btn-ghost text-sm px-5 h-10 inline-flex items-center">
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}

function proFeatureLabel(pathname: string) {
  if (pathname.startsWith('/arbs')) return 'Arbitrage';
  if (pathname.startsWith('/live')) return 'Live flow';
  if (pathname.startsWith('/markets')) return 'Exposure';
  if (pathname.startsWith('/workspace')) return 'Workspaces';
  return 'This tool';
}

export function Gate({ children }: { children: React.ReactNode }) {
  const { ready, isSignedIn, isPro, emailVerified } = useAuth();
  const { openAuth, open } = useAuthModal();
  const pathname = usePathname();
  const pub = isPublicPath(pathname);
  const needsPro = isProAppPath(pathname);

  useEffect(() => {
    if (!ready || pub || !isSignedIn || emailVerified) return;
    if (!open) {
      openAuth({ mode: 'signup', panel: 'checkEmail', next: pathname || '/dashboard' });
    }
  }, [ready, pub, isSignedIn, emailVerified, open, openAuth, pathname]);

  if (!ready) {
    if (pub) return <>{children}</>;
    return (
      <div
        className="flex min-h-[50vh] items-center justify-center text-sm"
        style={{ color: 'var(--text-3)' }}
      >
        Loading…
      </div>
    );
  }

  if (pub) {
    return <>{children}</>;
  }

  if (!isSignedIn) {
    return <AuthRequired next={pathname || '/dashboard'} />;
  }

  if (!emailVerified) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center px-6 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo.png"
          alt=""
          className="h-10 w-10 rounded-lg object-cover"
          width={40}
          height={40}
        />
        <p className="mt-5 text-sm" style={{ color: 'var(--text-2)' }}>
          Confirm your email to continue
        </p>
      </div>
    );
  }

  if (needsPro && !isPro) {
    return <ProRequired feature={proFeatureLabel(pathname)} />;
  }

  return <>{children}</>;
}
