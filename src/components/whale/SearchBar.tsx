'use client';

import { useEffect, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { SectorNav } from '@/components/whale/Shell';
import { useAppStore } from '@/context/AppStore';
import { useUnifiedSearch } from '@/lib/whale/hooks';
import { fmtUsd, platformShort } from '@/lib/whale/utils';
import { PlatformTag } from '@/components/whale/PlatformTag';
import type { UnifiedMarket } from '@/services/types';
import { marketDetailPath } from '@/lib/whale/marketRoutes';

const VENUE_OPTIONS = [
  { id: 'all', label: 'All venues' },
  { id: 'polymarket', label: 'Polymarket' },
  { id: 'kalshi', label: 'Kalshi' },
];

function keepInputFocus(e: React.MouseEvent) {
  e.preventDefault();
}

export function SearchBar({ autoFocus, onClose }: { autoFocus?: boolean; onClose?: () => void } = {}) {
  const { setSearchResults } = useAppStore();
  const inputRef = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  const [venue, setVenue] = useState('all');
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(q.trim()), 300);
    return () => clearTimeout(id);
  }, [q]);

  const { data, isFetching, isError, isFetched } = useUnifiedSearch(
    debounced,
    venue,
    0,
    'all',
    debounced.length >= 2,
  );

  const results = data?.results ?? [];

  useEffect(() => {
    if (results.length) setSearchResults(results);
  }, [results, setSearchResults]);

  const showDropdown =
    focused && debounced.length >= 2 && (isFetching || isFetched);

  function selectResult(r: UnifiedMarket) {
    setFocused(false);
    setQ('');
    setDebounced('');
    window.location.assign(
      marketDetailPath(r.title, r.venue, {
        price: r.probability,
        volume: r.volume_24h ?? r.volume,
        event: r.event_title,
      }),
    );
  }

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  return (
    <div className="unified-search-wrap !border-0 !py-0 !px-0 !bg-transparent">
      <div className="unified-search-main">
        <div className="unified-search-bar surface">
          <Search className="w-4 h-4 shrink-0" style={{ color: 'var(--text-3)' }} aria-hidden />
          <input
            ref={inputRef}
            type="search"
            className="unified-search-input"
            placeholder="Search markets across Polymarket & Kalshi…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => {
              window.setTimeout(() => {
                if (document.activeElement !== inputRef.current) {
                  setFocused(false);
                }
              }, 150);
            }}
            aria-label="Cross-venue market search"
            aria-expanded={showDropdown}
            aria-controls="unified-search-results"
          />
          {onClose && (
            <button type="button" className="btn btn-ghost !p-1 shrink-0" onClick={onClose} aria-label="Close search">
              <span className="text-[10px]" style={{ color: 'var(--text-3)' }}>Esc</span>
            </button>
          )}
          {isFetching && <span className="text-[10px] font-mono shrink-0" style={{ color: 'var(--text-3)' }}>…</span>}
        </div>

        {showDropdown && (
          <div
            id="unified-search-results"
            className="unified-search-dropdown surface"
            role="listbox"
            onMouseDown={keepInputFocus}
          >
            {isError && (
              <p className="text-xs p-3" style={{ color: 'var(--rose)' }}>
                Search failed. Try again.
              </p>
            )}
            {!isError && isFetched && !isFetching && results.length === 0 && (
              <p className="text-xs p-3" style={{ color: 'var(--text-3)' }}>No markets match.</p>
            )}
            {results.map((r) => (
              <button
                key={r.id}
                type="button"
                className="unified-search-result w-full text-left"
                role="option"
                onClick={() => selectResult(r)}
              >
                {r.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.image} alt="" className="w-6 h-6 rounded object-cover shrink-0" />
                ) : (
                  <PlatformTag platform={r.venue} />
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-[12px] leading-snug truncate">{r.title}</div>
                  {r.event_title && (
                    <div className="text-[10px] opacity-50 truncate">{r.event_title}</div>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <div className="font-mono tabular-nums text-[11px]">
                    {(r.probability * 100).toFixed(1)}%
                  </div>
                  <div className="font-mono tabular-nums text-[10px] opacity-50">
                    {fmtUsd(r.volume_24h ?? r.volume)} vol
                  </div>
                </div>
                <span className="text-[9px] opacity-40 uppercase">{platformShort(r.venue)}</span>
              </button>
            ))}
            {results.length > 0 && (
              <p className="text-[9px] opacity-40 px-3 py-2 border-t border-white/5">
                Live Gamma + Kalshi APIs · click to open contract
              </p>
            )}
          </div>
        )}
      </div>

      <div className="unified-search-venue-nav" onMouseDown={keepInputFocus}>
        <SectorNav
          layoutId="search-venue-nav"
          aria-label="Venue filter"
          value={venue}
          onChange={setVenue}
          options={VENUE_OPTIONS}
          className="!mb-0 !p-0 !bg-transparent"
        />
      </div>
    </div>
  );
}
