export type NetROIResult = {
  grossSpreadCents: number;
  kalshiFeeCents: number;
  polyFeeCents: number;
  gasCents: number;
  netCents: number;
  roiPercent: number;
  tier: 'green' | 'yellow' | 'red';
  direction: 'buy_poly' | 'buy_kalshi' | 'neutral';
};

export const KALSHI_TAKER_FEE = 0.015;
export const POLY_TAKER_FEE = 0.01;
export const GAS_CENTS = 0.75;

export function calculateNetROI(kalshiPrice: number, polyPrice: number): NetROIResult {
  const spread = polyPrice - kalshiPrice;
  const grossSpreadCents = Math.abs(spread) * 100;
  const kalshiFeeCents = kalshiPrice * KALSHI_TAKER_FEE * 100;
  const polyFeeCents = polyPrice * POLY_TAKER_FEE * 100;
  const netCents = grossSpreadCents - kalshiFeeCents - polyFeeCents - GAS_CENTS;

  const deployCents = Math.min(polyPrice, kalshiPrice) * 100 || 1;
  const roiPercent = (netCents / deployCents) * 100;

  let tier: NetROIResult['tier'] = 'red';
  if (netCents > 1) tier = 'green';
  else if (netCents >= 0) tier = 'yellow';

  const direction =
    spread > 0.005 ? 'buy_kalshi' : spread < -0.005 ? 'buy_poly' : 'neutral';

  return {
    grossSpreadCents,
    kalshiFeeCents,
    polyFeeCents,
    gasCents: GAS_CENTS,
    netCents,
    roiPercent,
    tier,
    direction,
  };
}

export function netROITooltip(): string {
  return 'After 1.5% Kalshi fee + 1% Poly fee + $0.75 gas estimate.';
}

export function formatNetProfitCents(r: NetROIResult): string {
  const sign = r.netCents >= 0 ? '+' : '';
  return `${sign}${r.netCents.toFixed(1)}¢`;
}

/** @deprecated Use formatNetProfitCents - ROI percentage removed from UI */
export function formatNetROI(r: NetROIResult): string {
  return formatNetProfitCents(r);
}
