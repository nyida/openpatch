'use client';

import { Bell, BellRing } from 'lucide-react';
import { useAlertsStore } from '@/stores/alertsStore';

export function AlertButton({
  type,
  label,
  marketTitle,
  spreadId,
  threshold,
}: {
  type: 'price' | 'whale' | 'arb';
  label: string;
  marketTitle?: string;
  spreadId?: string;
  threshold?: number;
}) {
  const addAlert = useAlertsStore((s) => s.addAlert);
  const hasMatch = useAlertsStore((s) =>
    s.alerts.some(
      (a) =>
        a.type === type &&
        a.marketTitle === marketTitle &&
        a.spreadId === spreadId &&
        a.threshold === threshold,
    ),
  );

  return (
    <button
      type="button"
      className="btn btn-ghost !p-1.5"
      onClick={() =>
        addAlert({ type, label, marketTitle, spreadId, threshold })
      }
      title={hasMatch ? 'Alert saved' : 'Add alert'}
      disabled={hasMatch}
    >
      {hasMatch ? (
        <BellRing className="w-3.5 h-3.5" style={{ color: 'var(--mint)' }} />
      ) : (
        <Bell className="w-3.5 h-3.5" style={{ color: 'var(--text-3)' }} />
      )}
    </button>
  );
}
