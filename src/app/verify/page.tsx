'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth/AuthProvider';
import { verifyEmailToken } from '@/lib/auth/client';
import { useAuthModal } from '@/lib/auth/AuthModalContext';

/** Email-link landing only. Main verify UX lives in the auth modal. */
export default function VerifyPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center text-sm" style={{ color: 'var(--text-3)' }}>
          Loading…
        </div>
      }
    >
      <VerifyToken />
    </Suspense>
  );
}

function VerifyToken() {
  const sp = useSearchParams();
  const token = sp.get('token');
  const { refreshSession, emailVerified } = useAuth();
  const { openAuth } = useAuthModal();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      openAuth({ mode: 'signup', panel: 'checkEmail', next: '/dashboard' });
      router.replace('/');
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        await verifyEmailToken(token);
        if (cancelled) return;
        await refreshSession();
        router.replace('/dashboard');
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Verification failed');
        openAuth({ mode: 'signup', panel: 'checkEmail', next: '/dashboard' });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, refreshSession, router, openAuth]);

  useEffect(() => {
    if (emailVerified) router.replace('/dashboard');
  }, [emailVerified, router]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo.png"
        alt=""
        className="h-10 w-10 rounded-lg object-cover"
        width={40}
        height={40}
      />
      <p className="mt-5 text-sm" style={{ color: 'var(--text-2)' }}>
        {error || 'Confirming your email…'}
      </p>
    </div>
  );
}
