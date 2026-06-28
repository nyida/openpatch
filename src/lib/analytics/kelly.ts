export type KellyInput = {
  /** Your estimated true probability (0–1). */
  trueProb: number;
  /** Market price / implied probability (0–1). */
  marketOdds: number;
  /** Available bankroll in USD. */
  bankroll: number;
  /** Fractional Kelly (0.25 = quarter Kelly, safer). */
  fraction?: number;
};

export type KellyResult = {
  edge: number;
  evPerDollar: number;
  fullKellyFraction: number;
  recommendedFraction: number;
  betSize: number;
  expectedValue: number;
  side: 'YES' | 'NO' | 'NONE';
};

/** Kelly criterion for binary prediction markets. */
export function calculateKelly(input: KellyInput): KellyResult {
  const p = Math.min(0.999, Math.max(0.001, input.trueProb));
  const q = 1 - p;
  const m = Math.min(0.999, Math.max(0.001, input.marketOdds));
  const fraction = input.fraction ?? 0.25;

  const yesEv = p * (1 - m) - q * m;
  const noEv = q * m - p * (1 - m);

  let side: 'YES' | 'NO' | 'NONE' = 'NONE';
  let edge = 0;
  let fullKelly = 0;

  if (yesEv > noEv && yesEv > 0) {
    side = 'YES';
    edge = p - m;
    fullKelly = edge / (1 - m);
  } else if (noEv > 0) {
    side = 'NO';
    edge = m - p;
    fullKelly = edge / m;
  }

  fullKelly = Math.max(0, Math.min(1, fullKelly));
  const recommended = fullKelly * fraction;
  const betSize = Math.round(input.bankroll * recommended * 100) / 100;
  const evPerDollar = side === 'YES' ? yesEv : side === 'NO' ? noEv : 0;

  return {
    edge,
    evPerDollar,
    fullKellyFraction: fullKelly,
    recommendedFraction: recommended,
    betSize,
    expectedValue: betSize * evPerDollar,
    side,
  };
}
