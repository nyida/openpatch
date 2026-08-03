'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useAuth } from '@/lib/auth/AuthProvider';
import { useAuthModal } from '@/lib/auth/AuthModalContext';
import { resendVerification } from '@/lib/auth/client';

export default function AccountPage() {
  const { ready, user, isSignedIn, isPro, emailVerified, signOut, refreshSession } =
    useAuth();
  const { openAuth } = useAuthModal();
  const [resendMsg, setResendMsg] = useState<string | null>(null);
  const [resendBusy, setResendBusy] = useState(false);

  if (!ready) {
    return (
      <div className="shell py-10 text-sm" style={{ color: 'var(--text-3)' }}>
        Loading…
      </div>
    );
  }

  if (!isSignedIn || !user) {
    return (
      <div className="shell py-10 max-w-md mx-auto">
        <h1 className="font-sans text-2xl font-bold tracking-tight">Account</h1>
        <p className="mt-2 text-sm" style={{ color: 'var(--text-2)' }}>
          Sign in to view billing status and manage your Algomarket account.
        </p>
        <div className="mt-6 flex gap-2">
          <button
            type="button"
            className="btn btn-primary text-sm"
            onClick={() => openAuth({ mode: 'login', next: '/account' })}
          >
            Sign in
          </button>
          <button
            type="button"
            className="btn btn-ghost text-sm"
            onClick={() => openAuth({ mode: 'signup', next: '/account' })}
          >
            Create account
          </button>
        </div>
      </div>
    );
  }

  async function onResend() {
    setResendBusy(true);
    setResendMsg(null);
    try {
      const res = await resendVerification();
      if (res.alreadyVerified) {
        await refreshSession();
        setResendMsg('Email already verified.');
      } else if (res.verifyPreview) {
        setResendMsg(`Dev link: ${res.verifyPreview}`);
      } else {
        setResendMsg(res.sent ? 'Verification email sent.' : 'Could not send email.');
      }
    } catch (err) {
      setResendMsg(err instanceof Error ? err.message : 'Could not resend');
    } finally {
      setResendBusy(false);
    }
  }

  return (
    <div className="shell py-10 max-w-md mx-auto">
      <h1 className="font-sans text-2xl font-bold tracking-tight">Account</h1>
      <div
        className="mt-6 rounded-xl border p-5 space-y-3 text-sm"
        style={{ borderColor: 'var(--line)', background: 'var(--bg-card)' }}
      >
        <Row label="Name" value={user.displayName} />
        <Row label="Email" value={user.email} />
        <Row label="Email status" value={emailVerified ? 'Verified' : 'Unverified'} />
        <Row label="Plan" value={isPro ? 'Pro' : 'Free'} />
        <Row
          label="Member since"
          value={new Date(user.createdAt).toLocaleDateString()}
        />
      </div>

      {!emailVerified ? (
        <div
          className="mt-4 rounded-xl border p-4 text-sm"
          style={{ borderColor: 'var(--line)', background: 'var(--bg-card)' }}
        >
          <p style={{ color: 'var(--text-2)' }}>
            Confirm your email to access the desk.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-primary text-sm"
              onClick={() => openAuth({ mode: 'signup', panel: 'checkEmail', next: '/account' })}
            >
              Open verify
            </button>
            <button
              type="button"
              className="btn btn-ghost text-sm"
              disabled={resendBusy}
              onClick={() => void onResend()}
            >
              {resendBusy ? 'Sending…' : 'Resend link'}
            </button>
          </div>
          {resendMsg ? (
            <p className="mt-2 break-all text-[12px]" style={{ color: 'var(--text-3)' }}>
              {resendMsg}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="mt-6 flex flex-wrap gap-2">
        {!isPro ? (
          <Link href="/paywall" className="btn btn-primary text-sm">
            Upgrade to Pro
          </Link>
        ) : (
          <Link href="/paywall" className="btn btn-ghost text-sm">
            Billing
          </Link>
        )}
        <button
          type="button"
          className="btn btn-ghost text-sm"
          onClick={() => {
            signOut();
            window.location.href = '/';
          }}
        >
          Sign out
        </button>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span style={{ color: 'var(--text-3)' }}>{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  );
}
