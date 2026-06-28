/** Canonical trader profile URL. */
export function traderProfilePath(wallet: string): string {
  return `/trader/${encodeURIComponent(wallet)}`;
}

/** Legacy query-param profile URL (still supported). */
export function traderProfileQueryPath(wallet: string): string {
  return `/profile?wallet=${encodeURIComponent(wallet)}`;
}
