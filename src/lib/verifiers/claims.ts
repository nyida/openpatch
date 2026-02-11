/**
 * Extract atomic factual claims from a candidate answer.
 * Used for citation verification. Keeps logic deterministic where possible.
 */

const EXTRACT_PROMPT = `You are a claim extractor. Given an answer text, list every atomic factual claim that could be verified against a source. One claim per line. Only factual claims (numbers, dates, names, definitions, "X is Y"). Do not list opinions or instructions. If there are no factual claims, output exactly: NONE`;

export interface Claim {
  text: string;
  index: number;
}

export async function extractClaims(answer: string, llm: { complete: (messages: { role: string; content: string }[]) => Promise<string> }): Promise<Claim[]> {
  if (!answer.trim()) return [];
  const raw = await llm.complete([
    { role: 'system', content: EXTRACT_PROMPT },
    { role: 'user', content: answer.slice(0, 6000) },
  ]);
  const trimmed = raw.trim();
  if (trimmed.toUpperCase() === 'NONE') return [];
  const lines = trimmed.split('\n').map((l) => l.replace(/^[-*]\s*/, '').trim()).filter(Boolean);
  return lines.map((text, index) => ({ text, index }));
}
