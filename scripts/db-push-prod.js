#!/usr/bin/env node
/**
 * Run prisma db push using production env vars from Vercel.
 * Run: npx vercel env pull .env.production && node scripts/db-push-prod.js
 * Or: npm run db:push:prod
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const envPath = path.join(process.cwd(), '.env.production');
if (!fs.existsSync(envPath)) {
  console.error('Run "npx vercel env pull .env.production" first to pull production env vars.');
  process.exit(1);
}

// Parse .env format (simple key=value)
const content = fs.readFileSync(envPath, 'utf8');
content.split('\n').forEach((line) => {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return;
  const eq = trimmed.indexOf('=');
  if (eq === -1) return;
  const key = trimmed.slice(0, eq).trim();
  let val = trimmed.slice(eq + 1).trim();
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
    val = val.slice(1, -1).replace(/\\n/g, '\n');
  }
  process.env[key] = val;
});

// Ensure DATABASE_URL from fallbacks (same as ensure-db-url.js)
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
if (url) process.env.DATABASE_URL = url.trim();

execSync('npx prisma db push', { stdio: 'inherit', env: process.env });
