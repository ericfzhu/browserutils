import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getLocalDateString } from './time';
import { mergeIntervals, matchesPattern, computeStatsFromCompactSessions, getDailyStats, recordSession } from './storage';

describe('mergeIntervals', () => {
  it('returns empty result for empty input', () => {
    const result = mergeIntervals([]);
    expect(result.merged).toEqual([]);
    expect(result.totalSeconds).toBe(0);
  });

  it('handles single interval', () => {
    const result = mergeIntervals([{ start: 0, end: 10000 }]);
    expect(result.merged).toEqual([{ start: 0, end: 10000 }]);
    expect(result.totalSeconds).toBe(10);
  });

  it('merges overlapping intervals', () => {
    const result = mergeIntervals([
      { start: 0, end: 10000 },
      { start: 5000, end: 15000 },
    ]);
    expect(result.merged).toEqual([{ start: 0, end: 15000 }]);
    expect(result.totalSeconds).toBe(15);
  });

  it('merges adjacent intervals', () => {
    const result = mergeIntervals([
      { start: 0, end: 10000 },
      { start: 10000, end: 20000 },
    ]);
    expect(result.merged).toEqual([{ start: 0, end: 20000 }]);
    expect(result.totalSeconds).toBe(20);
  });

  it('keeps non-overlapping intervals separate', () => {
    const result = mergeIntervals([
      { start: 0, end: 10000 },
      { start: 20000, end: 30000 },
    ]);
    expect(result.merged).toHaveLength(2);
    expect(result.totalSeconds).toBe(20);
  });

  it('handles unsorted input', () => {
    const result = mergeIntervals([
      { start: 20000, end: 30000 },
      { start: 0, end: 10000 },
    ]);
    expect(result.merged).toEqual([
      { start: 0, end: 10000 },
      { start: 20000, end: 30000 },
    ]);
    expect(result.totalSeconds).toBe(20);
  });

  it('handles nested intervals', () => {
    const result = mergeIntervals([
      { start: 0, end: 30000 },
      { start: 5000, end: 10000 },
      { start: 15000, end: 20000 },
    ]);
    expect(result.merged).toEqual([{ start: 0, end: 30000 }]);
    expect(result.totalSeconds).toBe(30);
  });

  it('handles seconds input correctly', () => {
    const result = mergeIntervals([{ start: 0, end: 100 }], true);
    expect(result.totalSeconds).toBe(100);
  });

  it('handles complex overlapping scenario', () => {
    const result = mergeIntervals([
      { start: 0, end: 10000 },
      { start: 5000, end: 20000 },
      { start: 15000, end: 25000 },
      { start: 30000, end: 40000 },
    ]);
    expect(result.merged).toEqual([
      { start: 0, end: 25000 },
      { start: 30000, end: 40000 },
    ]);
    expect(result.totalSeconds).toBe(35);
  });
});

describe('matchesPattern', () => {
  describe('exact domain matching', () => {
    it('matches exact domain', () => {
      expect(matchesPattern('https://example.com/', 'example.com')).toBe(true);
    });

    it('matches domain with www prefix', () => {
      expect(matchesPattern('https://www.example.com/', 'example.com')).toBe(true);
    });

    it('does not match different domain', () => {
      expect(matchesPattern('https://other.com/', 'example.com')).toBe(false);
    });

    it('does not match subdomain for exact pattern', () => {
      expect(matchesPattern('https://sub.example.com/', 'example.com')).toBe(false);
    });
  });

  describe('wildcard domain matching', () => {
    it('matches subdomain with wildcard', () => {
      expect(matchesPattern('https://sub.example.com/', '*.example.com')).toBe(true);
    });

    it('matches base domain with wildcard', () => {
      expect(matchesPattern('https://example.com/', '*.example.com')).toBe(true);
    });

    it('matches deep subdomain with wildcard', () => {
      expect(matchesPattern('https://deep.sub.example.com/', '*.example.com')).toBe(true);
    });

    it('does not match different domain with wildcard', () => {
      expect(matchesPattern('https://example.org/', '*.example.com')).toBe(false);
    });
  });

  describe('path matching', () => {
    it('matches exact path', () => {
      expect(matchesPattern('https://example.com/path', 'example.com/path')).toBe(true);
    });

    it('matches path with trailing slash', () => {
      expect(matchesPattern('https://example.com/path/', 'example.com/path')).toBe(true);
    });

    it('matches subpath of pattern', () => {
      expect(matchesPattern('https://example.com/path/subpath', 'example.com/path/*')).toBe(true);
    });

    it('does not match different path', () => {
      expect(matchesPattern('https://example.com/other', 'example.com/path/*')).toBe(false);
    });

    it('matches path without wildcard suffix', () => {
      expect(matchesPattern('https://reddit.com/r/funny/', 'reddit.com/r/funny')).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('returns false for invalid URL', () => {
      expect(matchesPattern('not-a-url', 'example.com')).toBe(false);
    });

    it('handles URL with query params', () => {
      expect(matchesPattern('https://example.com/path?query=1', 'example.com/path/*')).toBe(true);
    });

    it('handles URL with hash', () => {
      expect(matchesPattern('https://example.com/path#section', 'example.com/path/*')).toBe(true);
    });
  });
});

describe('computeStatsFromCompactSessions', () => {
  it('returns zero for empty sessions', () => {
    const result = computeStatsFromCompactSessions({});
    expect(result.totalTime).toBe(0);
    expect(result.sites).toEqual({});
  });

  it('calculates single domain correctly', () => {
    const result = computeStatsFromCompactSessions({
      'example.com': [[0, 100]],
    });
    expect(result.totalTime).toBe(100);
    expect(result.sites).toEqual({ 'example.com': 100 });
  });

  it('merges overlapping sessions for same domain', () => {
    const result = computeStatsFromCompactSessions({
      'example.com': [[0, 100], [50, 150]],
    });
    expect(result.sites['example.com']).toBe(150);
    expect(result.totalTime).toBe(150);
  });

  it('calculates multiple domains correctly', () => {
    const result = computeStatsFromCompactSessions({
      'example.com': [[0, 100]],
      'other.com': [[200, 300]],
    });
    expect(result.sites['example.com']).toBe(100);
    expect(result.sites['other.com']).toBe(100);
    expect(result.totalTime).toBe(200);
  });

  it('handles overlapping sessions across domains for total time', () => {
    // Both domains active at the same time should not double-count total
    const result = computeStatsFromCompactSessions({
      'example.com': [[0, 100]],
      'other.com': [[50, 150]],
    });
    expect(result.sites['example.com']).toBe(100);
    expect(result.sites['other.com']).toBe(100);
    expect(result.totalTime).toBe(150); // Merged: 0-150
  });
});

describe('recordSession', () => {
  let localStore: Record<string, unknown>;
  let sessionStore: Record<string, unknown>;

  function createStorageArea(store: Record<string, unknown>) {
    return {
      get: vi.fn(async (keys?: null | string | string[] | Record<string, unknown>) => {
        if (keys === null || keys === undefined) {
          return { ...store };
        }
        if (typeof keys === 'string') {
          return { [keys]: store[keys] };
        }
        if (Array.isArray(keys)) {
          return keys.reduce<Record<string, unknown>>((result, key) => {
            result[key] = store[key];
            return result;
          }, {});
        }
        return Object.keys(keys).reduce<Record<string, unknown>>((result, key) => {
          result[key] = store[key] ?? keys[key];
          return result;
        }, {});
      }),
      set: vi.fn(async (items: Record<string, unknown>) => {
        Object.assign(store, items);
      }),
      remove: vi.fn(async (keys: string | string[]) => {
        for (const key of Array.isArray(keys) ? keys : [keys]) {
          delete store[key];
        }
      }),
    };
  }

  beforeEach(() => {
    localStore = {};
    sessionStore = {};
    vi.stubGlobal('chrome', {
      storage: {
        local: createStorageArea(localStore),
        session: createStorageArea(sessionStore),
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('compacts adjacent chunks and counts one visit per logical session', async () => {
    const startTime = new Date('2026-06-22T10:00:00').getTime();

    await recordSession({
      domain: 'example.com',
      startTime,
      endTime: startTime + 60_000,
      windowId: 1,
    }, {
      countVisit: true,
    });
    await recordSession({
      domain: 'example.com',
      startTime: startTime + 60_000,
      endTime: startTime + 120_000,
      windowId: 1,
    }, {
      countVisit: false,
    });

    const stats = await getDailyStats(getLocalDateString(new Date(startTime)));

    expect(stats.visits).toBe(1);
    expect(stats.totalTime).toBe(120);
    expect(stats.sites['example.com']).toBe(120);
    expect(stats.sessions['example.com']).toEqual([
      [Math.floor(startTime / 1000), Math.floor((startTime + 120_000) / 1000)],
    ]);
  });
});
