import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cacheStats, clearAllCache, peekCache, putCache, swrFetch } from '~/lib/cache-store';

describe('SWR cache-store', () => {
  beforeEach(async () => {
    await clearAllCache();
  });

  it('stores and retrieves metadata synchronously via peekCache', async () => {
    await putCache('shelf:en', [{ id: 'anime' }]);
    expect(peekCache('shelf:en')).toEqual([{ id: 'anime' }]);
    expect(cacheStats().entries).toBe(1);
  });

  it('deduplicates concurrent identical swrFetch requests', async () => {
    const fetcher = vi
      .fn()
      .mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({ ok: true }), 15))
      );
    const [a, b] = await Promise.all([swrFetch('dedupe', fetcher), swrFetch('dedupe', fetcher)]);
    expect(a).toEqual({ ok: true });
    expect(b).toEqual({ ok: true });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(peekCache('dedupe')).toEqual({ ok: true });
  });
});
