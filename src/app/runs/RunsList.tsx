'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';

type RunItem = {
  id: string;
  createdAt: Date | string;
  inputText: string;
  taskType: string;
  versionTag: string | null;
  latencyMs: number | null;
  reliability: unknown;
};

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.04, delayChildren: 0.08 },
  },
};

const item = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0 },
};

export function RunsList({ runs }: { runs: RunItem[] }) {
  if (runs.length === 0) {
    return (
      <motion.div
        className="rounded-none border-2 border-dashed border-slate-200/90 bg-slate-50/50 py-24 text-center"
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
      >
        <p className="text-slate-600 text-[15px] font-medium">No runs yet.</p>
        <p className="text-slate-500 text-sm mt-1">Start a chat to create one.</p>
      </motion.div>
    );
  }

  return (
    <motion.div className="space-y-3" variants={container} initial="hidden" animate="show">
      {runs.map((run) => {
        const rel = run.reliability as { overallConfidence?: string } | null;
        const confidence = rel?.overallConfidence ?? '—';
        const createdAt = typeof run.createdAt === 'string' ? run.createdAt : run.createdAt.toISOString();
        return (
          <motion.div key={run.id} variants={item}>
            <Link
              href={`/runs/${run.id}`}
              className="block rounded-none border border-slate-200/90 bg-white p-5 transition-all duration-200 hover:border-slate-300 hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/30 focus-visible:ring-offset-2"
            >
              <p className="text-slate-800 line-clamp-2 leading-snug text-[15px]">
                {run.inputText.slice(0, 220)}
                {run.inputText.length > 220 && '…'}
              </p>
              <div className="mt-3.5 flex flex-wrap items-center gap-2.5 text-xs text-slate-500">
                <span className="px-2.5 py-1 rounded bg-slate-100/90 text-slate-600 font-medium">
                  {run.taskType}
                </span>
                <span>{run.versionTag ?? '—'}</span>
                {run.latencyMs != null && <span>{run.latencyMs}ms</span>}
                <span className="capitalize text-slate-600 font-medium">{confidence}</span>
              </div>
              <p className="mt-2 text-xs text-slate-400">
                {createdAt.slice(0, 19).replace('T', ' ')}
              </p>
            </Link>
          </motion.div>
        );
      })}
    </motion.div>
  );
}
