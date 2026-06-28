'use client';

import { RefreshCw } from 'lucide-react';

export function DbStatusBanner({
  error,
  onRetry,
  loading,
}: {
  error: string | null;
  onRetry?: () => void;
  loading?: boolean;
}) {
  if (!error) return null;

  return (
    <div className="error-banner" role="alert">
      <div className="flex-1 min-w-0">
        <p className="font-medium mb-1">Whale database unavailable</p>
        <p className="opacity-90">{error}</p>
        <p className="mt-2 opacity-75">
          Add{' '}
          <code className="text-[10px] px-1 py-0.5 rounded" style={{ background: 'rgba(0,0,0,0.2)' }}>
            WHALE_DB_PATH=/path/to/whale_data.db
          </code>{' '}
          to <code className="text-[10px]">.env.local</code>, or run{' '}
          <code className="text-[10px]">npm run scrape:ensure</code>
        </p>
      </div>
      {onRetry && (
        <button
          type="button"
          className="btn btn-ghost shrink-0"
          onClick={() => onRetry()}
          disabled={loading}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Retry
        </button>
      )}
    </div>
  );
}
