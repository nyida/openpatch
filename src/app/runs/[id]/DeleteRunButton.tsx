'use client';

import { useRouter } from 'next/navigation';

export function DeleteRunButton({ runId }: { runId: string }) {
  const router = useRouter();
  async function handleDelete() {
    if (!confirm('Delete this run?')) return;
    await fetch(`/api/runs/${runId}`, { method: 'DELETE' });
    router.push('/runs');
    router.refresh();
  }
  return (
    <button
      type="button"
      onClick={handleDelete}
      className="text-sm text-slate-500 hover:text-red-600 transition"
    >
      Delete
    </button>
  );
}
