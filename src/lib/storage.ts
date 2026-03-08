import { readFile } from 'fs/promises';
import { join } from 'path';
import { prisma } from '@/lib/db';
import { allowedMimeType, maxBytes } from './storage-config';

const UPLOAD_DIR = process.env.VERCEL ? '/tmp' : (process.env.UPLOAD_DIR ?? './uploads');

export { allowedMimeType, maxBytes };

/** Path for storing/reading an attachment by id. Use when creating Attachment records. */
export function getStoragePathForId(id: string): string {
  const base = UPLOAD_DIR.startsWith('/') ? UPLOAD_DIR : UPLOAD_DIR.replace(/^\.\//, '');
  return `${base}/${id}`;
}

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
