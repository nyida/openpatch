export type RiskGrade = 'A' | 'B' | 'C' | 'D' | 'F';

export type MarketRiskInput = {
  volume?: number;
  volume_24h?: number;
  probability?: number;
  days_to_resolution?: number | null;
  change_1d?: number | null;
  whale_count?: number;
};

export type MarketRiskResult = {
  grade: RiskGrade;
  score: number;
  label: string;
  factors: string[];
};

function gradeFromScore(score: number): RiskGrade {
  if (score >= 85) return 'A';
  if (score >= 70) return 'B';
  if (score >= 55) return 'C';
  if (score >= 40) return 'D';
  return 'F';
}

/** Score market risk A–F from liquidity, time, volatility, and depth. */
export function scoreMarketRisk(input: MarketRiskInput): MarketRiskResult {
  const factors: string[] = [];
  let score = 50;

  const vol = input.volume_24h ?? input.volume ?? 0;
  if (vol >= 1_000_000) {
    score += 25;
    factors.push('High liquidity');
  } else if (vol >= 100_000) {
    score += 15;
    factors.push('Good liquidity');
  } else if (vol >= 10_000) {
    score += 5;
  } else {
    score -= 15;
    factors.push('Low liquidity');
  }

  const days = input.days_to_resolution;
  if (days != null) {
    if (days <= 7) {
      score -= 10;
      factors.push('Resolves soon');
    } else if (days <= 30) {
      score += 5;
    } else if (days > 180) {
      score -= 8;
      factors.push('Long-dated');
    } else {
      score += 10;
      factors.push('Clear timeline');
    }
  }

  const change = Math.abs(input.change_1d ?? 0);
  if (change >= 0.15) {
    score -= 12;
    factors.push('High volatility');
  } else if (change >= 0.05) {
    score -= 4;
  } else {
    score += 8;
    factors.push('Stable price');
  }

  const prob = input.probability ?? 0.5;
  if (prob <= 0.08 || prob >= 0.92) {
    score -= 6;
    factors.push('Extreme odds');
  } else if (prob >= 0.25 && prob <= 0.75) {
    score += 6;
    factors.push('Balanced odds');
  }

  if ((input.whale_count ?? 0) >= 5) {
    score += 8;
    factors.push('Whale interest');
  }

  score = Math.max(0, Math.min(100, score));
  const grade = gradeFromScore(score);
  const labels: Record<RiskGrade, string> = {
    A: 'Low risk',
    B: 'Moderate-low',
    C: 'Moderate',
    D: 'Elevated',
    F: 'High risk',
  };

  return { grade, score, label: labels[grade], factors };
}
