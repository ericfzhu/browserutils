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
      if (keys === null || keys === undefined) return structuredClone(store);
      if (typeof keys === 'string') return structuredClone({ [keys]: store[keys] });
      if (Array.isArray(keys)) {
        return keys.reduce<Record<string, unknown>>((result, key) => {
          result[key] = structuredClone(store[key]);
          return result;
        }, {});
      }
      return Object.keys(keys).reduce<Record<string, unknown>>((result, key) => {
        result[key] = store[key] ?? keys[key];
        return result;
      }, {});
    }),
    set: vi.fn(async (items: Record<string, unknown>) => Object.assign(store, structuredClone(items))),
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
  let sessionStore: Record<string, any>;
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
    sessionStore = {};
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

  async function send(message: Record<string, unknown>, sender: chrome.runtime.MessageSender = {}): Promise<any> {
    const listener = runtimeMessage.listeners[0];
    return new Promise(resolve => {
      listener(message, sender, resolve);
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

  function seedTracking() {
    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now);
    const tab = { id: 1, windowId: 10, active: true, url: 'https://example.com/' } as chrome.tabs.Tab;
    vi.mocked(chrome.tabs.get).mockResolvedValue(tab);
    vi.mocked(chrome.windows.get).mockResolvedValue({ id: 10, focused: true, state: 'normal' } as chrome.windows.Window);
    sessionStore.activeSessions = {
      1: { tabId: 1, windowId: 10, domain: 'example.com', startTime: now - 60_000,
        lastActiveTime: now - 5_000, visitRecorded: false },
    };
    return { now, tab };
  }

  function holdSessionRead(key = 'activeSessions') {
    let release!: () => void;
    let entered!: () => void;
    const blocked = new Promise<void>(resolve => { release = resolve; });
    const started = new Promise<void>(resolve => { entered = resolve; });
    const get = vi.mocked(chrome.storage.session.get);
    const original = get.getMockImplementation() as unknown as (keys: unknown) => Promise<Record<string, unknown>>;
    let held = false;
    get.mockImplementation(async (keys: any) => {
      const snapshot = await original(keys) as any;
      if (keys === key && !held) {
        held = true;
        entered();
        await blocked;
      }
      return snapshot;
    });
    return { release, started };
  }

  function emit(source: unknown, ...args: unknown[]): Promise<void> {
    return (source as ReturnType<typeof event>).listeners[0](...args);
  }

  function history() {
    return Object.entries(localStore)
      .filter(([key]) => key.startsWith('dailyStats:'))
      .map(([, value]) => value as { totalTime: number; visits: number });
  }

  it.each(['heartbeat', 'checkpoint'])('does not revive a closed session after an in-flight %s', async kind => {
    const { tab } = seedTracking();
    const gate = holdSessionRead();
    const running = kind === 'heartbeat'
      ? send({ type: 'HEARTBEAT' }, { tab })
      : emit(chrome.alarms.onAlarm, { name: 'saveSession' });
    await gate.started;
    const closing = emit(chrome.tabs.onRemoved, 1);
    // Let the competing handler reach storage if it is incorrectly unqueued.
    await new Promise(resolve => setTimeout(resolve, 0));
    gate.release();
    await Promise.all([running, closing]);
    expect(sessionStore.activeSessions).toEqual({});
    expect(history().reduce((sum, day) => sum + day.visits, 0)).toBe(1);
    expect(history().reduce((sum, day) => sum + day.totalTime, 0)).toBe(60);
  });

  it('preserves checkpoint progress when a heartbeat arrives during a save', async () => {
    const { tab, now } = seedTracking();
    const gate = holdSessionRead();
    const saving = emit(chrome.alarms.onAlarm, { name: 'saveSession' });
    await gate.started;
    const heartbeat = send({ type: 'HEARTBEAT' }, { tab });
    await new Promise(resolve => setTimeout(resolve, 0));
    gate.release();
    await Promise.all([saving, heartbeat]);
    expect(sessionStore.activeSessions[1]).toMatchObject({
      startTime: now - 5_000, lastActiveTime: now, visitRecorded: true,
    });
    await emit(chrome.tabs.onRemoved, 1);
    expect(history().reduce((sum, day) => sum + day.visits, 0)).toBe(1);
    expect(history().reduce((sum, day) => sum + day.totalTime, 0)).toBe(60);
  });

  it('finishes an in-flight heartbeat before transferring activity to a newly activated tab', async () => {
    const { tab } = seedTracking();
    const gate = holdSessionRead();
    const heartbeat = send({ type: 'HEARTBEAT' }, { tab });
    await gate.started;
    const nextTab = { ...tab, id: 2, url: 'https://next.example/' };
    vi.mocked(chrome.tabs.get).mockImplementation(async id => id === 2 ? nextTab : { ...tab, active: false });
    const switching = emit(chrome.tabs.onActivated, { tabId: 2, windowId: 10 });
    await new Promise(resolve => setTimeout(resolve, 0));
    gate.release();
    await Promise.all([heartbeat, switching]);
    expect(Object.keys(sessionStore.activeSessions)).toEqual(['2']);
    expect(sessionStore.activeSessions[2].domain).toBe('next.example');
    // A late sender snapshot still claims tab 1 is active; current Chrome state wins.
    await send({ type: 'HEARTBEAT' }, { tab });
    expect(Object.keys(sessionStore.activeSessions)).toEqual(['2']);
  });

  it('does not restore state after tracking is disabled during a heartbeat', async () => {
    const { tab } = seedTracking();
    const gate = holdSessionRead();
    const heartbeat = send({ type: 'HEARTBEAT' }, { tab });
    await gate.started;
    const disabling = send({ type: 'UPDATE_SETTINGS', payload: { trackingEnabled: false } });
    await new Promise(resolve => setTimeout(resolve, 0));
    gate.release();
    await Promise.all([heartbeat, disabling]);
    await send({ type: 'HEARTBEAT' }, { tab });
    expect(sessionStore.activeSessions).toEqual({});
    expect(history().reduce((sum, day) => sum + day.visits, 0)).toBe(1);
  });

  it('does not revive playback when a tab closes during a channel update', async () => {
    const { tab, now } = seedTracking();
    (localStore.settings as any).youtubeTrackingEnabled = true;
    const youtubeTab = { ...tab, url: 'https://www.youtube.com/watch?v=video' };
    vi.mocked(chrome.tabs.get).mockResolvedValue(youtubeTab);
    sessionStore.activeYouTubeSessions = {
      1: { tabId: 1, windowId: 10, channelName: 'Example', startTime: now - 60_000, lastActiveTime: now - 5_000 },
    };
    const gate = holdSessionRead('activeYouTubeSessions');
    const updating = send({ type: 'YOUTUBE_CHANNEL_UPDATE', payload: {
      channelName: 'Example', url: youtubeTab.url, timestamp: now,
    } }, { tab: youtubeTab });
    await gate.started;
    const closing = emit(chrome.tabs.onRemoved, 1);
    await new Promise(resolve => setTimeout(resolve, 0));
    gate.release();
    await Promise.all([updating, closing]);
    expect(sessionStore.activeYouTubeSessions).toEqual({});
    vi.mocked(chrome.tabs.get).mockRejectedValue(new Error('Tab closed'));
    await send({ type: 'YOUTUBE_CHANNEL_UPDATE', payload: { channelName: 'Example' } }, { tab: youtubeTab });
    expect(sessionStore.activeYouTubeSessions).toEqual({});
  });

  it('continues processing transitions after a Chrome API failure', async () => {
    seedTracking();
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.mocked(chrome.storage.session.get).mockRejectedValueOnce(new Error('Temporary read failure'));
    await emit(chrome.alarms.onAlarm, { name: 'saveSession' });
    await emit(chrome.tabs.onRemoved, 1);
    expect(log).toHaveBeenCalledWith('[Tracking] alarm failed', expect.any(Error));
    expect(sessionStore.activeSessions).toEqual({});
  });


  it.each(['focus loss', 'idle'])('finishes a heartbeat before ending activity on %s', async reason => {
    const { tab } = seedTracking();
    const gate = holdSessionRead();
    const heartbeat = send({ type: 'HEARTBEAT' }, { tab });
    await gate.started;
    const ending = reason === 'idle'
      ? emit(chrome.idle.onStateChanged, 'idle')
      : emit(chrome.windows.onFocusChanged, chrome.windows.WINDOW_ID_NONE);
    await new Promise(resolve => setTimeout(resolve, 0));
    gate.release();
    await Promise.all([heartbeat, ending]);
    expect(sessionStore.activeSessions).toEqual({});
    expect(history().reduce((sum, day) => sum + day.visits, 0)).toBe(1);
  });

  it('does not write old activity back after clearing data during a checkpoint', async () => {
    seedTracking();
    const gate = holdSessionRead();
    const checkpoint = emit(chrome.alarms.onAlarm, { name: 'saveSession' });
    await gate.started;
    const clearing = send({ type: 'CLEAR_ALL_DATA' });
    await new Promise(resolve => setTimeout(resolve, 0));
    gate.release();
    await Promise.all([checkpoint, clearing]);
    expect(Object.keys(sessionStore.activeSessions ?? {})).toHaveLength(0);
    expect(history()).toEqual([]);
  });

  it('counts one visit when two checkpoint alarms overlap', async () => {
    const { now } = seedTracking();
    const gate = holdSessionRead();
    const first = emit(chrome.alarms.onAlarm, { name: 'saveSession' });
    await gate.started;
    const second = emit(chrome.alarms.onAlarm, { name: 'saveSession' });
    await new Promise(resolve => setTimeout(resolve, 0));
    gate.release();
    await Promise.all([first, second]);
    expect(sessionStore.activeSessions[1]).toMatchObject({ startTime: now - 5_000, visitRecorded: true });
    expect(history().reduce((sum, day) => sum + day.visits, 0)).toBe(1);
    expect(history().reduce((sum, day) => sum + day.totalTime, 0)).toBe(55);
  });

  it('ignores sender snapshots from a document that has navigated away', async () => {
    const { tab } = seedTracking();
    sessionStore.activeSessions = {};
    vi.mocked(chrome.tabs.get).mockResolvedValue({ ...tab, url: 'https://next.example/' });
    await send({ type: 'CONTENT_SCRIPT_READY', payload: { visible: true, url: tab.url, timestamp: Date.now() } }, { tab });
    expect(sessionStore.activeSessions).toEqual({});
  });


  it('returns only the two tracking flags to content scripts', async () => {
    await expect(send({ type: 'GET_TRACKING_STATE' })).resolves.toEqual({
      trackingEnabled: true, youtubeTrackingEnabled: false,
    });
  });

  it('broadcasts tracking preferences to open tabs, tolerating missing content scripts', async () => {
    vi.mocked(chrome.tabs.query).mockResolvedValue([{ id: 1 }, { id: 2 }] as chrome.tabs.Tab[]);
    vi.mocked(chrome.tabs.sendMessage).mockRejectedValueOnce(new Error('No receiving end'));
    const result = await send({ type: 'UPDATE_SETTINGS', payload: { trackingEnabled: false } });
    expect(result.trackingEnabled).toBe(false);
    expect(chrome.tabs.sendMessage).toHaveBeenCalledTimes(2);
    expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(2, {
      type: 'TRACKING_STATE_CHANGED',
      payload: { trackingEnabled: false, youtubeTrackingEnabled: false },
    }, { frameId: 0 });
    vi.mocked(chrome.tabs.sendMessage).mockClear();
    await send({ type: 'UPDATE_SETTINGS', payload: { theme: 'dark' } });
    expect(chrome.tabs.sendMessage).not.toHaveBeenCalled();
  });

  it('publishes restored tracking defaults after clearing data', async () => {
    await send({ type: 'UPDATE_SETTINGS', payload: { trackingEnabled: false } });
    vi.mocked(chrome.tabs.query).mockResolvedValue([{ id: 1 }] as chrome.tabs.Tab[]);
    await send({ type: 'CLEAR_ALL_DATA' });
    const restored = await send({ type: 'GET_TRACKING_STATE' });
    expect(restored.trackingEnabled).toBe(true);
    expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(1, {
      type: 'TRACKING_STATE_CHANGED', payload: restored,
    }, { frameId: 0 });
  });

});
