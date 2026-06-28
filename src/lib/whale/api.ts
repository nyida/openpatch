import { NextResponse } from 'next/server';
import { dbPath } from './db';

export function whaleError(error: unknown, status = 500) {
  const message = error instanceof Error ? error.message : String(error);
  const path = dbPath();

  if (
    message.includes('no such file') ||
    message.includes('fileMustExist') ||
    message.includes('Database not found')
  ) {
    return NextResponse.json(
      {
        error: `Database not found at ${path}. Set WHALE_DB_PATH in .env.local or run npm run scrape:ensure`,
        db_path: path,
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ error: message, db_path: path }, { status });
}

export function whaleJson<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}
