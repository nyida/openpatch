'use client';

import { useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { LiveRefreshNote } from '@/components/whale/LiveRefreshNote';
import { PaperPortfolio } from '@/components/whale/PaperPortfolio';
import { DataStatusLine } from '@/components/whale/Shell';
import { useScrapeStatus } from '@/lib/whale/useScrapeStatus';
import { useAppStore } from '@/context/AppStore';
import { useWebSocket } from '@/hooks/useWebSocket';
import { fmtUsd } from '@/lib/whale/utils';
import { authFetch } from '@/lib/auth/client';

export function DataFeedBar() {
  const { status, lastFetch, error, refresh, isLoading } = useScrapeStatus();
  const { portfolio } = useAppStore();
  const { live: wsLive } = useWebSocket();
  const bootstrapped = useRef(false);
  const [paperOpen, setPaperOpen] = useState(false);

  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;
    authFetch('/api/bootstrap', { cache: 'no-store' }).catch(() => {});
  }, []);

  if (!status) {
    return (
      <div className="data-feed-bar" role="status">
        <div className="shell !py-0 !max-w-[1280px]">
          <div className="data-feed-inner data-status">
            {error ? (
              <>
                <DataStatusLine label="Data feeds" stale>
                  {error}
                </DataStatusLine>
                <button
                  type="button"
                  className="btn btn-ghost text-[10px] !py-1"
                  onClick={() => refresh()}
                  disabled={isLoading}
                >
                  <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
                  Retry
                </button>
              </>
            ) : (
              <DataStatusLine label="Data feeds">Connecting to whale database…</DataStatusLine>
            )}
          </div>
        </div>
      </div>
    );
  }

  const holdingsLabel = status.scrape_in_progress
    ? `Rebuilding ${status.trader_count}/${status.whale_target} · ${status.contract_count.toLocaleString()} contracts`
    : `${status.trader_count} whales · ${status.position_count.toLocaleString()} positions · ${status.contract_count.toLocaleString()} contracts`;

  const liveParts = [`${status.live_trade_count.toLocaleString()} large fills`];
  if (status.live_polymarket_trades > 0) {
    liveParts.push(`Poly ${status.live_polymarket_trades.toLocaleString()}`);
  }
  if (status.live_kalshi_trades > 0) {
    liveParts.push(`Kalshi ${status.live_kalshi_trades.toLocaleString()}`);
  }

  return (
    <div className="data-feed-bar" role="status" aria-live="polite">
      <div className="shell !py-0 !max-w-[1280px]">
        <div className="data-feed-inner data-status">
          <DataStatusLine label="Holdings">{holdingsLabel}</DataStatusLine>
          <DataStatusLine label="Live">{liveParts.join(' · ')}</DataStatusLine>
          <DataStatusLine label="Traders">
            {status.all_trader_count.toLocaleString()} ranked
          </DataStatusLine>
          <div className="data-feed-trail">
            {lastFetch && !wsLive && <LiveRefreshNote lastFetch={lastFetch} label="Synced" />}
            {wsLive && (
              <span className="data-status-line" style={{ color: 'var(--mint)' }}>
                WS live
              </span>
            )}
            <button
              type="button"
              className="data-status-line hover:opacity-80 transition-opacity text-left"
              onClick={() => setPaperOpen(true)}
              title="Open paper trading portfolio"
            >
              <span className="data-status-label">Paper</span> {fmtUsd(portfolio.cash)}
            </button>
          </div>
        </div>
      </div>
      {paperOpen && <PaperPortfolio onClose={() => setPaperOpen(false)} />}
    </div>
  );
}
