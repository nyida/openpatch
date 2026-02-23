import { createHash } from 'crypto';

const MAX_INT31 = 0x7fffffff; // 2147483647

/**
 * Canonical 32-bit seed from string. Result in [0, 2147483646].
 */
export function seed32(input: string): number {
  const hex = createHash('sha256').update(input, 'utf8').digest('hex');
  const first8 = hex.slice(0, 8);
  const n = parseInt(first8, 16);
  return Math.abs(n % (MAX_INT31 - 1));
}

/**
 * Temperature as stable string for inclusion in seed input.
 */
export function stableKeyTemperature(temp: number): string {
  return temp.toFixed(6);
}

/**
 * Deterministic run ID. stableContext is REQUIRED (no Date.now).
 */
export function runId(
  prompt: string,
  mode: 'baseline' | 'improved',
  stableContext: string
): string {
  const payload = `${prompt}|${mode}|${stableContext}`;
  return createHash('sha256').update(payload, 'utf8').digest('hex').slice(0, 24);
}
