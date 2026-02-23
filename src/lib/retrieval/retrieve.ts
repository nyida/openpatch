import { embed } from '@/lib/llm';
import { chunkText } from './chunk';
import { RetrievalChunkData } from '@/lib/pipeline/types';

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const den = Math.sqrt(na) * Math.sqrt(nb);
  return den === 0 ? 0 : dot / den;
}

export async function retrieve(
  query: string,
  docChunks: { docId: string; text: string }[],
  topK = 10
): Promise<RetrievalChunkData[]> {
  if (docChunks.length === 0) return [];
  const allTexts = [query, ...docChunks.map((c) => c.text)];
  let embeddings: number[][];
  try {
    embeddings = await embed(allTexts);
  } catch (e) {
    // Embed model not installed (e.g. nomic-embed-text)? Use first N chunks in order so run still works.
    return docChunks.slice(0, topK).map((c, i) => ({
      docId: c.docId,
      chunkId: String(i),
      text: c.text,
      score: 1,
    }));
  }
  const queryEmb = embeddings[0];
  const scored = docChunks.map((c, i) => ({
    docId: c.docId,
    chunkId: String(i),
    text: c.text,
    score: cosineSimilarity(queryEmb, embeddings[i + 1]),
  }));
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK).map((s) => ({
    docId: s.docId,
    chunkId: s.chunkId,
    text: s.text,
    score: s.score,
  }));
}

export function chunkDocument(content: string, docId: string): { docId: string; text: string }[] {
  const chunks = chunkText(content);
  return chunks.map((text, i) => ({ docId: `${docId}_${i}`, text }));
}
