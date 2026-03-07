#!/usr/bin/env node
/**
 * Test SearXNG search without running the Next.js app.
 * Usage: node scripts/test-searxng.mjs
 * Requires: SearXNG running at http://localhost:8080 (docker compose -f searxng/docker-compose.yml up -d)
 */

const BASE = process.env.SEARXNG_BASE_URL || 'http://localhost:8080';
const QUERY = 'OpenPatch verification research';

async function main() {
  const url = `${BASE.replace(/\/$/, '')}/search?q=${encodeURIComponent(QUERY)}&format=json`;
  console.log('Fetching:', url);
  const res = await fetch(url);
  if (!res.ok) {
    console.error('Error:', res.status, await res.text());
    process.exit(1);
  }
  const data = await res.json();
  const results = (data.results || []).slice(0, 5);
  console.log('Query:', data.query);
  console.log('Results:', results.length);
  results.forEach((r, i) => {
    console.log(`  ${i + 1}. ${r.title || 'Untitled'}`);
    console.log(`     ${r.url}`);
  });
  console.log('OK');
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
