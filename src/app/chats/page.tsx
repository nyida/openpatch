'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PageMotion } from '@/components/PageMotion';

type ChatSummary = { id: string; title: string; updatedAt: string };

export default function ChatsPage() {
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/chats');
        if (res.ok) {
          const data = await res.json();
          setChats(data);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <PageMotion className="max-w-4xl mx-auto px-4 py-10">
      <div className="mb-10">
        <div className="flex items-center gap-3">
          <h1 className="page-title">Chats</h1>
          <span className="badge text-slate-500 bg-slate-100/90">v1</span>
        </div>
        <p className="page-subtitle">Open a past conversation to continue or view.</p>
      </div>
      {loading ? (
        <p className="text-slate-500 text-sm">Loading…</p>
      ) : chats.length === 0 ? (
        <p className="text-slate-500 text-sm">No saved chats yet. Start a conversation on Chat and it will be saved here.</p>
      ) : (
        <ul className="space-y-2">
          {chats.map((c) => (
            <li key={c.id}>
              <Link
                href={`/?chat=${c.id}`}
                className="block rounded-none border border-slate-200/90 bg-white p-4 transition-all hover:border-slate-300 hover:shadow-sm"
              >
                <p className="text-slate-800 font-medium line-clamp-1">{c.title || 'Chat'}</p>
                <p className="text-xs text-slate-500 mt-1">
                  {new Date(c.updatedAt).toLocaleString()}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </PageMotion>
  );
}
