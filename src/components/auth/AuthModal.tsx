'use client';

import { useEffect, useId, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import { useAuth } from '@/lib/auth/AuthProvider';
import { useAuthModal } from '@/lib/auth/AuthModalContext';

export function AuthModal() {
  const { open, mode, next, closeAuth, setMode } = useAuthModal();
  const { signIn, signUp } = useAuth();
  const router = useRouter();
  const reduce = useReducedMotion();
  const titleId = useId();
  const [mounted, setMounted] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) {
      setError(null);
      setBusy(false);
      setPassword('');
    }
  }, [open]);

  if (!mounted) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const user =
        mode === 'signup'
          ? await signUp({
              email,
              password,
              displayName: displayName || undefined,
            })
          : await signIn({ email, password });
      closeAuth();
      const dest =
        user.tier === 'pro'
          ? next && next !== '/'
            ? next
            : '/dashboard'
          : next && next !== '/' && next !== '/paywall'
            ? next
            : '/dashboard';
      router.replace(dest);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[80] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduce ? 0 : 0.2 }}
        >
          <button
            type="button"
            aria-label="Close"
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={closeAuth}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            initial={reduce ? false : { opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? undefined : { opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: reduce ? 0 : 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="relative z-10 w-full max-w-[420px] overflow-hidden rounded-xl border shadow-2xl"
            style={{
              background: 'var(--bg-card)',
              borderColor: 'var(--line)',
              color: 'var(--text)',
            }}
          >
            <button
              type="button"
              onClick={closeAuth}
              className="absolute right-3 top-3 rounded-md p-1.5 transition hover:opacity-80"
              style={{ color: 'var(--text-3)' }}
              aria-label="Close dialog"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="px-6 pb-6 pt-7">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={mode}
                  initial={reduce ? false : { opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduce ? undefined : { opacity: 0, y: -4 }}
                  transition={{ duration: 0.18 }}
                >
                  <h2
                    id={titleId}
                    className="text-[22px] font-semibold tracking-tight"
                    style={{ fontFamily: 'var(--font-sans)' }}
                  >
                    {mode === 'signup' ? 'Create your account' : 'Welcome back'}
                  </h2>
                  <p className="mt-1.5 text-[13px]" style={{ color: 'var(--text-2)' }}>
                    {mode === 'signup'
                      ? 'Save your account, then upgrade to Pro when you are ready.'
                      : 'Sign in to manage billing and Pro status.'}
                  </p>
                </motion.div>
              </AnimatePresence>

              <LayoutGroup>
                <div
                  className="relative mt-5 grid grid-cols-2 gap-1 rounded-lg p-1"
                  style={{ background: 'var(--bg-2, rgba(255,255,255,0.04))' }}
                  role="tablist"
                  aria-label="Auth mode"
                >
                  {(
                    [
                      { id: 'login' as const, label: 'Sign in' },
                      { id: 'signup' as const, label: 'Create account' },
                    ] as const
                  ).map((tab) => {
                    const active = mode === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        onClick={() => {
                          setMode(tab.id);
                          setError(null);
                        }}
                        className="relative z-10 h-9 rounded-md text-[13px] font-medium transition-colors"
                        style={{ color: active ? 'var(--text)' : 'var(--text-3)' }}
                      >
                        {active ? (
                          <motion.span
                            layoutId="auth-mode-pill"
                            className="absolute inset-0 rounded-md border"
                            style={{
                              background: 'var(--bg-raised)',
                              borderColor: 'var(--line)',
                            }}
                            transition={
                              reduce
                                ? { duration: 0 }
                                : { type: 'spring', stiffness: 480, damping: 36 }
                            }
                          />
                        ) : null}
                        <span className="relative z-10">{tab.label}</span>
                      </button>
                    );
                  })}
                </div>
              </LayoutGroup>

              <form onSubmit={(e) => void submit(e)} className="mt-5 space-y-3.5">
                <AnimatePresence initial={false} mode="popLayout">
                  {mode === 'signup' ? (
                    <motion.div
                      key="name"
                      initial={reduce ? false : { opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={reduce ? undefined : { opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <Field
                        id="auth-name"
                        label="Name"
                        autoComplete="name"
                        value={displayName}
                        onChange={setDisplayName}
                        placeholder="Alex Rivera"
                      />
                    </motion.div>
                  ) : null}
                </AnimatePresence>

                <Field
                  id="auth-email"
                  label="Email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={setEmail}
                  placeholder="you@email.com"
                />
                <Field
                  id="auth-password"
                  label="Password"
                  type="password"
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  required
                  minLength={8}
                  value={password}
                  onChange={setPassword}
                  placeholder="At least 8 characters"
                  hint={mode === 'signup' ? '8+ characters' : undefined}
                />

                {error ? (
                  <p
                    className="rounded-md px-3 py-2 text-[13px] font-medium"
                    style={{
                      background: 'rgba(220, 80, 80, 0.12)',
                      color: 'var(--rose, #f87171)',
                    }}
                  >
                    {error}
                  </p>
                ) : null}

                <button
                  type="submit"
                  disabled={busy}
                  className="btn btn-primary mt-1 flex h-11 w-full items-center justify-center text-[13px] disabled:opacity-50"
                >
                  {busy
                    ? 'Please wait…'
                    : mode === 'signup'
                      ? 'Create account'
                      : 'Sign in'}
                </button>
              </form>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  autoComplete,
  required,
  minLength,
  hint,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  autoComplete?: string;
  required?: boolean;
  minLength?: number;
  hint?: string;
}) {
  return (
    <label className="block" htmlFor={id}>
      <span className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className="text-[12px] font-medium" style={{ color: 'var(--text-2)' }}>
          {label}
        </span>
        {hint ? (
          <span className="text-[11px]" style={{ color: 'var(--text-3)' }}>
            {hint}
          </span>
        ) : null}
      </span>
      <input
        id={id}
        className="h-11 w-full rounded-md border px-3.5 text-[14px] outline-none transition focus:ring-1"
        style={{
          background: 'var(--bg)',
          borderColor: 'var(--line)',
          color: 'var(--text)',
        }}
        type={type}
        autoComplete={autoComplete}
        required={required}
        minLength={minLength}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
