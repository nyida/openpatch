'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

type User = { id: string; email: string };

export function NavAuth() {
  const [user, setUser] = useState<User | null | undefined>(undefined);

  useEffect(() => {
    fetch('/api/auth/session')
      .then((r) => r.json())
      .then((data) => setUser(data.user ?? null))
      .catch(() => setUser(null));
  }, []);

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/';
  }

  if (user === undefined) {
    return (
      <div className="ml-4 h-9 w-20 animate-pulse rounded bg-slate-100" aria-hidden />
    );
  }

  if (!user) {
    return (
      <Link
        href="/auth"
        className="ml-4 btn-primary inline-flex items-center justify-center min-w-[88px]"
      >
        Sign in
      </Link>
    );
  }

  return (
    <div className="ml-4 flex items-center gap-2">
      <span className="inline-flex items-center gap-1.5 rounded-md bg-[var(--bg-subtle)] border border-[var(--border)] px-3 py-1.5 text-sm">
        <span className="h-1.5 w-1.5 rounded-full bg-[var(--success)]" aria-hidden />
        <span className="font-medium text-[var(--text-secondary)]">Signed in</span>
        <span className="text-[var(--text-muted)] max-w-[120px] truncate" title={user.email}>
          {user.email}
        </span>
      </span>
      <button
        type="button"
        onClick={handleLogout}
        className="px-3 py-1.5 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-none transition-colors"
      >
        Sign out
      </button>
    </div>
  );
}
