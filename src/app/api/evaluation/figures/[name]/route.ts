import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

const ROOT = process.cwd();
const FIGURES = path.join(ROOT, 'evals', 'results', 'figures');

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;
  if (!name || name.includes('..') || name.includes('/')) {
    return NextResponse.json({ error: 'Invalid name' }, { status: 400 });
  }
  const file = path.join(FIGURES, name);
  if (!fs.existsSync(file) || !path.resolve(file).startsWith(path.resolve(FIGURES))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  const buf = fs.readFileSync(file);
  const ext = path.extname(name).toLowerCase();
  const contentType = ext === '.png' ? 'image/png' : ext === '.pdf' ? 'application/pdf' : 'application/octet-stream';
  return new NextResponse(buf, {
    headers: { 'Content-Type': contentType },
  });
}
