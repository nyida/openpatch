'use client';

import type { ArbitrageSpread } from '@/services/types';
import { NetROIBadge } from '@/components/whale/NetROIBadge';
import { marketDetailPath } from '@/lib/whale/marketRoutes';
import { platformExternalUrl, resolveExternalUrl } from '@/lib/whale/marketUrls';
import { formatNetROI, netROITooltip } from '@/utils/arbMath';

export function NetProfitCell({ spread }: { spread: ArbitrageSpread }) {
  return (
    <span title={netROITooltip()}>
      <NetROIBadge spread={spread} />
    </span>
  );
}

export function ArbitrageRow({ spread }: { spread: ArbitrageSpread }) {
  return (
    <tr>
      <td className="whitespace-nowrap">
        <span className="cat-tag">Arb</span>
      </td>
      <td className="col-market">
        <a
          href={marketDetailPath(spread.poly_title, 'polymarket', {
            price: spread.poly_price,
          })}
          className="block hover:underline"
        >
          <div className="market-title leading-snug">{spread.poly_title}</div>
          <div className="text-[10px] mt-0.5 opacity-50">↔ {spread.kalshi_title}</div>
        </a>
      </td>
      <td className="text-right font-mono tabular-nums">{(spread.poly_price * 100).toFixed(1)}%</td>
      <td className="text-right font-mono tabular-nums">{(spread.kalshi_price * 100).toFixed(1)}%</td>
      <td className="text-right">
        <NetROIBadge spread={spread} />
      </td>
      <td className="text-right">
        <span
          className="font-mono tabular-nums text-[10px]"
          style={{
            color:
              spread.roi.tier === 'green'
                ? 'var(--mint)'
                : spread.roi.tier === 'yellow'
                  ? '#eab308'
                  : 'var(--rose)',
          }}
          title={formatNetROI(spread.roi)}
        >
          {spread.net_profit_cents >= 0 ? '+' : ''}
          {spread.net_profit_cents.toFixed(1)}¢
        </span>
      </td>
      <td className="text-right whitespace-nowrap">
        <a
          href={spread.poly_url || platformExternalUrl('polymarket', { title: spread.poly_title })}
          target="_blank"
          rel="noreferrer"
          className="btn btn-ghost text-[10px] !py-0.5"
        >
          Poly
        </a>
        <a
          href={resolveExternalUrl('kalshi', spread.kalshi_title, spread.kalshi_url)}
          target="_blank"
          rel="noreferrer"
          className="btn btn-ghost text-[10px] !py-0.5"
        >
          Kalshi
        </a>
      </td>
    </tr>
  );
}
