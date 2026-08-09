import { describe, expect, it, vi } from 'vitest';
import { replaceImportedData } from './importData';

function storageArea(initial: Record<string, unknown>) {
  const store = { ...initial };
  return {
    store,
    get: vi.fn(async (keys?: null | string | string[]) => {
      if (keys === null || keys === undefined) return { ...store };
      const requested = typeof keys === 'string' ? [keys] : keys;
      return requested.reduce<Record<string, unknown>>((result, key) => {
        result[key] = store[key];
        return result;
      }, {});
    }),
    set: vi.fn(async (items: Record<string, unknown>) => {
      Object.assign(store, items);
    }),
    clear: vi.fn(async () => {
      for (const key of Object.keys(store)) delete store[key];
    }),
  };
}

describe('replaceImportedData', () => {
  it('validates before clearing existing data', async () => {
    const storage = storageArea({ settings: { theme: 'dark' } });
    await expect(replaceImportedData({ unexpected: true }, async () => undefined, storage))
      .rejects.toThrow('Unsupported backup field');
    expect(storage.clear).not.toHaveBeenCalled();
    expect(storage.store.settings).toEqual({ theme: 'dark' });
  });

  it('restores the previous snapshot when runtime initialization fails', async () => {
    const storage = storageArea({ settings: { theme: 'dark' }, blockedSites: [] });
    await expect(replaceImportedData(
      { settings: { theme: 'light' }, blockedSites: [{ id: 'site-1' }] },
      async () => { throw new Error('rules failed'); },
      storage
    )).rejects.toThrow('rules failed');
    expect(storage.store).toEqual({ settings: { theme: 'dark' }, blockedSites: [] });
  });

  it('removes transient sessions from otherwise complete imports', async () => {
    const storage = storageArea({ settings: {} });
    await replaceImportedData({
      settings: { theme: 'light' },
      activeSessions: { 1: { domain: 'example.com' } },
    }, async () => undefined, storage);
    expect(storage.store).toEqual({ settings: { theme: 'light' } });
  });
});
