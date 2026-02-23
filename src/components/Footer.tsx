import Link from 'next/link';

export function Footer() {
  return (
    <footer className="mt-auto border-t border-slate-200/90 bg-white/80">
      <div className="container mx-auto max-w-6xl px-4 py-6">
        <div className="flex flex-wrap items-center justify-between gap-6 text-[13px]">
          <div className="flex items-center gap-4">
            <span className="font-semibold text-slate-700">OpenPatch</span>
            <span className="badge text-slate-500 bg-slate-100/90">v1</span>
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
          <nav className="flex items-center gap-6" aria-label="Footer">
            <Link href="/research" className="text-slate-500 hover:text-slate-800 transition-colors">
              Research
            </Link>
            <Link href="/runs" className="text-slate-500 hover:text-slate-800 transition-colors">
              Runs
            </Link>
            <Link href="/evals" className="text-slate-500 hover:text-slate-800 transition-colors">
              Evals
            </Link>
            <Link href="/settings" className="text-slate-500 hover:text-slate-800 transition-colors">
              Settings
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
