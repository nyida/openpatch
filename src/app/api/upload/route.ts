import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { nanoid } from 'nanoid';
import { allowedMimeType, maxBytes } from '@/lib/storage-config';

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 });
  if (!allowedMimeType(file.type))
    return NextResponse.json({ error: 'File type not allowed' }, { status: 400 });
  if (file.size > maxBytes())
    return NextResponse.json({ error: 'File too large' }, { status: 400 });
  const id = nanoid(12);
  // Vercel: only /tmp is writable; local: use UPLOAD_DIR or ./uploads
  const uploadDir = process.env.VERCEL ? '/tmp' : (process.env.UPLOAD_DIR ?? 'uploads');
  const dir = join(process.cwd(), uploadDir);
  await mkdir(dir, { recursive: true });
  const path = join(dir, id);
  const buf = Buffer.from(await file.arrayBuffer());
  await writeFile(path, buf);
  return NextResponse.json({ id, name: file.name });
}
