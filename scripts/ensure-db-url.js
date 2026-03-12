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
  // Build-time only: Prisma generate needs env("DATABASE_URL") to parse schema.
  // It doesn't connect. Runtime uses real DATABASE_URL from Vercel env.
  process.env.DATABASE_URL = 'postgresql://build:build@localhost:5432/build';
}

execSync('npx prisma generate && next build', {
  stdio: 'inherit',
  env: process.env,
});
