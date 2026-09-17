import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { getAllDailyStatsSummary, deleteHistoryRange, recordSession, pruneDailyStats, SUMMARY_DATES_KEY } from './storage';
let store: Record<string, any>;
beforeEach(() => {
  store = { storageSchemaVersion: 2 };
  vi.stubGlobal('chrome', { storage: { local: {
    get: vi.fn(async (keys: null | string | string[]) => structuredClone(keys === null ? store : Object.fromEntries((Array.isArray(keys) ? keys : [keys]).map(key => [key, store[key]])))),
    set: vi.fn(async (items: Record<string, unknown>) => { Object.assign(store, structuredClone(items)); }),
    remove: vi.fn(async (keys: string | string[]) => { for (const key of Array.isArray(keys) ? keys : [keys]) delete store[key]; }),
  } } });
});
afterEach(() => vi.unstubAllGlobals());
const session = (day: string) => ({ domain: 'example.com', startTime: new Date(`${day}T12:00:00`).getTime(), endTime: new Date(`${day}T12:01:00`).getTime(), windowId: 1 });
it('reads only summary keys once built and updates summaries alongside source days', async () => {
  await recordSession(session('2026-09-17'));
  expect((await getAllDailyStatsSummary())['2026-09-17'].totalTime).toBe(60);
  vi.mocked(chrome.storage.local.get).mockClear();
  await getAllDailyStatsSummary();
  expect(chrome.storage.local.get).not.toHaveBeenCalledWith(null);
  expect(chrome.storage.local.get).toHaveBeenCalledWith(SUMMARY_DATES_KEY);
  await recordSession(session('2026-09-18'));
  const summaries = await getAllDailyStatsSummary();
  expect(Object.keys(summaries)).toHaveLength(2);
  expect(summaries['2026-09-18']).toMatchObject({ totalTime: 60, visits: 1 });
  const calls = vi.mocked(chrome.storage.local.set).mock.calls;
  const write = calls[calls.length - 1][0];
  expect(write).toHaveProperty('dailyStats:2026-09-18');
  expect(write).toHaveProperty('dailyStatsSummary:2026-09-18');
});
it('rebuilds after retention without returning deleted dates', async () => {
  await recordSession(session('2026-09-17'));
  await recordSession(session('2026-09-18'));
  await getAllDailyStatsSummary();
  await pruneDailyStats('2026-09-18');
  expect(Object.keys(await getAllDailyStatsSummary())).toEqual(['2026-09-18']);
});
it('serializes first-time summary creation with concurrent history writes', async () => {
  await Promise.all([getAllDailyStatsSummary(), recordSession(session('2026-09-18'))]);
  expect((await getAllDailyStatsSummary())['2026-09-18'].totalTime).toBe(60);
});

it('deletes only selected local dates and invalidates summaries without touching settings', async () => {
  store.settings = { trackingEnabled: true };
  await recordSession(session('2026-09-17'));
  await recordSession(session('2026-09-18'));
  await getAllDailyStatsSummary();
  expect(await deleteHistoryRange('2026-09-18', '2026-09-18')).toBe(1);
  expect(Object.keys(await getAllDailyStatsSummary())).toEqual(['2026-09-17']);
  expect(store.settings).toEqual({ trackingEnabled: true });
});
