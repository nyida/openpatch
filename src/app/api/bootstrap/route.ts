import { guardProApi } from '@/lib/auth/guardApi';
import path from 'path';
import { getScrapeStatus } from '@/lib/whale/status';
import { startBatchScraper, startKalshiScraper, SCRAPE_ENABLED } from '@/lib/whale/scrape-runner';
import { whaleError, whaleJson } from '@/lib/whale/api';

const PROJECT_ROOT = path.join(process.cwd());

export async function GET(request: Request) {
  const _denied = await guardProApi(request);
  if (_denied) return _denied;

  if (!SCRAPE_ENABLED) {
    try {
      return whaleJson({ ok: true, status: getScrapeStatus(), actions: [] });
    } catch (e) {
      return whaleError(e);
    }
  }

  try {
    const actions: string[] = [];

    const kalshi = startKalshiScraper(PROJECT_ROOT);
    if (kalshi.ok && kalshi.message.includes('started')) actions.push('kalshi');

    const status = getScrapeStatus();
    let batchMessage = 'holdings fresh';
    if (
      status.stale &&
      !status.scrape_in_progress &&
      status.trader_count >= status.whale_target
    ) {
      const batch = startBatchScraper();
      if (batch.ok && batch.message.includes('started')) actions.push('batch');
      batchMessage = batch.message;
    } else if (status.scrape_in_progress) {
      batchMessage = 'holdings rebuild in progress';
    } else if (status.trader_count < status.whale_target) {
      batchMessage = 'holdings scrape loading';
    }

    return whaleJson({
      ok: true,
      status: getScrapeStatus(),
      actions,
      kalshi: kalshi.message,
      batch: batchMessage,
    });
  } catch (e) {
    return whaleError(e);
  }
}
