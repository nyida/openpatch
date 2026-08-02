export type SmartMoneyInput = {
  alltimeProfit: number;
  winRate: number;
  tradeCount: number;
  maxDrawdown: number;
  rank?: number;
};

/** Composite smart-money score - higher is better. */
export function smartMoneyScore(input: SmartMoneyInput): number {
  const mdd = Math.max(input.maxDrawdown, 1);
  const profitFactor = input.alltimeProfit / mdd;
  const activity = Math.min(input.tradeCount / 100, 1);
  const rankBonus = input.rank != null && input.rank <= 10 ? 1.2 : input.rank != null && input.rank <= 50 ? 1.1 : 1;
  return (input.winRate * 40 + profitFactor * 0.01 + activity * 10) * rankBonus;
}

export function smartMoneyTier(score: number): 'Elite' | 'Strong' | 'Average' | 'Weak' {
  if (score >= 35) return 'Elite';
  if (score >= 22) return 'Strong';
  if (score >= 12) return 'Average';
  return 'Weak';
}
