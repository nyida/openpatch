import { PrismaClient } from '@prisma/client';

// Sync DATABASE_URL from Vercel Postgres / Supabase integrations (schema only reads DATABASE_URL)
const rawDb = process.env.DATABASE_URL?.trim();
const valid = rawDb && (rawDb.startsWith('postgresql://') || rawDb.startsWith('postgres://'));
if (!valid) {
  const fallback =
    process.env.POSTGRES_PRISMA_URL?.trim() ||
    process.env.POSTGRES_URL?.trim() ||
    process.env.PUBLIC_SUPABASE_URL_POSTGRES_PRISMA_URL?.trim();
  if (fallback && (fallback.startsWith('postgresql://') || fallback.startsWith('postgres://'))) {
    process.env.DATABASE_URL = fallback;
  }
}

function getDatabaseUrl(): string {
  const raw =
    process.env.DATABASE_URL ??
    process.env.POSTGRES_PRISMA_URL ??
    process.env.POSTGRES_URL ??
    process.env.PUBLIC_SUPABASE_URL_POSTGRES_PRISMA_URL;
  const url = (raw ?? '').trim();
  if (!url || (!url.startsWith('postgresql://') && !url.startsWith('postgres://'))) {
    throw new Error(
      'DATABASE_URL is missing or invalid. Set it in Vercel: Project → Settings → Environment Variables. ' +
        'Use your Postgres pooler URL (e.g. postgresql://user:pass@host:6543/postgres). No quotes.'
    );
  }
  return url;
}

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: { db: { url: getDatabaseUrl() } },
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
