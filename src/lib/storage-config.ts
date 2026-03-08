/**
 * Upload config only - no DB dependency. Use this in API routes that must not
 * pull in Prisma during build (e.g. /api/upload).
 */
const ALLOWED_TYPES = [
  'text/plain',
  'application/pdf',
  'text/markdown',
  'application/json',
  'text/csv',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

export function allowedMimeType(mime: string): boolean {
  return ALLOWED_TYPES.includes(mime) || mime.startsWith('text/');
}

export function maxBytes(): number {
  const MAX_SIZE_MB = Number(process.env.MAX_UPLOAD_MB ?? 10);
  return MAX_SIZE_MB * 1024 * 1024;
}
