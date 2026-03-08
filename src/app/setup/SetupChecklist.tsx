'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type Status = { database: boolean; supabase: boolean; llm: boolean; ready: boolean };

export function SetupChecklist() {
  const [status, setStatus] = useState<Status | null>(null);

  useEffect(() => {
    fetch('/api/setup')
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => setStatus(null));
  }, []);

  if (!status) {
    return (
      <div className="card p-6 text-center text-slate-500">
        Checking configuration…
      </div>
    );
  }

  const items = [
    {
      key: 'database' as const,
      label: 'Database (Postgres)',
      done: status.database,
      link: 'https://vercel.com/integrations/neon',
      linkText: 'Add Neon (free)',
      fallback: 'Or Vercel Postgres. Integration auto-adds the URL—no manual env vars.',
    },
    {
      key: 'supabase' as const,
      label: 'Supabase (auth)',
      done: status.supabase,
      link: 'https://vercel.com/integrations/supabase',
      linkText: 'Add Supabase (free)',
      fallback: 'Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY. Then add your site URL to Supabase → Auth → URL Configuration.',
    },
    {
      key: 'llm' as const,
      label: 'LLM API key',
      done: status.llm,
      link: 'https://openrouter.ai/keys',
      linkText: 'Get OpenRouter key',
      fallback: 'Set OPENROUTER_API_KEY or OPENAI_API_KEY.',
    },
  ];

  return (
    <div className="space-y-4">
      {items.map((item) => (
        <div
          key={item.key}
          className={`card p-4 flex items-start gap-4 ${
            item.done ? 'border-emerald-200 bg-emerald-50/50' : ''
          }`}
        >
          <span
            className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-sm ${
              item.done ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-500'
            }`}
          >
            {item.done ? '✓' : '?'}
          </span>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-slate-800">{item.label}</p>
            {item.done ? (
              <p className="text-sm text-emerald-700 mt-0.5">Configured</p>
            ) : (
              <p className="text-sm text-slate-600 mt-1">
                <a
                  href={item.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-teal-600 hover:text-teal-700 font-medium"
                >
                  {item.linkText}
                </a>
                {' · '}
                {item.fallback}
              </p>
            )}
          </div>
        </div>
      ))}
      {status.ready && (
        <div className="card p-4 border-emerald-200 bg-emerald-50 text-center">
          <p className="font-medium text-emerald-800">Ready to go</p>
          <p className="text-sm text-emerald-700 mt-1">
            Run <code className="bg-emerald-100 px-1">npx prisma db push</code> once if you haven&apos;t, then redeploy.
          </p>
          <Link href="/" className="btn-primary mt-3 inline-block">
            Open Chat
          </Link>
        </div>
      )}
    </div>
  );
}
