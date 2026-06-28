'use client';

import { Suspense, useMemo } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Shell, PageHeader } from '@/components/whale/Shell';
import { marketDetailPath } from '@/lib/whale/marketRoutes';
import { useWorkspaceStore } from '@/stores/workspaceStore';

function WorkspaceContent() {
  const params = useParams();
  const id = typeof params.id === 'string' ? params.id : '';
  const workspace = useWorkspaceStore((s) => s.getWorkspace(id));

  const shareUrl = useMemo(() => {
    if (typeof window === 'undefined') return '';
    return `${window.location.origin}/workspace/${id}`;
  }, [id]);

  if (!workspace) {
    return (
      <Shell>
        <div className="empty surface">
          <span className="empty-title">Workspace not found</span>
          <span className="empty-hint">This analysis link may have expired or was created on another device</span>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <PageHeader
        title={workspace.name}
        description={`${workspace.markets.length} markets · shared analysis`}
        action={
          <button
            type="button"
            className="btn btn-ghost text-xs"
            onClick={() => void navigator.clipboard?.writeText(shareUrl)}
          >
            Copy link
          </button>
        }
      />
      <div className="surface divide-y" style={{ borderColor: 'var(--line)' }}>
        {workspace.markets.map((m) => (
          <Link
            key={`${m.platform}-${m.title}`}
            href={marketDetailPath(m.title, m.platform)}
            className="block px-4 py-3 hover:bg-white/[0.03] transition-colors"
          >
            <p className="text-sm font-medium">{m.title}</p>
            <p className="text-[10px] mt-0.5 uppercase" style={{ color: 'var(--text-3)' }}>{m.platform}</p>
            {m.note && <p className="text-xs mt-1" style={{ color: 'var(--text-2)' }}>{m.note}</p>}
          </Link>
        ))}
      </div>
    </Shell>
  );
}

export default function WorkspacePage() {
  return (
    <Suspense>
      <WorkspaceContent />
    </Suspense>
  );
}
