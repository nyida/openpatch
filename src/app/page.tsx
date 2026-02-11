'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { ReliabilityReport } from '@/components/ReliabilityReport';

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
  runId?: string;
  reliability?: Record<string, unknown>;
  latencyMs?: number;
};

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.1 },
  },
};

const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0 },
};

const bubble = {
  initial: { opacity: 0, y: 16, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, scale: 0.98 },
};

export default function HomePage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [urls, setUrls] = useState('');
  const [uploadIds, setUploadIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  useEffect(() => { scrollToBottom(); }, [messages, loading]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const list = e.target.files;
    if (!list?.length) return;
    for (const f of Array.from(list)) {
      const form = new FormData();
      form.set('file', f);
      const res = await fetch('/api/upload', { method: 'POST', body: form });
      const data = await res.json();
      if (data.id) setUploadIds((prev) => [...prev, data.id]);
    }
  }

  async function handleSend() {
    const toSend = input.trim();
    if (!toSend && messages.length === 0) return;
    if (loading) return;

    setLoading(true);
    setError(null);
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: toSend }]);

    try {
      const body: {
        inputText: string;
        urls?: string[];
        attachmentIds?: string[];
        conversationHistory?: { role: string; content: string }[];
      } = { inputText: toSend };

      if (messages.length === 0) {
        if (urls.trim()) body.urls = urls.split('\n').map((u) => u.trim()).filter(Boolean);
        if (uploadIds.length) body.attachmentIds = uploadIds;
      } else {
        body.conversationHistory = [...messages, { role: 'user', content: toSend }].map((m) => ({ role: m.role, content: m.content }));
      }

      const res = await fetch('/api/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Request failed');

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: data.finalAnswer,
          runId: data.runId,
          reliability: data.reliability as Record<string, unknown>,
          latencyMs: data.latencyMs,
        },
      ]);
      if (messages.length === 0) {
        setUrls('');
        setUploadIds([]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setLoading(false);
    }
  }

  const isFirstTurn = messages.length === 0;

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] max-w-4xl mx-auto -mb-8 min-h-0">
      {isFirstTurn && !loading && (
        <motion.div
          className="flex-shrink-0 px-4 pt-12 pb-8 text-center bg-mesh rounded-3xl mx-4 mt-2 mb-2"
          variants={container}
          initial="hidden"
          animate="show"
        >
          <motion.div
            variants={item}
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl overflow-hidden shadow-glow-lg mb-6 ring-4 ring-teal-500/20 bg-white"
            whileHover={{ scale: 1.05, rotate: 2 }}
            transition={{ type: 'spring', stiffness: 400, damping: 17 }}
          >
            <Image src="/logo.png" alt="" width={64} height={64} className="object-contain p-1" aria-hidden />
          </motion.div>
          <motion.div variants={item} className="flex items-center justify-center gap-2.5">
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">OpenPatch</h1>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 bg-white/90 px-2 py-0.5 rounded shadow-sm">v1</span>
          </motion.div>
          <motion.p variants={item} className="mt-3 text-slate-600 max-w-md mx-auto leading-relaxed text-[15px]">
            Ask anything. Multiple models answer, we verify and pick the best. Attach docs or URLs for sourced answers.
          </motion.p>
          <motion.div variants={item} className="mt-6 flex flex-wrap justify-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/80 text-xs font-medium text-slate-600 shadow-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Verified answers
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/80 text-xs font-medium text-slate-600 shadow-sm">
              Full trace
            </span>
            <Link
              href="/paper.pdf"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-teal-500/15 text-xs font-medium text-teal-700 shadow-sm border border-teal-500/20 hover:bg-teal-500/25 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              Research paper
            </Link>
          </motion.div>
        </motion.div>
      )}

      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6 min-h-0">
        <AnimatePresence initial={false}>
          {messages.map((m, i) => (
            <motion.div
              key={i}
              layout
              initial="initial"
              animate="animate"
              exit="exit"
              variants={bubble}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <motion.div
                layout
                className={`max-w-[88%] rounded-2xl px-5 py-4 ${
                  m.role === 'user'
                    ? 'bg-gradient-to-br from-teal-600 to-teal-700 text-white shadow-soft shadow-teal-900/10'
                    : 'bg-white border border-slate-200/80 shadow-soft'
                }`}
                whileHover={{ boxShadow: '0 10px 25px -8px rgb(0 0 0 / 0.1), 0 0 0 1px rgb(0 0 0 / 0.04)' }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              >
                <div className="whitespace-pre-wrap text-[15px] leading-[1.6]">
                  {m.content}
                </div>
                {m.role === 'assistant' && (m.runId || m.reliability || m.latencyMs != null) && (
                  <div className="mt-4 pt-4 border-t border-slate-100 space-y-3">
                    {m.reliability && typeof m.reliability === 'object' && (
                      <ReliabilityReport data={m.reliability as import('@/components/ReliabilityReport').ReliabilityData} />
                    )}
                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      {m.latencyMs != null && (
                        <span className="font-medium">{m.latencyMs}ms</span>
                      )}
                      {m.runId && (
                        <Link
                          href={`/runs/${m.runId}`}
                          className="text-teal-600 hover:text-teal-700 font-medium inline-flex items-center gap-1 transition-colors"
                        >
                          View trace
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                        </Link>
                      )}
                    </div>
                  </div>
                )}
              </motion.div>
            </motion.div>
          ))}
        </AnimatePresence>
        {loading && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex justify-start"
          >
            <motion.div
              className="bg-white border border-slate-200/80 rounded-2xl px-5 py-4 shadow-soft inline-flex gap-2"
              animate={{ boxShadow: ['0 2px 8px -2px rgb(0 0 0 / 0.06)', '0 8px 20px -6px rgb(13 148 136 / 0.2)'] }}
              transition={{ repeat: Infinity, duration: 1.5, repeatType: 'reverse' }}
            >
              <motion.span className="w-2.5 h-2.5 rounded-full bg-teal-500" animate={{ y: [0, -6, 0] }} transition={{ repeat: Infinity, duration: 0.5 }} />
              <motion.span className="w-2.5 h-2.5 rounded-full bg-teal-500" animate={{ y: [0, -6, 0] }} transition={{ repeat: Infinity, duration: 0.5, delay: 0.1 }} />
              <motion.span className="w-2.5 h-2.5 rounded-full bg-teal-500" animate={{ y: [0, -6, 0] }} transition={{ repeat: Infinity, duration: 0.5, delay: 0.2 }} />
            </motion.div>
          </motion.div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="flex-shrink-0 px-4 pb-2"
          >
            <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        className="flex-shrink-0 border-t border-slate-200/80 bg-white/95 backdrop-blur-md p-4 shadow-[0_-4px_24px_-8px_rgba(0,0,0,0.06),0_-1px_0_0_rgba(0,0,0,0.04)]"
        initial={false}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
      >
        {isFirstTurn ? (
          <div className="space-y-4">
            <div className="relative">
              <textarea
                className="input-base resize-none min-h-[110px] focus:ring-2 focus:ring-teal-500/25 focus:shadow-glow"
                placeholder="Ask anything..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
                }}
              />
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              <textarea
                className="flex-1 min-w-[200px] input-base min-h-[44px] py-2.5 text-sm"
                placeholder="Paste URLs (optional)"
                value={urls}
                onChange={(e) => setUrls(e.target.value)}
                rows={1}
              />
              <input ref={fileInputRef} type="file" multiple accept=".txt,.pdf,.md,.json,.csv" className="hidden" onChange={handleUpload} />
              <motion.button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="btn-secondary text-sm py-2 px-4"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                Attach files
              </motion.button>
              {uploadIds.length > 0 && (
                <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-xs text-slate-500 font-medium">
                  {uploadIds.length} file(s)
                </motion.span>
              )}
              <motion.button
                type="button"
                onClick={handleSend}
                disabled={loading}
                className="btn-primary ml-auto"
                whileHover={!loading ? { scale: 1.02, boxShadow: '0 6px 20px -4px rgb(13 148 136 / 0.4)' } : {}}
                whileTap={!loading ? { scale: 0.98 } : {}}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              >
                Run
              </motion.button>
            </div>
          </div>
        ) : (
          <div className="flex gap-3">
            <input
              type="text"
              className="input-base flex-1 focus:ring-2 focus:ring-teal-500/25 focus:shadow-glow"
              placeholder="Follow up..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
              }}
            />
            <motion.button
              type="button"
              onClick={handleSend}
              disabled={loading}
              className="btn-primary px-6"
              whileHover={!loading ? { scale: 1.02, boxShadow: '0 6px 20px -4px rgb(13 148 136 / 0.4)' } : {}}
              whileTap={!loading ? { scale: 0.98 } : {}}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            >
              Send
            </motion.button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
