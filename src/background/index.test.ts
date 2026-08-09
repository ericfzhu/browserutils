import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type Listener = (...args: any[]) => any;

function event() {
  const listeners: Listener[] = [];
  return {
    listeners,
    addListener: vi.fn((listener: Listener) => listeners.push(listener)),
  };
}

function storageArea(store: Record<string, unknown>) {
  return {
    QUOTA_BYTES: 10 * 1024 * 1024,
    get: vi.fn(async (keys?: null | string | string[] | Record<string, unknown>) => {
      if (keys === null || keys === undefined) return { ...store };
      if (typeof keys === 'string') return { [keys]: store[keys] };
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
    set: vi.fn(async (items: Record<string, unknown>) => Object.assign(store, items)),
    remove: vi.fn(async (keys: string | string[]) => {
      for (const key of Array.isArray(keys) ? keys : [keys]) delete store[key];
    }),
    clear: vi.fn(async () => {
      for (const key of Object.keys(store)) delete store[key];
    }),
    getBytesInUse: vi.fn(async () => 2048),
    setAccessLevel: vi.fn(async () => undefined),
  };
}

describe('background service worker integration', () => {
  let localStore: Record<string, unknown>;
  let runtimeMessage: ReturnType<typeof event>;
  let updateDynamicRules: ReturnType<typeof vi.fn>;
  let downloadsDownload: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.resetModules();
    localStore = {
      settings: {
        trackingEnabled: true,
        blockingEnabled: true,
        youtubeTrackingEnabled: false,
        forcePasteEnabled: false,
        blobVideoDownloaderEnabled: false,
        theme: 'system',
        colorTheme: 'monochrome',
        retentionDays: 30,
        idleThreshold: 60,
        categoryOrder: [],
      },
      blockedSites: [],
      blockedSiteFolders: [],
      dailyLimits: [],
      storageSchemaVersion: 2,
    };
    const sessionStore: Record<string, unknown> = {};
    runtimeMessage = event();
    updateDynamicRules = vi.fn(async () => undefined);
    downloadsDownload = vi.fn(async () => 1);

    vi.stubGlobal('chrome', {
      runtime: {
        getURL: (path: string) => `chrome-extension://test-extension/${path}`,
        onInstalled: event(),
        onMessage: runtimeMessage,
      },
      storage: {
        local: storageArea(localStore),
        session: storageArea(sessionStore),
      },
      declarativeNetRequest: {
        RuleActionType: { REDIRECT: 'redirect' },
        ResourceType: { MAIN_FRAME: 'main_frame' },
        getDynamicRules: vi.fn(async () => [{ id: 99 }]),
        updateDynamicRules,
      },
      scripting: {
        getRegisteredContentScripts: vi.fn(async () => []),
        registerContentScripts: vi.fn(async () => undefined),
        unregisterContentScripts: vi.fn(async () => undefined),
        executeScript: vi.fn(async () => []),
      },
      idle: {
        setDetectionInterval: vi.fn(),
        onStateChanged: event(),
      },
      tabs: {
        get: vi.fn(async () => { throw new Error('No tab'); }),
        query: vi.fn(async () => []),
        update: vi.fn(async () => undefined),
        sendMessage: vi.fn(async () => undefined),
        onActivated: event(),
        onRemoved: event(),
        onUpdated: event(),
      },
      windows: {
        WINDOW_ID_NONE: -1,
        get: vi.fn(async () => ({ focused: false, state: 'normal' })),
        getAll: vi.fn(async () => []),
        getLastFocused: vi.fn(async () => ({ focused: false, state: 'normal' })),
        onFocusChanged: event(),
      },
      webNavigation: {
        getAllFrames: vi.fn(async () => []),
        onBeforeNavigate: event(),
      },
      alarms: {
        create: vi.fn(async () => undefined),
        onAlarm: event(),
      },
      downloads: { download: downloadsDownload },
    });

    await import('./index');
    await new Promise(resolve => setTimeout(resolve, 0));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  async function send(message: Record<string, unknown>): Promise<any> {
    const listener = runtimeMessage.listeners[0];
    return new Promise(resolve => {
      listener(message, {}, resolve);
    });
  }

  it('updates overlapping blocking rules atomically and resolves the active match', async () => {
    const now = Date.now();
    const sites = [
      {
        id: 'inactive',
        pattern: 'example.com',
        enabled: true,
        unlockType: 'timer',
        timerBlockedUntil: now - 1000,
        createdAt: now,
      },
      {
        id: 'active',
        pattern: '*.example.com',
        enabled: true,
        unlockType: 'none',
        createdAt: now,
      },
    ];

    await expect(send({ type: 'UPDATE_BLOCKED_SITES', payload: sites })).resolves.toEqual({ success: true });
    const calls = updateDynamicRules.mock.calls;
    const update = calls[calls.length - 1]?.[0];
    expect(update.removeRuleIds).toEqual([99]);
    expect(update.addRules).toHaveLength(1);
    expect(update.addRules[0].action.redirect.regexSubstitution).toContain('&returnUrl=\\0');

    const result = await send({ type: 'CHECK_SITE', payload: { url: 'https://example.com/path' } });
    expect(result.blocked).toBe(true);
    expect(result.site.id).toBe('active');
  });

  it('reports storage usage through the registered message channel', async () => {
    await expect(send({ type: 'GET_STORAGE_USAGE' })).resolves.toEqual({
      bytesInUse: 2048,
      quotaBytes: 10 * 1024 * 1024,
    });
  });

  it('turns rejected Chrome operations into explicit failure responses', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    downloadsDownload.mockRejectedValueOnce(new Error('Download unavailable'));
    await expect(send({
      type: 'DOWNLOAD_URL',
      payload: { url: 'https://example.com/file.mp4' },
    })).resolves.toEqual({ success: false, error: 'Download unavailable' });
    expect(consoleError).toHaveBeenCalledWith(
      '[Message] DOWNLOAD_URL failed',
      expect.any(Error)
    );
  });
});
