import { describe, it, expect } from 'vitest';
import { verifyArithmetic } from './calculator';

describe('verifyArithmetic', () => {
  it('passes when no arithmetic in answer', () => {
    const result = verifyArithmetic('The sky is blue.');
    expect(result.type).toBe('calculator');
    expect(result.pass).toBe(true);
    expect(result.resultJson.findings).toHaveLength(0);
  });

  it('detects and verifies correct arithmetic', () => {
    const result = verifyArithmetic('We have 15 + 27 = 42 in the total.');
    expect(result.pass).toBe(true);
    const findings = result.resultJson.findings as { expression: string; stated: string; computed: string; match: boolean }[];
    expect(findings.length).toBeGreaterThanOrEqual(1);
    const f = findings.find((x) => x.expression.includes('15') && x.stated === '42');
    expect(f?.match).toBe(true);
    expect(f?.computed).toBe('42');
  });

  it('fails when stated result is wrong', () => {
    const result = verifyArithmetic('So 8 * 9 = 70.');
    expect(result.pass).toBe(false);
    const findings = result.resultJson.findings as { stated: string; computed: string; match: boolean }[];
    expect(findings.length).toBeGreaterThanOrEqual(1);
    expect(findings.some((f) => !f.match && (f.computed === '72' || f.stated.includes('70')))).toBe(true);
  });
});
