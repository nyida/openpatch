'use client';

import { useState } from 'react';

export function AuthForm() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      setDone(true);
      window.location.reload();
    } finally {
      setLoading(false);
    }
  }
  if (done) return <p className="text-slate-600">Checking session…</p>;
  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        type="email"
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="rounded-none border border-slate-300 px-4 py-2.5 flex-1 focus:ring-2 focus:ring-teal-500 focus:border-transparent"
        required
      />
      <button type="submit" disabled={loading} className="btn-primary">
        {loading ? '…' : 'Sign in'}
      </button>
    </form>
  );
}
