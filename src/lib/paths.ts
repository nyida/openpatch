import fs from 'fs';
import os from 'os';
import path from 'path';

function expandHome(p: string): string {
  if (p.startsWith('~/')) return path.join(os.homedir(), p.slice(2));
  return p;
}

/** Persistent data root: DATA_DIR env, Render /var/data disk, or ./data. */
export function resolveDataDir(): string {
  if (process.env.DATA_DIR) return path.resolve(expandHome(process.env.DATA_DIR));
  if (process.env.AUTH_DATA_DIR) return path.resolve(expandHome(process.env.AUTH_DATA_DIR));
  if (fs.existsSync('/var/data')) return '/var/data';
  return path.resolve('./data');
}
