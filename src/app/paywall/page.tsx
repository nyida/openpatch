'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { confirmCheckout, startWebCheckout } from '@/lib/auth/client';
import { useAuth } from '@/lib/auth/AuthProvider';
import { useAuthModal } from '@/lib/auth/AuthModalContext';
import { FREE_FEATURES, PRO_FEATURES } from '@/lib/auth/plans';
import { PRO_PRICE_LABEL } from '@/lib/auth/types';

function PaywallInner() {
  const { ready, user, isSignedIn, isPro, refreshSession, setTier } = useAuth();
  const { openAuth } = useAuthModal();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (ready && isPro && !searchParams.get('success')) {
      router.replace('/dashboard');
    }
  }, [ready, isPro, router, searchParams]);

  useEffect(() => {
    const success = searchParams.get('success');
    const canceled = searchParams.get('canceled');
    const sessionId = searchParams.get('session_id');

    if (canceled) {
      setMessage('Checkout canceled. You can try again anytime.');
      return;
    }

    if (success && sessionId && isSignedIn) {
      void (async () => {
        try {
          setBusy(true);
          const res = await confirmCheckout(sessionId);
          if (res.user) setTier(res.user.tier);
          await refreshSession();
          router.replace('/arbs');
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Could not confirm payment');
        } finally {
          setBusy(false);
        }
      })();
    } else if (success && !isSignedIn && ready) {
      openAuth({ mode: 'login', next: '/paywall?success=1' });
    }
  }, [
    searchParams,
    isSignedIn,
    ready,
    openAuth,
    refreshSession,
    setTier,
    router,
  ]);

  async function onUpgrade() {
    setError(null);
    setMessage(null);
    if (!isSignedIn) {
      openAuth({ mode: 'signup', next: '/paywall' });
      return;
    }
    setBusy(true);
    try {
      const result = await startWebCheckout();
      if (result.upgraded) {
        setTier('pro');
        await refreshSession();
        router.replace('/arbs');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Checkout failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="shell py-10 max-w-3xl mx-auto">
      <p className="font-sans text-[14px] font-bold tracking-tight" style={{ color: 'var(--text-3)' }}>
        Billing
      </p>
      <h1
        className="mt-2 font-sans text-3xl font-bold tracking-tight"
      >
        Free vs Pro
      </h1>
      <p className="mt-2 text-sm leading-relaxed max-w-xl" style={{ color: 'var(--text-2)' }}>
        Free covers the core whale desk. Pro unlocks arbitrage, live flow, and exposure  - 
        the sharpest tools on Algomarket.
      </p>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <div
          className="rounded-xl border p-6 flex flex-col"
          style={{ borderColor: 'var(--line)', background: 'var(--bg-card)' }}
        >
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-lg font-semibold">Free</span>
            <span className="text-xl font-semibold">$0</span>
          </div>
          <ul className="mt-5 flex-1 space-y-2.5">
            {FREE_FEATURES.map((b) => (
              <li key={b} className="flex gap-2 text-sm" style={{ color: 'var(--text-2)' }}>
                <span style={{ color: 'var(--text-3)' }}>✓</span>
                {b}
              </li>
            ))}
          </ul>
          <Link href="/dashboard" className="btn btn-ghost mt-6 w-full h-11 text-sm inline-flex items-center justify-center">
            {isSignedIn ? 'Open free desk' : 'Sign in for free'}
          </Link>
        </div>

        <div
          className="rounded-xl border p-6 flex flex-col"
          style={{
            borderColor: 'rgba(92,184,122,0.35)',
            background: 'linear-gradient(180deg, rgba(92,184,122,0.08), var(--bg-card))',
          }}
        >
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-lg font-semibold">
              Pro{' '}
              <span className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--mint)' }}>
                Best
              </span>
            </span>
            <span className="text-xl font-semibold tabular-nums">{PRO_PRICE_LABEL}</span>
          </div>
          <p className="mt-1 text-[12px]" style={{ color: 'var(--text-3)' }}>
            Everything in Free, plus:
          </p>
          <ul className="mt-4 flex-1 space-y-2.5">
            {PRO_FEATURES.map((b) => (
              <li key={b} className="flex gap-2 text-sm" style={{ color: 'var(--text-2)' }}>
                <span style={{ color: 'var(--mint)' }}>✓</span>
                {b}
              </li>
            ))}
          </ul>

          {isPro ? (
            <div className="mt-6 space-y-3">
              <p className="text-sm font-medium" style={{ color: 'var(--mint)' }}>
                You are on Pro{user?.email ? ` · ${user.email}` : ''}
              </p>
              <Link href="/arbs" className="btn btn-primary w-full h-11 text-sm inline-flex items-center justify-center">
                Open Pro tools
              </Link>
            </div>
          ) : (
            <button
              type="button"
              disabled={busy || !ready}
              onClick={() => void onUpgrade()}
              className="btn btn-primary mt-6 w-full h-11 text-sm disabled:opacity-50"
            >
              {!ready
                ? 'Loading…'
                : busy
                  ? 'Please wait…'
                  : isSignedIn
                    ? `Upgrade - ${PRO_PRICE_LABEL}`
                    : 'Sign up to go Pro'}
            </button>
          )}
        </div>
      </div>

      {message ? (
        <p className="mt-4 text-sm" style={{ color: 'var(--mint)' }}>
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="mt-4 text-sm" style={{ color: 'var(--rose, #f87171)' }}>
          {error}
        </p>
      ) : null}

      <p className="mt-6 text-center text-xs" style={{ color: 'var(--text-3)' }}>
        <Link href="/" className="underline-offset-2 hover:underline">
          Back to home
        </Link>
        {' · '}
        <Link href="/dashboard" className="underline-offset-2 hover:underline">
          Dashboard
        </Link>
      </p>
    </div>
  );
}

export default function PaywallPage() {
  return (
    <Suspense
      fallback={
        <div className="shell py-10 text-sm" style={{ color: 'var(--text-3)' }}>
          Loading…
        </div>
      }
    >
      <PaywallInner />
    </Suspense>
  );
}
