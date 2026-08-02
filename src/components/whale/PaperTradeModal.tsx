'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { useAppStore } from '@/context/AppStore';
import { fmtUsd } from '@/lib/whale/utils';

type PaperTradeModalProps = {
  open: boolean;
  onClose: () => void;
  marketTitle: string;
  venue: 'polymarket' | 'kalshi';
  price: number;
  externalUrl: string;
  direction?: 'buy_poly' | 'buy_kalshi';
};

export function PaperTradeModal({
  open,
  onClose,
  marketTitle,
  venue,
  price,
  externalUrl,
  direction,
}: PaperTradeModalProps) {
  const { portfolio, openPaperTrade } = useAppStore();
  const [sizeUsd, setSizeUsd] = useState(100);
  const [side, setSide] = useState<'YES' | 'NO'>(direction === 'buy_kalshi' ? 'YES' : 'YES');
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  function submit() {
    setError(null);
    const ok = openPaperTrade({
      market_title: marketTitle,
      venue: direction === 'buy_kalshi' ? 'kalshi' : direction === 'buy_poly' ? 'polymarket' : venue,
      side,
      entry_price: price,
      size_usd: sizeUsd,
      external_url: externalUrl,
    });
    if (!ok) {
      setError(`Insufficient cash (${fmtUsd(portfolio.cash)} available)`);
      return;
    }
    onClose();
  }

  const buyLabel =
    direction === 'buy_kalshi'
      ? 'Buy YES @ Kalshi'
      : direction === 'buy_poly'
        ? 'Buy YES @ Polymarket'
        : `Buy ${side} @ ${venue === 'kalshi' ? 'Kalshi' : 'Polymarket'}`;

  return (
    <div className="paper-modal-backdrop" onClick={onClose} role="presentation">
      <div className="paper-modal surface" onClick={(e) => e.stopPropagation()} role="dialog">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div>
            <p className="text-[10px] uppercase tracking-wider opacity-50">Paper trade</p>
            <h3 className="text-sm font-medium leading-snug mt-0.5">{marketTitle}</h3>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs opacity-60 mb-3">
          {buyLabel} · Entry {(price * 100).toFixed(1)}¢ · Cash {fmtUsd(portfolio.cash)}
        </p>

        <div className="flex gap-2 mb-3">
          <button
            type="button"
            className="btn btn-ghost text-xs flex-1"
            data-active={side === 'YES'}
            onClick={() => setSide('YES')}
          >
            YES
          </button>
          <button
            type="button"
            className="btn btn-ghost text-xs flex-1"
            data-active={side === 'NO'}
            onClick={() => setSide('NO')}
          >
            NO
          </button>
        </div>

        <label className="block text-[10px] uppercase opacity-50 mb-1">Size (USD)</label>
        <input
          type="number"
          className="paper-input w-full mb-3"
          value={sizeUsd}
          min={10}
          max={portfolio.cash}
          step={10}
          onChange={(e) => setSizeUsd(Number(e.target.value))}
        />

        {error && (
          <p className="text-xs mb-2" style={{ color: 'var(--rose)' }}>
            {error}
          </p>
        )}

        <button type="button" className="btn btn-primary w-full text-xs" onClick={submit}>
          {buyLabel} - {fmtUsd(sizeUsd)}
        </button>
      </div>
    </div>
  );
}
