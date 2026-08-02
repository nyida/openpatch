const store = new Map<string, { at: number; data: unknown }>();
const pending = new Map<string, Promise<unknown>>();

export function cachedResponse<T>(key: string, ttlMs: number, fn: () => T): T {
  const hit = store.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.data as T;
  const data = fn();
  store.set(key, { at: Date.now(), data });
  return data;
}

/** In-memory cache with singleflight dedup + stale-while-revalidate. */
export async function cachedResponseAsync<T>(
  key: string,
  ttlMs: number,
  fn: () => Promise<T>,
  opts?: { staleMs?: number },
): Promise<T> {
  const hit = store.get(key);
  const age = hit ? Date.now() - hit.at : Infinity;
  const staleMs = opts?.staleMs ?? ttlMs * 2;

  if (hit && age < ttlMs) return hit.data as T;

  // Serve stale immediately; refresh in background.
  if (hit && age < staleMs) {
    if (!pending.has(key)) {
      const refresh = fn()
        .then((data) => {
          store.set(key, { at: Date.now(), data });
          pending.delete(key);
          return data;
        })
        .catch(() => {
          pending.delete(key);
          return hit.data as T;
        });
      pending.set(key, refresh);
    }
    return hit.data as T;
  }

  const inflight = pending.get(key);
  if (inflight) return inflight as Promise<T>;

  const p = fn()
    .then((data) => {
      store.set(key, { at: Date.now(), data });
      pending.delete(key);
      return data;
    })
    .catch((e) => {
      pending.delete(key);
      if (hit) return hit.data as T;
      throw e;
    });
  pending.set(key, p);
  return p as Promise<T>;
}

/** Clear caches (tests). */
export function resetResponseCache(): void {
  store.clear();
  pending.clear();
}
