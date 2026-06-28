'use client';

import Link from 'next/link';
import { Shell, PageHeader } from '@/components/whale/Shell';
import { PaperPortfolio } from '@/components/whale/PaperPortfolio';
import { useState } from 'react';

export default function PortfolioToolPage() {
  const [open, setOpen] = useState(true);

  return (
    <Shell>
      <PageHeader
        title="Portfolio tracker"
        description="Track virtual positions via paper trading. Connect a wallet for live tracking — coming soon."
        action={
          <Link href="/" className="btn btn-ghost text-xs">
            Back to dashboard
          </Link>
        }
      />
      <p className="text-xs mb-4" style={{ color: 'var(--text-3)' }}>
        Paper portfolio persists in your browser. Open positions from any market row or detail page.
      </p>
      {open && <PaperPortfolio inline onClose={() => setOpen(false)} />}
      {!open && (
        <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}>
          Open portfolio
        </button>
      )}
    </Shell>
  );
}
