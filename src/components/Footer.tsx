import Link from 'next/link';

export function Footer() {
  return (
    <footer className="mt-auto border-t border-slate-200/80 bg-slate-50/50">
      <div className="container mx-auto max-w-6xl px-4 py-5">
        <div className="flex flex-wrap items-center justify-between gap-4 text-sm text-slate-500">
          <div className="flex items-center gap-3">
            <span className="font-medium text-slate-600">OpenPatch</span>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 bg-slate-200/60 px-1.5 py-0.5 rounded">
              v1
            </span>
            <a
              href="/paper.pdf"
              target="_blank"
              rel="noopener noreferrer"
              className="text-teal-600 hover:text-teal-700 font-medium transition-colors"
              title="Open: A Verification-First Architecture for Reliable Language Model Outputs"
            >
              Paper (PDF)
            </a>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/research" className="text-slate-500 hover:text-slate-700 transition-colors">
              Research
            </Link>
            <Link href="/runs" className="text-slate-500 hover:text-slate-700 transition-colors">
              Runs
            </Link>
            <Link href="/evals" className="text-slate-500 hover:text-slate-700 transition-colors">
              Evals
            </Link>
            <Link href="/settings" className="text-slate-500 hover:text-slate-700 transition-colors">
              Settings
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
