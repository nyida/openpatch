'use client';

import {
  Suspense,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

export type AuthMode = 'login' | 'signup';

type OpenOpts = {
  mode?: AuthMode;
  next?: string;
};

type AuthModalContextValue = {
  open: boolean;
  mode: AuthMode;
  next: string;
  openAuth: (opts?: OpenOpts) => void;
  closeAuth: () => void;
  setMode: (mode: AuthMode) => void;
};

const AuthModalContext = createContext<AuthModalContextValue | null>(null);

const AUTH_MODAL_FALLBACK: AuthModalContextValue = {
  open: false,
  mode: 'login',
  next: '/dashboard',
  openAuth: () => {},
  closeAuth: () => {},
  setMode: () => {},
};

export function useAuthModal() {
  const ctx = useContext(AuthModalContext);
  if (!ctx) {
    throw new Error('useAuthModal must be used within AuthModalProvider');
  }
  return ctx;
}

export function useAuthModalOptional() {
  return useContext(AuthModalContext);
}

function AuthModalProviderInner({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<AuthMode>('login');
  const [next, setNext] = useState('/dashboard');

  const stripAuthParams = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (!params.has('auth')) return;
    params.delete('auth');
    const q = params.toString();
    router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
  }, [pathname, router, searchParams]);

  const openAuth = useCallback((opts?: OpenOpts) => {
    if (opts?.mode) setMode(opts.mode);
    if (opts?.next) setNext(opts.next);
    setOpen(true);
  }, []);

  const closeAuth = useCallback(() => {
    setOpen(false);
    stripAuthParams();
  }, [stripAuthParams]);

  useEffect(() => {
    const auth = searchParams.get('auth');
    if (auth === 'login' || auth === 'signup') {
      setMode(auth);
      const n = searchParams.get('next');
      if (n) setNext(n);
      setOpen(true);
    }
  }, [searchParams]);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('algomarket.authModal');
      if (!raw) return;
      sessionStorage.removeItem('algomarket.authModal');
      const parsed = JSON.parse(raw) as { mode?: AuthMode; next?: string };
      if (parsed.mode === 'login' || parsed.mode === 'signup') setMode(parsed.mode);
      if (parsed.next) setNext(parsed.next);
      setOpen(true);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeAuth();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, closeAuth]);

  const value = useMemo(
    () => ({ open, mode, next, openAuth, closeAuth, setMode }),
    [open, mode, next, openAuth, closeAuth],
  );

  return (
    <AuthModalContext.Provider value={value}>{children}</AuthModalContext.Provider>
  );
}

export function AuthModalProvider({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <AuthModalContext.Provider value={AUTH_MODAL_FALLBACK}>
          {children}
        </AuthModalContext.Provider>
      }
    >
      <AuthModalProviderInner>{children}</AuthModalProviderInner>
    </Suspense>
  );
}
