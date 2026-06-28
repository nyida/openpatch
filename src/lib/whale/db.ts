import Database from 'better-sqlite3';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { ensureSchema } from './migrate';

function expandHome(p: string): string {
  if (p.startsWith('~/')) return path.join(os.homedir(), p.slice(2));
  return p;
}

/** Resolve whale_data.db — checks env, scraper dir, project root, and common defaults. */
export function resolveDbPath(): string {
  if (process.env.WHALE_DB_PATH) {
    return path.resolve(expandHome(process.env.WHALE_DB_PATH));
  }

  const scraperDir = process.env.WHALE_SCRAPER_DIR
    ? path.resolve(expandHome(process.env.WHALE_SCRAPER_DIR))
    : path.join(os.homedir(), 'Desktop', 'PolymarketAnalysis');

  const candidates = [
    path.join(scraperDir, 'whale_data.db'),
    path.resolve('./whale_data.db'),
    path.resolve('./public/whale_data.db'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }

  return path.resolve('./public/whale_data.db');
}

const DB_PATH = resolveDbPath();

let db: Database.Database | null = null;
let migrated = false;

export function dbPath(): string {
  return DB_PATH;
}

export function isDbAvailable(): boolean {
  return fs.existsSync(DB_PATH);
}

function schemaReady(): boolean {
  if (!isDbAvailable()) return false;
  try {
    const probe = new Database(DB_PATH, { readonly: true, fileMustExist: true, timeout: 60000 });
    probe.pragma('busy_timeout = 60000');
    const row = probe
      .prepare("SELECT value FROM scrape_metadata WHERE key = 'schema_migrated_v2'")
      .get() as { value: string } | undefined;
    probe.close();
    return row?.value === '1';
  } catch {
    return false;
  }
}

function migrateOnce() {
  if (migrated || schemaReady()) {
    migrated = true;
    return;
  }
  const writeDb = new Database(DB_PATH, { fileMustExist: true, timeout: 60000 });
  try {
    writeDb.pragma('journal_mode = WAL');
    writeDb.pragma('busy_timeout = 60000');
    ensureSchema(writeDb);
    migrated = true;
  } finally {
    writeDb.close();
  }
}

export function getDb(): Database.Database {
  if (!isDbAvailable()) {
    throw new Error(
      `Database not found at ${DB_PATH}. Set WHALE_DB_PATH in .env.local or run npm run scrape:ensure`,
    );
  }
  if (!db) {
    migrateOnce();
    db = new Database(DB_PATH, { readonly: true, fileMustExist: true, timeout: 60000 });
    db.pragma('busy_timeout = 60000');
  }
  return db;
}
