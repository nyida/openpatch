/**
 * Free vs Pro plan surface.
 * Free = solid core desk. Pro = best alpha tools.
 */

export const FREE_APP_PREFIXES = [
  '/dashboard',
  '/traders',
  '/trader',
  '/screener',
  '/profile',
  '/alerts',
  '/tools/kelly',
  '/market',
  '/account',
  '/verify',
] as const;

export const PRO_APP_PREFIXES = [
  '/arbs',
  '/live',
  '/markets',
  '/workspace',
] as const;

/** APIs that need Pro (best stuff). Everything else authenticated is Free. */
export const PRO_API_PREFIXES = [
  '/api/arbitrage',
  '/api/arbitrage-pmxt',
  '/api/arbs',
  '/api/live_whales',
  '/api/kalshi_flow',
  '/api/whales',
  '/api/markets/aggregate',
  '/api/spread_history',
  '/api/price_stream',
] as const;

export function pathMatches(pathname: string, prefixes: readonly string[]) {
  return prefixes.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`) || pathname.startsWith(p),
  );
}

export function isProAppPath(pathname: string) {
  return pathMatches(pathname, PRO_APP_PREFIXES);
}

export function isFreeAppPath(pathname: string) {
  return pathMatches(pathname, FREE_APP_PREFIXES);
}

export function isProApiPath(pathname: string) {
  return PRO_API_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`) || pathname.startsWith(p),
  );
}

export const FREE_FEATURES = [
  'Whale dashboard & holdings vs odds',
  'Trader leaderboard and profiles',
  'Market screener',
  'Kelly calculator',
  'Basic alerts',
] as const;

export const PRO_FEATURES = [
  'Cross-venue arbitrage scanner',
  'Live whale flow & large fills',
  'Market exposure rankings',
  'Spread history & advanced feeds',
  'Priority data refresh',
] as const;
