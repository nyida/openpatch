'use client';

import { useAlertsStore } from '@/stores/alertsStore';
import { Shell, PageHeader } from '@/components/whale/Shell';
import { fmtRelativeTime } from '@/lib/whale/utils';

export function AlertsPanel() {
  const alerts = useAlertsStore((s) => s.alerts);
  const removeAlert = useAlertsStore((s) => s.removeAlert);
  const markAllRead = useAlertsStore((s) => s.markAllRead);

  return (
    <Shell>
      <PageHeader
        title="Alerts"
        description="In-app alerts for price moves, whale trades, and arbitrage opportunities."
        action={
          alerts.length > 0 ? (
            <button type="button" className="btn btn-ghost text-xs" onClick={markAllRead}>
              Mark all read
            </button>
          ) : null
        }
      />

      {alerts.length === 0 ? (
        <div className="empty surface">
          <span className="empty-title">No alerts yet</span>
          <span className="empty-hint">Use the bell icon on arbs or markets to add alerts</span>
        </div>
      ) : (
        <div className="surface divide-y" style={{ borderColor: 'var(--line)' }}>
          {alerts.map((a) => (
            <div
              key={a.id}
              className="flex items-start justify-between gap-3 px-4 py-3"
              style={{ opacity: a.read ? 0.65 : 1 }}
            >
              <div className="min-w-0">
                <p className="text-xs font-medium">{a.label}</p>
                {a.marketTitle && (
                  <p className="text-[11px] truncate mt-0.5" style={{ color: 'var(--text-3)' }}>
                    {a.marketTitle}
                  </p>
                )}
                <p className="text-[10px] mt-1" style={{ color: 'var(--text-3)' }}>
                  {a.type.toUpperCase()} · {fmtRelativeTime(Math.floor(a.createdAt / 1000))}
                  {a.triggeredAt ? ' · triggered' : ''}
                </p>
              </div>
              <button
                type="button"
                className="btn btn-ghost text-[10px] shrink-0"
                onClick={() => removeAlert(a.id)}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </Shell>
  );
}
