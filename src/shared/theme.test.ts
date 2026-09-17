import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

let dark = false;
let systemDark = false;
let systemListeners: Set<() => void>;
let storageListener: (changes: Record<string, unknown>, area: string) => void;
let readSettings: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.resetModules();
  dark = false;
  systemDark = false;
  systemListeners = new Set();
  vi.stubGlobal('document', { documentElement: {
    classList: { toggle: (_name: string, enabled: boolean) => { dark = enabled; } }, dataset: {},
  } });
  vi.stubGlobal('window', { matchMedia: () => ({
    matches: systemDark,
    addEventListener: (_event: string, listener: () => void) => systemListeners.add(listener),
    removeEventListener: (_event: string, listener: () => void) => systemListeners.delete(listener),
  }) });
  readSettings = vi.fn().mockResolvedValue({ settings: { theme: 'light', colorTheme: 'blue' } });
  vi.stubGlobal('chrome', { storage: {
    local: { get: readSettings },
    onChanged: { addListener: (listener: typeof storageListener) => { storageListener = listener; } },
  } });
});
afterEach(() => vi.unstubAllGlobals());

describe('theme lifecycle', () => {
  it('starts watching when switching from explicit light to system and removes the listener for explicit dark', async () => {
    const { initTheme, applyTheme } = await import('./theme');
    await initTheme();
    expect(systemListeners.size).toBe(0);
    applyTheme('system', 'blue');
    systemDark = true;
    systemListeners.forEach(listener => listener());
    expect(dark).toBe(true);
    expect(document.documentElement.dataset.colorTheme).toBe('blue');
    applyTheme('dark');
    expect(systemListeners.size).toBe(0);
  });
  it('updates open pages on settings changes and restores defaults after data clearing', async () => {
    const { initTheme } = await import('./theme');
    await initTheme();
    storageListener({ settings: { newValue: { theme: 'dark', colorTheme: 'blue' } } }, 'local');
    expect(dark).toBe(true);
    storageListener({ settings: { newValue: undefined } }, 'local');
    expect(dark).toBe(false);
    expect(document.documentElement.dataset.colorTheme).toBe('monochrome');
    expect(systemListeners.size).toBe(1);
  });
  it('does not overwrite a newer storage event with an old initial read', async () => {
    let resolve!: (value: unknown) => void;
    readSettings.mockReturnValue(new Promise(done => { resolve = done; }));
    const { initTheme } = await import('./theme');
    const loading = initTheme();
    storageListener({ settings: { newValue: { theme: 'dark', colorTheme: 'blue' } } }, 'local');
    resolve({ settings: { theme: 'light' } });
    await loading;
    expect(dark).toBe(true);
  });
});
