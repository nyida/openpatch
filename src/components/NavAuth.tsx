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
        className="ml-4 inline-flex items-center gap-2 rounded-none border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-400 transition-colors"
      >
        Sign in
      </Link>
    );
  }

  return (
    <div className="ml-4 flex items-center gap-2">
      <span className="inline-flex items-center gap-1.5 rounded-none bg-emerald-50 border border-emerald-200 px-3 py-1.5 text-sm">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
        <span className="font-medium text-emerald-800">Logged in</span>
        <span className="text-emerald-700 max-w-[120px] truncate" title={user.email}>
          {user.email}
        </span>
      </span>
      <button
        type="button"
        onClick={handleLogout}
        className="px-3 py-1.5 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-none transition-colors"
      >
        Log out
      </button>
    </div>
  );
}
