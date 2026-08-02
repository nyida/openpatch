import { guardProApi } from '@/lib/auth/guardApi';
import { spawn } from 'child_process';
import path from 'path';
import { whaleError, whaleJson } from '@/lib/whale/api';

const SCRAPER_DIR =
  process.env.WHALE_SCRAPER_DIR ??
  path.join(process.env.HOME ?? '', 'Desktop/PolymarketAnalysis');

const ENABLED =
  process.env.ENABLE_SCRAPER_REFRESH === 'true' || process.env.NODE_ENV === 'development';

let running = false;

export async function POST(request: Request) {
  const _denied = await guardProApi(request);
  if (_denied) return _denied;

  if (!ENABLED) {
    return whaleJson({ error: 'Scraper refresh is disabled in this environment.' }, 403);
  }
  if (running) {
    return whaleJson({ ok: false, message: 'Scraper already running.' }, 409);
  }

  const script = path.join(SCRAPER_DIR, 'scraper.py');
  running = true;

  return new Promise<Response>((resolve) => {
    const child = spawn('python3', [script], {
      cwd: SCRAPER_DIR,
      detached: true,
      stdio: 'ignore',
    });
    child.unref();
    child.on('spawn', () => {
      running = false;
      resolve(
        whaleJson({
          ok: true,
          message: 'Scraper started in background. Data will update when the run completes.',
          pid: child.pid,
        }),
      );
    });
    child.on('error', (err) => {
      running = false;
      resolve(whaleError(err));
    });
  });
}
