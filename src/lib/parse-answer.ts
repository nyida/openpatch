/**
 * Authoritative parser for "ANSWER: <value>". Used for eval format and metrics.
 */

/** Line-anchored ANSWER line: ANSWER : <value> with at least one non-whitespace value. */
const ANSWER_LINE = /(?:^|\n)\s*ANSWER\s*:\s*\S+/i;

export function parseAnswer(raw: string): string | undefined {
  const match = raw.match(/(?:^|\n)\s*ANSWER\s*:\s*(.+?)(?:\n|$)/i);
  if (!match) {
    if (/^\s*ANSWER\s*:\s*\S/.test(raw.trim())) {
      const val = raw.trim().replace(/^\s*ANSWER\s*:\s*/i, '').trim();
      return normalizeValue(val);
    }
    return undefined;
  }
  return normalizeValue(match[1].trim());
}

/**
 * Normalize only categorical A–D. No parseFloat/Number: avoids corrupting
 * distinct values (e.g. "01" vs "1", "1.0", large ints, scientific notation).
 * Numeric ground_truth must be normalized the same way in datasets, or use
 * string comparison; for research use categorical labels or decimal library.
 */
function normalizeValue(val: string): string {
  const t = val.trim();
  if (!t) return t;
  if (/^[A-D]$/i.test(t)) return t.toUpperCase();
  return t;
}

/** True iff raw contains an ANSWER line with a value (strict). */
export function hasAnswerFormat(raw: string): boolean {
  return ANSWER_LINE.test(raw);
}
