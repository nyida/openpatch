import { describe, it, expect, vi } from 'vitest';
import { extractClaims } from './claims';

describe('extractClaims', () => {
  it('returns empty array for empty answer', async () => {
    const llm = { complete: vi.fn().mockResolvedValue('NONE') };
    const claims = await extractClaims('', llm);
    expect(claims).toEqual([]);
  });

  it('returns NONE when LLM says NONE', async () => {
    const llm = { complete: vi.fn().mockResolvedValue('NONE') };
    const claims = await extractClaims('The sky is blue.', llm);
    expect(claims).toEqual([]);
  });

  it('returns parsed claims one per line', async () => {
    const llm = {
      complete: vi.fn().mockResolvedValue('Paris is the capital of France.\nThe year 1776 is when the Declaration was signed.'),
    };
    const claims = await extractClaims('Some text', llm);
    expect(claims).toHaveLength(2);
    expect(claims[0].text).toContain('Paris');
    expect(claims[1].text).toContain('1776');
    expect(claims[0].index).toBe(0);
    expect(claims[1].index).toBe(1);
  });

  it('strips bullet prefixes', async () => {
    const llm = {
      complete: vi.fn().mockResolvedValue('- First claim.\n* Second claim.'),
    };
    const claims = await extractClaims('Text', llm);
    expect(claims[0].text).toBe('First claim.');
    expect(claims[1].text).toBe('Second claim.');
  });
});
