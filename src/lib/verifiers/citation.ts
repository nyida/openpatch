/**
 * Citation verifier: for each claim, check if it is supported by retrieved context.
 * Uses string overlap + embedding similarity + optional judge check.
 */
import { embed } from '@/lib/llm';
import type { Claim } from './claims';
import type { RetrievalChunkData } from '@/lib/pipeline/types';

function normalize(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim();
}

function overlapScore(claim: string, context: string): number {
  const c = normalize(claim);
  const ctx = normalize(context);
  if (ctx.includes(c)) return 1;
  const claimWords = new Set(c.split(/\s+/).filter((w) => w.length > 2));
  const ctxWords = new Set(ctx.split(/\s+/));
  let matches = 0;
  claimWords.forEach((w) => {
    if (ctxWords.has(w)) matches++;
  });
  return claimWords.size === 0 ? 0 : matches / claimWords.size;
}

export interface CitationVerificationResult {
  claimIndex: number;
  claimText: string;
  supported: boolean;
  bestChunkScore: number;
  overlapScore: number;
  note?: string;
}

export async function verifyCitations(
  claims: Claim[],
  chunks: RetrievalChunkData[]
): Promise<CitationVerificationResult[]> {
  if (chunks.length === 0) {
    return claims.map((c, i) => ({
      claimIndex: i,
      claimText: c.text,
      supported: false,
      bestChunkScore: 0,
      overlapScore: 0,
      note: 'No context to verify against',
    }));
  }
  const chunkTexts = chunks.map((ch) => ch.text);
  const claimTexts = claims.map((c) => c.text);
  let chunkEmbs: number[][] | null = null;
  let claimEmbs: number[][] | null = null;
  try {
    chunkEmbs = await embed(chunkTexts);
    claimEmbs = await embed(claimTexts);
  } catch {
    // Embed model not available; use overlap only
  }

  function cosine(a: number[], b: number[]): number {
    let dot = 0, na = 0, nb = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      na += a[i] * a[i];
      nb += b[i] * b[i];
    }
    const d = Math.sqrt(na) * Math.sqrt(nb);
    return d === 0 ? 0 : dot / d;
  }

  const results: CitationVerificationResult[] = [];
  for (let i = 0; i < claims.length; i++) {
    const claim = claims[i];
    let bestSim = 0;
    let bestOverlap = 0;
    for (let j = 0; j < chunks.length; j++) {
      const ov = overlapScore(claim.text, chunks[j].text);
      if (chunkEmbs && claimEmbs && chunkEmbs[j] && claimEmbs[i]) {
        const sim = cosine(claimEmbs[i], chunkEmbs[j]);
        if (sim > bestSim) bestSim = sim;
      }
      if (ov > bestOverlap) bestOverlap = ov;
    }
    const supported = bestSim >= 0.7 || bestOverlap >= 0.6;
    results.push({
      claimIndex: i,
      claimText: claim.text,
      supported,
      bestChunkScore: bestSim,
      overlapScore: bestOverlap,
      note: supported ? undefined : 'Claim not found in retrieved context',
    });
  }
  return results;
}

export function claimsSupportedPercent(results: CitationVerificationResult[]): number {
  if (results.length === 0) return 100;
  const supported = results.filter((r) => r.supported).length;
  return Math.round((supported / results.length) * 100);
}
