'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { calculateKelly, type KellyInput } from '@/lib/analytics/kelly';
import { fmtUsd } from '@/lib/whale/utils';

export function KellyCalculator({
  defaultMarketOdds = 0.5,
  defaultBankroll = 10000,
}: {
  defaultMarketOdds?: number;
  defaultBankroll?: number;
}) {
  const oddsPct = Math.round(defaultMarketOdds * 1000) / 10;
  return <KellyForm initialOdds={oddsPct} initialBankroll={defaultBankroll} />;
}

function KellyForm({
  initialOdds,
  initialBankroll,
}: {
  initialOdds: number;
  initialBankroll: number;
}) {
  const [trueProbPct, setTrueProbPct] = useState(initialOdds);
  const [marketOddsPct, setMarketOddsPct] = useState(initialOdds);
  const [bankroll, setBankroll] = useState(initialBankroll);
  const [kellyFraction, setKellyFraction] = useState(25);

  const result = useMemo(() => {
    const input: KellyInput = {
      trueProb: trueProbPct / 100,
      marketOdds: marketOddsPct / 100,
      bankroll,
      fraction: kellyFraction / 100,
    };
    return calculateKelly(input);
  }, [trueProbPct, marketOddsPct, bankroll, kellyFraction]);

  return (
    <div className="kelly-calculator surface p-4">
      <p className="text-[10px] uppercase tracking-wider mb-3" style={{ color: 'var(--text-3)' }}>
        Kelly position sizing
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
        <label className="kelly-field">
          <span>Your probability (%)</span>
          <input
            type="number"
            className="input w-full"
            value={trueProbPct}
            min={0.1}
            max={99.9}
            step={0.1}
            onChange={(e) => setTrueProbPct(Number(e.target.value))}
          />
        </label>
        <label className="kelly-field">
          <span>Market odds (%)</span>
          <input
            type="number"
            className="input w-full"
            value={marketOddsPct}
            min={0.1}
            max={99.9}
            step={0.1}
            onChange={(e) => setMarketOddsPct(Number(e.target.value))}
          />
        </label>
        <label className="kelly-field">
          <span>Bankroll ($)</span>
          <input
            type="number"
            className="input w-full"
            value={bankroll}
            min={100}
            step={100}
            onChange={(e) => setBankroll(Number(e.target.value))}
          />
        </label>
        <label className="kelly-field">
          <span>Kelly fraction ({kellyFraction}%)</span>
          <input
            type="range"
            min={5}
            max={100}
            step={5}
            value={kellyFraction}
            onChange={(e) => setKellyFraction(Number(e.target.value))}
            className="w-full"
          />
        </label>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="stat-pill">
          <span className="data-status-label">Side</span>
          <span className="stat-value">{result.side}</span>
        </div>
        <div className="stat-pill">
          <span className="data-status-label">Bet size</span>
          <span className="stat-value stat-value--mint">{fmtUsd(result.betSize)}</span>
        </div>
        <div className="stat-pill">
          <span className="data-status-label">Edge</span>
          <span className="stat-value">{(result.edge * 100).toFixed(1)} pp</span>
        </div>
        <div className="stat-pill">
          <span className="data-status-label">EV</span>
          <span
            className="stat-value"
            style={{ color: result.expectedValue >= 0 ? 'var(--mint)' : 'var(--rose)' }}
          >
            {result.expectedValue >= 0 ? '+' : ''}
            {fmtUsd(result.expectedValue)}
          </span>
        </div>
      </div>
      <p className="text-[10px] mt-3" style={{ color: 'var(--text-3)' }}>
        Full Kelly: {(result.fullKellyFraction * 100).toFixed(1)}% · Recommended{' '}
        {(result.recommendedFraction * 100).toFixed(1)}% · EV/$1: {result.evPerDollar.toFixed(3)}
      </p>
      <Link href="/tools/kelly" className="text-[10px] mt-2 inline-block underline" style={{ color: 'var(--text-3)' }}>
        Open full calculator →
      </Link>
    </div>
  );
}
