'use client';

import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';

const sections = [
  { id: 'abstract', title: 'Abstract' },
  { id: 'introduction', title: '1. Introduction' },
  { id: 'pipeline', title: '2. Pipeline Architecture' },
  { id: 'routing', title: '3. Task Classification' },
  { id: 'retrieval', title: '4. Retrieval & RAG' },
  { id: 'generation', title: '5. Multi-Candidate Generation' },
  { id: 'verification', title: '6. Verification Layer' },
  { id: 'judge', title: '7. Judge & Selection' },
  { id: 'reliability', title: '8. Reliability Report' },
  { id: 'eval', title: '9. Evaluation Harness' },
  { id: 'references', title: 'References & Further Reading' },
];

export function ResearchHeader() {
  return (
    <>
      <motion.header
        className="mb-16 pt-4"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.25, 0.46, 0.45, 0.94] }}
      >
        <div className="flex items-center gap-3 mb-4">
          <Image src="/logo.png" alt="" width={40} height={40} className="object-contain" aria-hidden />
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
            Technical Report
          </p>
        </div>
        <h1 className="font-serif text-4xl font-semibold text-slate-900 tracking-tight leading-tight">
          OpenPatch: Methodology &amp; Research
        </h1>
        <p className="mt-4 text-lg text-slate-600 leading-relaxed max-w-2xl">
          A system for higher correctness in language-model outputs via multi-model orchestration,
          programmatic and model-based verification, and structured reliability reporting. The
          accompanying paper presents this architecture under the name <em>Open</em>.
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 bg-slate-100 px-2 py-1 rounded">v1</span>
          <a
            href="/paper.pdf"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-teal-700 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
            title="Open: A Verification-First Architecture for Reliable Language Model Outputs"
          >
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Download paper (PDF)
          </a>
        </div>
        <p className="mt-2 text-sm text-slate-500 max-w-2xl">
          <em>Open: A Verification-First Architecture for Reliable Language Model Outputs</em> — OpenPatch Research Team
        </p>
      </motion.header>

      <motion.nav
        className="mb-16 pb-8 border-b border-slate-200/90"
        aria-label="On this page"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.4 }}
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400 mb-4">
          Contents
        </p>
        <ul className="space-y-2.5 text-sm">
          {sections.map(({ id, title }) => (
            <li key={id}>
              <Link
                href={`#${id}`}
                className="text-slate-600 hover:text-teal-700 transition-colors border-b border-transparent hover:border-teal-200"
              >
                {title}
              </Link>
            </li>
          ))}
        </ul>
      </motion.nav>
    </>
  );
}
