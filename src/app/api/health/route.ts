import { NextResponse } from 'next/server';
import { dbPath, isDbAvailable, getDb } from '@/lib/whale/db';

export async function GET() {
  const dbExists = isDbAvailable();
  let dbConnected = false;
  let traderCount: number | null = null;

  if (dbExists) {
    try {
      const db = getDb();
      dbConnected = true;
      const row = db.prepare('SELECT COUNT(*) AS c FROM traders').get() as { c: number };
      traderCount = row.c;
    } catch {
      dbConnected = false;
    }
  }

  const ok = dbConnected;

  return NextResponse.json(
    {
      ok,
      db: {
        path: dbPath(),
        exists: dbExists,
        connected: dbConnected,
        trader_count: traderCount,
      },
      timestamp: Date.now(),
    },
    { status: ok ? 200 : 503 },
  );
}
