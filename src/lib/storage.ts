import { readFile } from 'fs/promises';
import { join } from 'path';
import { prisma } from '@/lib/db';

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? './uploads';
const MAX_SIZE_MB = Number(process.env.MAX_UPLOAD_MB ?? 10);
const MAX_BYTES = MAX_SIZE_MB * 1024 * 1024;

const ALLOWED_TYPES = [
  'text/plain',
  'application/pdf',
  'text/markdown',
  'application/json',
  'text/csv',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

export function getUploadPath(id: string, filename?: string): string {
  const base = join(UPLOAD_DIR, id);
  return filename ? `${base}_${filename}` : base;
}

async function parseBuffer(buf: Buffer, path: string): Promise<string> {
  if (path.endsWith('.pdf')) {
    try {
      const pdfParse = (await import('pdf-parse')).default;
      const data = await pdfParse(buf);
      return data.text ?? '';
    } catch {
      return buf.toString('utf-8');
    }
  }
  if (path.endsWith('.docx')) {
    try {
      const mammoth = await import('mammoth');
      const result = await mammoth.extractRawText({ buffer: buf });
      return result.value ?? '';
    } catch {
      return buf.toString('utf-8');
    }
  }
  return buf.toString('utf-8');
}

export async function readAttachmentContent(attachmentIdOrPath: string): Promise<string | null> {
  try {
    const att = await prisma.attachment.findFirst({
      where: { id: attachmentIdOrPath },
    });
    if (att) {
      const path = join(process.cwd(), att.storagePath);
      const buf = await readFile(path);
      return parseBuffer(buf, att.storagePath);
    }
    const path = join(process.cwd(), UPLOAD_DIR, attachmentIdOrPath);
    const buf = await readFile(path);
    return parseBuffer(buf, path);
  } catch {
    return null;
  }
}

export function allowedMimeType(mime: string): boolean {
  return ALLOWED_TYPES.includes(mime) || mime.startsWith('text/');
}

export function maxBytes(): number {
  return MAX_BYTES;
}
