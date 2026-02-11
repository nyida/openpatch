/**
 * Calculator verifier: detect arithmetic expressions in the answer and recompute.
 */
import { evaluate } from 'mathjs';
import type { VerificationResult } from '@/lib/pipeline/types';

const ARITHMETIC_PATTERN = /\b(\d+(?:\.\d+)?\s*[\+\-\*\/\^]\s*[\d\.\s\+\-\*\/\^\(\)]+)\s*=\s*([\d\.\-]+)/g;
const SIMPLE_EXPR = /^[\d\.\s\+\-\*\/\^\(\)]+$/;

export function verifyArithmetic(answer: string): VerificationResult {
  const findings: { expression: string; stated: string; computed: string; match: boolean }[] = [];
  let m: RegExpExecArray | null;
  const normalized = answer.replace(/\s+/g, ' ');
  while ((m = ARITHMETIC_PATTERN.exec(normalized)) !== null) {
    const expr = m[1].replace(/\s+/g, '').trim();
    const stated = m[2].trim();
    if (!SIMPLE_EXPR.test(expr)) continue;
    try {
      const computed = String(evaluate(expr));
      const statedNum = parseFloat(stated);
      const computedNum = parseFloat(computed);
      const match = Math.abs(statedNum - computedNum) < 1e-6;
      findings.push({ expression: expr, stated, computed, match });
    } catch {
      findings.push({ expression: expr, stated, computed: 'error', match: false });
    }
  }
  const allMatch = findings.length === 0 || findings.every((f) => f.match);
  return {
    type: 'calculator',
    resultJson: { findings },
    pass: allMatch,
    notes: findings.length === 0 ? 'No arithmetic expressions detected' : undefined,
  };
}
