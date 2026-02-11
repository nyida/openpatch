import { describe, it, expect } from 'vitest';
import { verifyCitations, claimsSupportedPercent, type CitationVerificationResult } from './citation';
import type { Claim } from './claims';

describe('claimsSupportedPercent', () => {
  it('returns 100 for empty results', () => {
    expect(claimsSupportedPercent([])).toBe(100);
  });

  it('returns 100 when all supported', () => {
    const results: CitationVerificationResult[] = [
      { claimIndex: 0, claimText: 'a', supported: true, bestChunkScore: 0.9, overlapScore: 0.8 },
      { claimIndex: 1, claimText: 'b', supported: true, bestChunkScore: 0.8, overlapScore: 0.7 },
    ];
    expect(claimsSupportedPercent(results)).toBe(100);
  });

  it('returns 50 when half supported', () => {
    const results: CitationVerificationResult[] = [
      { claimIndex: 0, claimText: 'a', supported: true, bestChunkScore: 0.9, overlapScore: 0.8 },
      { claimIndex: 1, claimText: 'b', supported: false, bestChunkScore: 0.3, overlapScore: 0.2 },
    ];
    expect(claimsSupportedPercent(results)).toBe(50);
  });

  it('returns 0 when none supported', () => {
    const results: CitationVerificationResult[] = [
      { claimIndex: 0, claimText: 'a', supported: false, bestChunkScore: 0.2, overlapScore: 0.1 },
    ];
    expect(claimsSupportedPercent(results)).toBe(0);
  });
});

describe('verifyCitations', () => {
  it('returns unsupported when no chunks', async () => {
    const claims: Claim[] = [{ text: 'Paris is the capital.', index: 0 }];
    const results = await verifyCitations(claims, []);
    expect(results).toHaveLength(1);
    expect(results[0].supported).toBe(false);
    expect(results[0].note).toContain('No context');
  });

});
