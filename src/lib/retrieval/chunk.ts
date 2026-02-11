const CHUNK_SIZE = 512;
const CHUNK_OVERLAP = 64;

export function chunkText(text: string): string[] {
  const chunks: string[] = [];
  let start = 0;
  const normalized = text.replace(/\s+/g, ' ').trim();
  while (start < normalized.length) {
    let end = start + CHUNK_SIZE;
    if (end < normalized.length) {
      const nextSpace = normalized.indexOf(' ', end);
      if (nextSpace !== -1 && nextSpace - start < CHUNK_SIZE + 200) end = nextSpace + 1;
    }
    chunks.push(normalized.slice(start, end).trim());
    start = end - CHUNK_OVERLAP;
    if (start >= normalized.length) break;
  }
  return chunks.filter((c) => c.length > 0);
}

export function chunkByParagraphs(text: string, maxChunkSize = 600): string[] {
  const paragraphs = text.split(/\n\s*\n/).map((p) => p.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const chunks: string[] = [];
  let current = '';
  for (const p of paragraphs) {
    if (current.length + p.length + 1 <= maxChunkSize) {
      current = current ? current + '\n\n' + p : p;
    } else {
      if (current) chunks.push(current);
      current = p.length <= maxChunkSize ? p : chunkText(p).join(' ');
    }
  }
  if (current) chunks.push(current);
  return chunks;
}
