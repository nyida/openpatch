#!/usr/bin/env node
/**
 * Ensures DATABASE_URL is set before prisma generate (build time).
 * Prisma schema only reads env("DATABASE_URL"), but integrations set POSTGRES_PRISMA_URL etc.
 */
const { execSync } = require('child_process');

const fallbacks = [
  process.env.DATABASE_URL,
  process.env.POSTGRES_PRISMA_URL,
  process.env.POSTGRES_URL,
  process.env.PUBLIC_SUPABASE_URL_POSTGRES_PRISMA_URL,
];

const url = fallbacks.find(
  (u) =>
    u?.trim() &&
    (u.trim().startsWith('postgresql://') || u.trim().startsWith('postgres://'))
);

if (url) {
  process.env.DATABASE_URL = url.trim();
}

execSync('prisma generate && next build', {
  stdio: 'inherit',
  env: process.env,
});
