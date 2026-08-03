'use client';

import { useEffect, useId, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import { useAuth } from '@/lib/auth/AuthProvider';
import { useAuthModal } from '@/lib/auth/AuthModalContext';
import { resendVerification } from '@/lib/auth/client';
import { GoogleSignInButton } from '@/components/auth/GoogleSignInButton';

export function AuthModal() {
  const { open, mode, panel, next, closeAuth, setMode, setPanel } = useAuthModal();
  const { signIn, signUp, signInWithGoogle, user, refreshSession, signOut } = useAuth();
  const router = useRouter();
  const reduce = useReducedMotion();
  const titleId = useId();
  const [mounted, setMounted] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [verifyPreview, setVerifyPreview] = useState<string | null>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) {
      setError(null);
      setInfo(null);
      setBusy(false);
      setPassword('');
      setVerifyPreview(null);
    }
  }, [open]);

  useEffect(() => {
    if (open && panel === 'checkEmail' && user?.email) {
      setEmail(user.email);
    }
  }, [open, panel, user?.email]);

  useEffect(() => {
    if (!open || panel !== 'checkEmail') return;
    if (user?.emailVerified) {
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
    }
  }, [user?.emailVerified, user?.tier, open, panel, closeAuth, next, router]);

  if (!mounted) return null;

  function finishVerified(tier: string) {
    closeAuth();
    const dest =
      tier === 'pro'
        ? next && next !== '/'
          ? next
          : '/dashboard'
        : next && next !== '/' && next !== '/paywall'
          ? next
          : '/dashboard';
    router.replace(dest);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      if (mode === 'signup') {
        const res = await signUp({
          email,
          password,
          displayName: displayName || undefined,
        });
        if (res.user.emailVerified) {
          finishVerified(res.user.tier);
          return;
        }
        if (res.verifyPreview) setVerifyPreview(res.verifyPreview);
        if (res.emailError) {
          setInfo(res.emailError);
        } else if (res.emailSent) {
          setInfo('Check your inbox for a verification link.');
        } else {
          setInfo('We could not send email yet. Use the link below or try Resend again.');
        }
        setPanel('checkEmail');
      } else {
        const u = await signIn({ email, password });
        if (!u.emailVerified) {
          setPanel('checkEmail');
          setInfo('Confirm your email to continue.');
          return;
        }
        finishVerified(u.tier);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  async function onGoogle(idToken: string) {
    setBusy(true);
    setError(null);
    try {
      const u = await signInWithGoogle(idToken);
      finishVerified(u.tier);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google sign-in failed');
    } finally {
      setBusy(false);
    }
  }

  async function onResend() {
    setBusy(true);
    setError(null);
    try {
      const res = await resendVerification();
      if (res.alreadyVerified) {
        await refreshSession();
        finishVerified(user?.tier || 'free');
        return;
      }
      if (res.verifyPreview) setVerifyPreview(res.verifyPreview);
      setInfo(
        res.sent
          ? 'Sent again. Check your inbox.'
          : res.verifyPreview
            ? 'Email blocked by provider — use the local link below.'
            : 'Could not send email.',
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not resend');
    } finally {
      setBusy(false);
    }
  }

  async function onRefreshVerified() {
    setBusy(true);
    setError(null);
    try {
      await refreshSession();
    } finally {
      setBusy(false);
    }
  }

  const checkEmail = panel === 'checkEmail';

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
                {checkEmail ? (
                  <motion.div
                    key="check"
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
                      Check your email
                    </h2>
                    <p className="mt-1.5 text-[13px] leading-relaxed" style={{ color: 'var(--text-2)' }}>
                      We sent a link to{' '}
                      <span className="font-medium" style={{ color: 'var(--text)' }}>
                        {user?.email || email}
                      </span>
                      . Open it to finish signup.
                    </p>

                    {info ? (
                      <p
                        className="mt-4 rounded-md px-3 py-2 text-[12px] leading-relaxed"
                        style={{
                          background: 'rgba(255,255,255,0.06)',
                          color: 'var(--text-2)',
                        }}
                      >
                        {info}
                      </p>
                    ) : null}

                    {error ? (
                      <p
                        className="mt-3 rounded-md px-3 py-2 text-[13px] font-medium"
                        style={{
                          background: 'rgba(220, 80, 80, 0.12)',
                          color: 'var(--rose, #f87171)',
                        }}
                      >
                        {error}
                      </p>
                    ) : null}

                    {verifyPreview ? (
                      <p
                        className="mt-3 break-all text-[11px] font-mono leading-relaxed"
                        style={{ color: 'var(--text-3)' }}
                      >
                        Dev link:{' '}
                        <a href={verifyPreview} className="underline">
                          {verifyPreview}
                        </a>
                      </p>
                    ) : null}

                    <div className="mt-5 space-y-2">
                      <button
                        type="button"
                        disabled={busy}
                        className="btn btn-primary flex h-11 w-full items-center justify-center text-[13px] disabled:opacity-50"
                        onClick={() => void onResend()}
                      >
                        {busy ? 'Sending…' : 'Resend email'}
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        className="btn btn-ghost flex h-11 w-full items-center justify-center text-[13px] disabled:opacity-50"
                        onClick={() => void onRefreshVerified()}
                      >
                        I verified — continue
                      </button>
                      <button
                        type="button"
                        className="flex h-9 w-full items-center justify-center text-[12px]"
                        style={{ color: 'var(--text-3)' }}
                        onClick={() => {
                          signOut();
                          setPanel('form');
                          setMode('login');
                          setInfo(null);
                          setVerifyPreview(null);
                        }}
                      >
                        Use a different account
                      </button>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="form"
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
                        ? 'Continue with Google or email. We will send a verification link.'
                        : 'Sign in with Google or your email and password.'}
                    </p>

                    <div className="mt-5">
                      <GoogleSignInButton onCredential={onGoogle} disabled={busy} />
                    </div>

                    <div className="my-4 flex items-center gap-3">
                      <div className="h-px flex-1" style={{ background: 'var(--line)' }} />
                      <span
                        className="text-[11px] uppercase tracking-wider"
                        style={{ color: 'var(--text-3)' }}
                      >
                        or email
                      </span>
                      <div className="h-px flex-1" style={{ background: 'var(--line)' }} />
                    </div>

                    <LayoutGroup>
                      <div
                        className="relative grid grid-cols-2 gap-1 rounded-lg p-1"
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
                        autoComplete={
                          mode === 'signup' ? 'new-password' : 'current-password'
                        }
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
                  </motion.div>
                )}
              </AnimatePresence>
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
