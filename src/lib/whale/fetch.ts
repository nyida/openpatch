import { getToken } from '@/lib/auth/client';

export type FetchJsonOptions = {
  timeoutMs?: number;
  retries?: number;
};

export async function fetchJson<T>(
  url: string,
  init?: RequestInit,
  options: FetchJsonOptions = {},
): Promise<T> {
  const { timeoutMs = 20_000, retries = 2 } = options;
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const headers = new Headers(init?.headers);
      const token = getToken();
      if (token && !headers.has('Authorization')) {
        headers.set('Authorization', `Bearer ${token}`);
      }
      const res = await fetch(url, {
        ...init,
        headers,
        signal: controller.signal,
        cache: 'no-store',
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const msg = (body as { error?: string }).error ?? `Request failed (${res.status})`;
        throw new Error(msg);
      }
      return (await res.json()) as T;
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') {
        lastError = new Error('Request timed out - try refreshing the page');
      } else {
        lastError = e instanceof Error ? e : new Error(String(e));
      }
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, Math.min(1000 * 2 ** attempt, 8000)));
        continue;
      }
      throw lastError;
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastError ?? new Error('Request failed');
}
