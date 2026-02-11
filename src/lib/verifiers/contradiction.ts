/**
 * Contradiction verifier: detect inconsistencies within the answer.
 */
import type { VerificationResult } from '@/lib/pipeline/types';

export async function verifyContradiction(
  answer: string,
  llm: { complete: (messages: { role: string; content: string }[]) => Promise<string> }
): Promise<VerificationResult> {
  const prompt = `Does the following text contain any internal contradictions (e.g. saying X and later saying the opposite of X)? Answer only YES or NO. If unclear, say NO.\n\nText:\n${answer.slice(0, 4000)}`;
  const raw = await llm.complete([
    { role: 'user', content: prompt },
  ]);
  const hasContradiction = raw.trim().toUpperCase().startsWith('YES');
  return {
    type: 'contradiction',
    resultJson: { hasContradiction, rawResponse: raw.trim() },
    pass: !hasContradiction,
    notes: hasContradiction ? 'Possible internal contradiction detected' : undefined,
  };
}
