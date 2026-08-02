/**
 * Ensure public/whale_data.db exists for deploys that resolve the public path.
 * Source of truth: storage/whale_data.db (shipped in git).
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const src = path.join(root, 'storage', 'whale_data.db');
const dest = path.join(root, 'public', 'whale_data.db');

if (!fs.existsSync(src)) {
  console.warn('[ensure-whale-db] missing storage/whale_data.db — skipping copy');
  process.exit(0);
}

fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.copyFileSync(src, dest);
console.log(`[ensure-whale-db] copied storage/whale_data.db -> public/whale_data.db (${fs.statSync(dest).size} bytes)`);
