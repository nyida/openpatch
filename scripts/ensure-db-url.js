#!/usr/bin/env node
/**
 * Ensures DATABASE_URL is set before prisma generate (build time).
 * Prisma schema only reads env("DATABASE_URL"), but integrations set POSTGRES_PRISMA_URL etc.
 * Uses a dummy URL for build if none found—Prisma generate doesn't connect, runtime uses real env.
 */
const { execSync } = require('child_process');

const fallbacks = [
  process.env.DATABASE_URL,
  process.env.POSTGRES_PRISMA_URL,
  process.env.POSTGRES_URL,
  process.env.POSTGRES_URL_NON_POOLING,
];

const url = fallbacks.find(
  (u) =>
    u?.trim() &&
    (u.trim().startsWith('postgresql://') || u.trim().startsWith('postgres://'))
);

if (url) {
  process.env.DATABASE_URL = url.trim();
} else {
  process.env.DATABASE_URL = 'postgresql://build:build@localhost:5432/build';
}

const env = { ...process.env };
try {
  execSync('npx prisma generate', { stdio: 'inherit', env });
  execSync('npx next build', { stdio: 'inherit', env });
} catch (e) {
  console.error('\nBuild failed. If DATABASE_URL is missing, add it in Vercel → Settings → Environment Variables (available at Build time).');
  process.exit(1);
}
