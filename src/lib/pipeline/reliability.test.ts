import { describe, it, expect } from 'vitest';
import { buildReliabilityReport } from './reliability';
import type { VerificationResult } from './types';
import type { CitationVerificationResult } from '@/lib/verifiers';

describe('buildReliabilityReport', () => {
  it('sets low confidence when contradictions detected', () => {
    const verifications: VerificationResult[] = [
      { type: 'contradiction', resultJson: {}, pass: false, notes: 'Yes' },
    ];
    const report = buildReliabilityReport(false, verifications);
    expect(report.overallConfidence).toBe('low');
    expect(report.contradictionsDetected).toBe(true);
  });

  it('sets high confidence when no contradictions and high claims support', () => {
    const verifications: VerificationResult[] = [
      { type: 'citation', resultJson: {}, pass: true },
      { type: 'contradiction', resultJson: {}, pass: true },
      { type: 'calculator', resultJson: {}, pass: true },
    ];
    const citationResults: CitationVerificationResult[] = [
      { claimIndex: 0, claimText: 'a', supported: true, bestChunkScore: 0.9, overlapScore: 0.8 },
      { claimIndex: 1, claimText: 'b', supported: true, bestChunkScore: 0.85, overlapScore: 0.7 },
    ];
    const report = buildReliabilityReport(true, verifications, citationResults);
    expect(report.overallConfidence).toBe('high');
    expect(report.claimsSupportedPercent).toBe(100);
  });

  it('sets medium confidence by default', () => {
    const report = buildReliabilityReport(false, []);
    expect(report.overallConfidence).toBe('medium');
    expect(report.retrievalUsed).toBe(false);
  });
});
