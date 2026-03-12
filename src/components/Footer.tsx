import Link from 'next/link';

export function Footer() {
  return (
    <footer className="flex-shrink-0 border-t border-[var(--border)] bg-[var(--bg-surface)] mt-12">
      <div className="container mx-auto max-w-6xl px-4 py-6">
        <div className="flex flex-wrap items-center justify-between gap-6 text-[13px]">
          <div className="flex items-center gap-4">
            <span className="font-serif font-semibold text-[var(--text-secondary)]">OpenPatch</span>
            <span className="badge text-[var(--text-muted)] bg-[var(--bg-subtle)] rounded-none">v1</span>
            <a
              href="/paper.pdf"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--accent-muted)] hover:text-[var(--accent)] font-medium transition-colors"
              title="Open: A Verification-First Architecture for Reliable Language Model Outputs"
            >
              Technical Report (PDF)
            </a>
          </div>
          <nav className="flex items-center gap-6" aria-label="Footer">
            <Link href="/research" className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
              Methodology
            </Link>
            <Link href="/runs" className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
              Traces
            </Link>
            <Link href="/settings" className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
              Settings
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
