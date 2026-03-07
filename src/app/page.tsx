'use client';

import { useState, useRef, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { ReliabilityReport } from '@/components/ReliabilityReport';
import { MarkdownContent } from '@/components/MarkdownContent';
import { AnimatedBackground } from '@/components/AnimatedBackground';

type CortexAlternative = { model: string; output: string; confidence?: number; latency_ms?: number };

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
  runId?: string;
  reliability?: Record<string, unknown>;
  latencyMs?: number;
  /** Run trace for research export (when improvedMode was used). */
  runTrace?: Record<string, unknown>;
  /** CORTEX: confidence-optimized routing response */
  cortex?: {
    confidence: number;
    reliability: string;
    selected_model: string;
    alternatives: CortexAlternative[];
  };
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

function HomePageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const chatIdFromUrl = searchParams.get('chat');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [urls, setUrls] = useState('');
  const [uploads, setUploads] = useState<{ id: string; name: string }[]>([]);
  const [improvedMode, setImprovedMode] = useState(false);
  const [cortexMode, setCortexMode] = useState(false);
  const pipelineMode: 'standard' | 'improved' | 'cortex' = cortexMode ? 'cortex' : improvedMode ? 'improved' : 'standard';
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  useEffect(() => { scrollToBottom(); }, [messages, loading]);

  useEffect(() => {
    fetch('/api/auth/session').then((r) => r.json()).then((d) => setSignedIn(!!d?.user)).catch(() => setSignedIn(false));
  }, []);

  // Load conversation from URL
  useEffect(() => {
    if (!chatIdFromUrl) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/chats/${chatIdFromUrl}`);
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        const msgs = (data.messages ?? []) as { role: string; content: string; runId?: string }[];
        setMessages(msgs.map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
          runId: m.runId,
        })));
        setConversationId(data.id);
      } catch {
        if (!cancelled) setConversationId(null);
      }
    })();
    return () => { cancelled = true; };
  }, [chatIdFromUrl]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const list = e.target.files;
    if (!list?.length) return;
    for (const f of Array.from(list)) {
      const form = new FormData();
      form.set('file', f);
      const res = await fetch('/api/upload', { method: 'POST', body: form });
      const data = await res.json();
      if (data.id) setUploads((prev) => [...prev, { id: data.id, name: data.name ?? f.name }]);
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
      if (pipelineMode === 'cortex') {
        const res = await fetch('/api/cortex/query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: toSend }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'CORTEX request failed');
        const newAssistant: ChatMessage = {
          role: 'assistant',
          content: data.answer ?? '',
          latencyMs: data.latency_ms,
          cortex: {
            confidence: data.confidence ?? 0,
            reliability: data.reliability ?? 'Medium',
            selected_model: data.selected_model ?? '',
            alternatives: Array.isArray(data.alternatives) ? data.alternatives : [],
          },
        };
        setMessages((prev) => [...prev, newAssistant]);
        const allMessages = [...messages, { role: 'user' as const, content: toSend }, newAssistant];
        const payload = {
          conversationId: conversationId ?? undefined,
          title: messages.length === 0 ? toSend.slice(0, 80) : undefined,
          messages: allMessages.map((m) => ({ role: m.role, content: m.content, runId: m.runId })),
        };
        try {
          const chatRes = await fetch('/api/chats', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          const chatData = await chatRes.json();
          if (chatData.id && !conversationId) {
            setConversationId(chatData.id);
            router.replace(`/?chat=${chatData.id}`, { scroll: false });
          }
        } catch (_) {}
        if (messages.length === 0) setUrls('');
        setUploads([]);
        setLoading(false);
        return;
      }

      const body: {
        inputText: string;
        urls?: string[];
        attachments?: { id: string; name: string }[];
        conversationHistory?: { role: string; content: string }[];
        improvedMode?: boolean;
      } = { inputText: toSend, improvedMode };

      if (messages.length === 0) {
        if (urls.trim()) body.urls = urls.split(/\s+/).map((u) => u.trim()).filter(Boolean);
        if (uploads.length) body.attachments = uploads;
      } else {
        body.conversationHistory = [...messages, { role: 'user', content: toSend }].map((m) => ({ role: m.role, content: m.content }));
        if (urls.trim()) body.urls = urls.split(/\s+/).map((u) => u.trim()).filter(Boolean);
        if (uploads.length) body.attachments = uploads;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3 * 60 * 1000); // 3 min for long runs
      const res = await fetch('/api/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : data?.error?.message || 'Request failed');

      const newAssistant: ChatMessage = {
        role: 'assistant',
        content: data.finalAnswer,
        runId: data.runId,
        reliability: data.reliability as Record<string, unknown>,
        latencyMs: data.latencyMs,
        runTrace: data.runTrace as Record<string, unknown> | undefined,
      };
      setMessages((prev) => [...prev, newAssistant]);

      // Persist conversation
      const allMessages = [...messages, { role: 'user' as const, content: toSend }, newAssistant];
      const payload = {
        conversationId: conversationId ?? undefined,
        title: messages.length === 0 ? toSend.slice(0, 80) : undefined,
        messages: allMessages.map((m) => ({
          role: m.role,
          content: m.content,
          runId: m.runId,
        })),
      };
      try {
        const chatRes = await fetch('/api/chats', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const chatData = await chatRes.json();
        if (chatData.id && !conversationId) {
          setConversationId(chatData.id);
          router.replace(`/?chat=${chatData.id}`, { scroll: false });
        }
      } catch (_) {}

      if (messages.length === 0) setUrls('');
      setUploads([]);
    } catch (e) {
      const message =
        e instanceof Error
          ? e.name === 'AbortError'
            ? 'Request took too long (over 3 minutes). Try a shorter question or check the server.'
            : e.message
          : 'Something went wrong';
      setError(message);
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setLoading(false);
    }
  }

  const isFirstTurn = messages.length === 0;

  return (
    <>
      <AnimatedBackground />
      <div className="relative flex flex-col h-[calc(100vh-3.5rem)] max-w-4xl mx-auto -mb-8 min-h-0 px-4">
        {/* Hero (first turn only) */}
        {isFirstTurn && !loading && (
          <motion.section
            className="flex-shrink-0 pt-8 pb-6"
            variants={container}
            initial="hidden"
            animate="show"
          >
            <div className="text-center">
              <motion.div variants={item} className="flex justify-center mb-4">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl overflow-hidden bg-white border border-slate-200/80 shadow-sm">
                  <Image src="/logo.png" alt="" width={56} height={56} className="object-contain p-1.5" aria-hidden />
                </div>
              </motion.div>
              <motion.p variants={item} className="mt-3 text-slate-600 max-w-md mx-auto text-sm leading-relaxed">
                Ask anything. Multiple models answer, we verify and pick the best. Attach docs or URLs for sourced answers.
              </motion.p>
              <motion.div variants={item} className="mt-5 flex flex-wrap justify-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/90 text-xs font-medium text-slate-600 shadow-sm border border-slate-200/60">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Verified answers
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/90 text-xs font-medium text-slate-600 shadow-sm border border-slate-200/60">
                  Full trace
                </span>
                <Link
                  href="/paper.pdf"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100/80 border border-emerald-200/60 transition-colors"
                >
                  <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                  Paper (PDF)
                </Link>
                {signedIn === false && (
                  <Link
                    href="/auth"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-amber-700 bg-amber-50 hover:bg-amber-100/80 border border-amber-200 transition-colors"
                  >
                    Not signed in — Sign in to save chats
                  </Link>
                )}
              </motion.div>
            </div>
          </motion.section>
        )}

        <section className="flex-1 flex flex-col min-h-0 min-w-0">
          <div className="flex-1 overflow-y-auto py-4 min-h-0 chat-scroll pb-6 overscroll-contain">
            <div className={`space-y-5 ${messages.length > 0 ? 'max-w-3xl mx-auto' : ''}`}>
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
                          ? 'bg-[var(--accent)] text-slate-900 shadow-sm border border-slate-200/60'
                          : 'bg-white border border-slate-200/80 shadow-sm'
                      }`}
                      whileHover={{ boxShadow: '0 4px 12px -2px rgba(0,0,0,0.08)' }}
                      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                    >
                      {m.role === 'assistant' ? (
                        <MarkdownContent content={m.content} />
                      ) : (
                        <div className="whitespace-pre-wrap text-[15px] leading-[1.6]">{m.content}</div>
                      )}
                      {m.role === 'assistant' && (m.runId || m.reliability || m.latencyMs != null || m.cortex) && (
                        <div className="mt-4 pt-4 border-t border-slate-100 space-y-3">
                          {m.cortex && (
                            <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-4 space-y-3">
                              <div className="flex items-center gap-2.5 flex-wrap">
                                <span className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold border bg-white border-slate-200 text-slate-700">
                                  Confidence: {Math.round((m.cortex.confidence ?? 0) * 100)}%
                                </span>
                                <span className={`inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold border ${
                                  m.cortex.reliability === 'High' ? 'bg-emerald-100 text-emerald-800 border-emerald-200' :
                                  m.cortex.reliability === 'Low' ? 'bg-amber-100 text-amber-800 border-amber-200' :
                                  'bg-slate-100 text-slate-700 border-slate-200'
                                }`}>
                                  Reliability: {m.cortex.reliability}
                                </span>
                                {m.cortex.selected_model && (
                                  <span className="text-xs text-slate-600 font-medium">Model: {m.cortex.selected_model}</span>
                                )}
                              </div>
                              {m.cortex.alternatives?.length > 0 && (
                                <details className="text-xs">
                                  <summary className="cursor-pointer text-slate-600 font-medium">Alternative model outputs</summary>
                                  <ul className="mt-2 space-y-2 pl-2 border-l-2 border-slate-200">
                                    {m.cortex.alternatives.map((alt, i) => (
                                      <li key={i}>
                                        <span className="font-medium text-slate-600">{alt.model}</span>
                                        {alt.latency_ms != null && <span className="text-slate-500 ml-1">({alt.latency_ms}ms)</span>}
                                        <p className="mt-0.5 text-slate-600 line-clamp-2">{alt.output}</p>
                                      </li>
                                    ))}
                                  </ul>
                                </details>
                              )}
                            </div>
                          )}
                          {m.reliability && typeof m.reliability === 'object' && (
                            <ReliabilityReport data={m.reliability as import('@/components/ReliabilityReport').ReliabilityData} />
                          )}
                          <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
                            {m.latencyMs != null && <span>{m.latencyMs}ms</span>}
                            {m.runId && (
                                <Link
                                href={`/runs/${m.runId}`}
                                className="text-teal-600 hover:text-teal-700 font-medium inline-flex items-center gap-1 transition-colors"
                              >
                                View trace
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                              </Link>
                            )}
                            {m.runTrace && (
                              <button
                                type="button"
                                onClick={() => {
                                  const blob = new Blob([JSON.stringify(m.runTrace, null, 2)], { type: 'application/json' });
                                  const a = document.createElement('a');
                                  a.href = URL.createObjectURL(blob);
                                  a.download = `run-trace-${(m.runTrace as { run_id?: string }).run_id ?? 'export'}.json`;
                                  a.click();
                                  URL.revokeObjectURL(a.href);
                                }}
                                className="text-teal-600 hover:text-teal-700 font-medium inline-flex items-center gap-1 transition-colors"
                              >
                                Research export
                              </button>
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
                    className="rounded-2xl bg-white border border-slate-200/80 px-5 py-4 shadow-sm inline-flex gap-2.5"
                    animate={{ opacity: [0.9, 1] }}
                    transition={{ repeat: Infinity, duration: 1, repeatType: 'reverse' }}
                  >
                    <motion.span className="w-2.5 h-2.5 rounded-full bg-teal-500" animate={{ y: [0, -4, 0] }} transition={{ repeat: Infinity, duration: 0.5 }} />
                    <motion.span className="w-2.5 h-2.5 rounded-full bg-teal-500" animate={{ y: [0, -4, 0] }} transition={{ repeat: Infinity, duration: 0.5, delay: 0.1 }} />
                    <motion.span className="w-2.5 h-2.5 rounded-full bg-teal-500" animate={{ y: [0, -4, 0] }} transition={{ repeat: Infinity, duration: 0.5, delay: 0.2 }} />
                  </motion.div>
                </motion.div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>

          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="flex-shrink-0 py-2"
              >
                <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <footer className="flex-shrink-0 pt-2 pb-6">
            {isFirstTurn ? (
              <div className="space-y-4">
                <label className="block">
                  <span className="sr-only">Your question</span>
                  <textarea
                    className="input-base resize-none min-h-[100px]"
                    placeholder="Ask anything..."
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
                    }}
                  />
                </label>
                <div className="flex flex-wrap gap-2.5 items-center">
                  <label className="flex-1 min-w-[200px]">
                    <span className="block text-xs font-medium text-slate-500 mb-1">Paste URLs here, one per line</span>
                    <textarea
                      className="input-base h-[40px] min-h-[40px] max-h-[40px] py-2 text-sm w-full resize-none overflow-y-auto"
                      placeholder="https://..."
                      value={urls}
                      onChange={(e) => setUrls(e.target.value)}
                      rows={1}
                    />
                  </label>
                  <input ref={fileInputRef} type="file" multiple accept=".txt,.pdf,.md,.json,.csv" className="hidden" onChange={handleUpload} />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="btn-secondary text-sm h-[40px] px-4 inline-flex items-center gap-2 shrink-0"
                  >
                    <svg className="w-4 h-4 shrink-0 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Attach files
                  </button>
                  {uploads.length > 0 && (
                    <span className="text-xs text-slate-500 font-medium self-center">{uploads.length} file(s)</span>
                  )}
                  <div
                    role="group"
                    aria-label="Pipeline mode"
                    className="inline-flex h-[40px] shrink-0 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] overflow-hidden"
                  >
                    <button
                      type="button"
                      onClick={() => { setImprovedMode(false); setCortexMode(false); }}
                      className={`h-full px-3 text-sm font-medium transition-colors ${
                        pipelineMode === 'standard'
                          ? 'bg-[var(--accent)] text-slate-800'
                          : 'text-slate-600 hover:bg-[var(--bg-subtle)] hover:text-slate-800'
                      }`}
                    >
                      Standard
                    </button>
                    <button
                      type="button"
                      onClick={() => { setImprovedMode(true); setCortexMode(false); }}
                      className={`h-full px-3 text-sm font-medium transition-colors ${
                        pipelineMode === 'improved'
                          ? 'bg-[var(--accent)] text-slate-800'
                          : 'text-slate-600 hover:bg-[var(--bg-subtle)] hover:text-slate-800'
                      }`}
                    >
                      Improved
                    </button>
                    <button
                      type="button"
                      onClick={() => { setImprovedMode(false); setCortexMode(true); }}
                      className={`h-full px-3 text-sm font-medium transition-colors ${
                        pipelineMode === 'cortex'
                          ? 'bg-[var(--accent)] text-slate-800'
                          : 'text-slate-600 hover:bg-[var(--bg-subtle)] hover:text-slate-800'
                      }`}
                    >
                      CORTEX
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={handleSend}
                    disabled={loading}
                    className="btn-primary h-[40px] px-5 shrink-0"
                  >
                    Run
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex gap-3 items-center">
                  <label className="flex-1">
                    <span className="sr-only">Follow up</span>
                    <input
                      type="text"
                      className="input-base w-full"
                      placeholder="Follow up..."
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
                      }}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={handleSend}
                    disabled={loading}
                    className="btn-primary px-6 shrink-0"
                  >
                    Send
                  </button>
                </div>
                <div className="flex flex-wrap gap-2.5 items-center">
                  <label className="flex-1 min-w-[160px]">
                    <span className="sr-only">URLs (optional)</span>
                    <input
                      type="text"
                      className="input-base h-[40px] py-2 text-sm w-full"
                      placeholder="Paste URLs (optional)"
                      value={urls}
                      onChange={(e) => setUrls(e.target.value)}
                    />
                  </label>
                  <input ref={fileInputRef} type="file" multiple accept=".txt,.pdf,.md,.json,.csv" className="hidden" onChange={handleUpload} />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="btn-secondary text-sm h-[40px] px-4 inline-flex items-center gap-2 shrink-0"
                  >
                    <svg className="w-4 h-4 shrink-0 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Attach files
                  </button>
                  {uploads.length > 0 && (
                    <span className="text-xs text-slate-500 font-medium">{uploads.length} file(s)</span>
                  )}
                  <div
                    role="group"
                    aria-label="Pipeline mode"
                    className="inline-flex h-[40px] shrink-0 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] overflow-hidden"
                  >
                    <button
                      type="button"
                      onClick={() => { setImprovedMode(false); setCortexMode(false); }}
                      className={`h-full px-3 text-sm font-medium transition-colors ${
                        pipelineMode === 'standard'
                          ? 'bg-[var(--accent)] text-slate-800'
                          : 'text-slate-600 hover:bg-[var(--bg-subtle)] hover:text-slate-800'
                      }`}
                    >
                      Standard
                    </button>
                    <button
                      type="button"
                      onClick={() => { setImprovedMode(true); setCortexMode(false); }}
                      className={`h-full px-3 text-sm font-medium transition-colors ${
                        pipelineMode === 'improved'
                          ? 'bg-[var(--accent)] text-slate-800'
                          : 'text-slate-600 hover:bg-[var(--bg-subtle)] hover:text-slate-800'
                      }`}
                    >
                      Improved
                    </button>
                    <button
                      type="button"
                      onClick={() => { setImprovedMode(false); setCortexMode(true); }}
                      className={`h-full px-3 text-sm font-medium transition-colors ${
                        pipelineMode === 'cortex'
                          ? 'bg-[var(--accent)] text-slate-800'
                          : 'text-slate-600 hover:bg-[var(--bg-subtle)] hover:text-slate-800'
                      }`}
                    >
                      CORTEX
                    </button>
                  </div>
                </div>
              </div>
            )}
          </footer>
        </section>
      </div>
    </>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={<div className="min-h-[60vh] flex items-center justify-center text-slate-500">Loading…</div>}>
      <HomePageContent />
    </Suspense>
  );
}
