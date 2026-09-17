import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TrackingState } from '../shared/types';

function target() {
  const listeners = new Map<string, Set<(event?: unknown) => void>>();
  return {
    addEventListener(type: string, fn: (event?: unknown) => void) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(fn);
    },
    removeEventListener(type: string, fn: (event?: unknown) => void) { listeners.get(type)?.delete(fn); },
    dispatch(type: string, event?: unknown) { for (const fn of [...(listeners.get(type) ?? [])]) fn(event); },
    count: () => [...listeners.values()].reduce((n, set) => n + set.size, 0),
  };
}

describe('content tracking lifecycle', () => {
  let state: TrackingState;
  let page: ReturnType<typeof target> & { hidden: boolean; querySelector: ReturnType<typeof vi.fn> };
  let video: ReturnType<typeof target> & { paused: boolean; ended: boolean; matches: () => boolean };
  let browserWindow: ReturnType<typeof target> & { location: { hostname: string; pathname: string; href: string; replace: ReturnType<typeof vi.fn> } };
  let send: ReturnType<typeof vi.fn>;
  let listeners: Set<(message: unknown) => void>;
  const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
  const messages = (type: string) => send.mock.calls.filter(([m]) => m.type === type);
  async function load() { await import('./index'); await flush(); }
  function configure(next: TrackingState) {
    state = next;
    for (const listener of listeners) listener({ type: 'TRACKING_STATE_CHANGED', payload: next });
  }
  function youtube(hidden = false, playing = false) {
    Object.assign(browserWindow.location, { hostname: 'www.youtube.com', pathname: '/watch', href: 'https://www.youtube.com/watch?v=one' });
    page.hidden = hidden;
    video.paused = !playing;
  }

  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    state = { trackingEnabled: false, youtubeTrackingEnabled: false };
    listeners = new Set();
    video = { ...target(), paused: true, ended: false, matches: () => true };
    page = { ...target(), hidden: false, querySelector: vi.fn((selector: string) => selector.startsWith('video') ? video : { href: 'https://www.youtube.com/@example' }) };
    browserWindow = { ...target(), location: { hostname: 'example.com', pathname: '/', href: 'https://example.com/', replace: vi.fn() } };
    send = vi.fn(async message => message.type === 'GET_TRACKING_STATE' ? { ...state } : { blocked: false });
    vi.stubGlobal('document', page);
    vi.stubGlobal('window', { ...browserWindow, setInterval, clearInterval, setTimeout, clearTimeout });
    vi.stubGlobal('navigator', { mediaSession: { metadata: { artist: 'Example' } } });
    vi.stubGlobal('chrome', { runtime: { sendMessage: send, onMessage: {
      addListener: (listener: (m: unknown) => void) => listeners.add(listener),
      removeListener: (listener: (m: unknown) => void) => listeners.delete(listener),
    } } });
  });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); });

  it('keeps blocking checks but has no tracking timers, DOM queries or page listeners while disabled', async () => {
    youtube(false, true);
    await load();
    await vi.advanceTimersByTimeAsync(600_000);
    expect(messages('CHECK_SITE_WITH_REDIRECT')).toHaveLength(1);
    expect(messages('HEARTBEAT')).toHaveLength(0);
    expect(messages('YOUTUBE_CHANNEL_UPDATE')).toHaveLength(0);
    expect(page.querySelector).not.toHaveBeenCalled();
    expect(page.count() + browserWindow.count() + video.count()).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
    expect(listeners.size).toBe(1);
  });

  it('responds to enable/disable changes in an already open page without duplicate timers', async () => {
    await load();
    configure({ trackingEnabled: true, youtubeTrackingEnabled: false });
    configure(state);
    expect(vi.getTimerCount()).toBe(1);
    send.mockClear();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(messages('HEARTBEAT')).toHaveLength(4);
    configure({ trackingEnabled: false, youtubeTrackingEnabled: false });
    send.mockClear();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(send).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('tracks background playback with general tracking disabled, stopping on pause and resuming on play', async () => {
    youtube(true, true);
    state.youtubeTrackingEnabled = true;
    await load();
    await vi.advanceTimersByTimeAsync(5_000);
    send.mockClear();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(messages('YOUTUBE_CHANNEL_UPDATE')).toHaveLength(4);
    expect(messages('HEARTBEAT')).toHaveLength(0);
    video.paused = true;
    video.dispatch('pause');
    expect(messages('YOUTUBE_VISIBILITY_CHANGE')).toHaveLength(1);
    expect(vi.getTimerCount()).toBe(0);
    send.mockClear();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(send).not.toHaveBeenCalled();
    video.paused = false;
    video.dispatch('play');
    expect(vi.getTimerCount()).toBe(1);
    expect(messages('YOUTUBE_CHANNEL_UPDATE')).toHaveLength(1);
  });

  it('removes navigation/video listeners and pending retries when disabled', async () => {
    youtube();
    state.youtubeTrackingEnabled = true;
    await load();
    browserWindow.dispatch('popstate');
    configure({ trackingEnabled: false, youtubeTrackingEnabled: false });
    page.querySelector.mockClear();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(vi.getTimerCount()).toBe(0);
    expect(page.querySelector).not.toHaveBeenCalled();
    expect(page.count() + browserWindow.count() + video.count()).toBe(0);
    configure({ trackingEnabled: false, youtubeTrackingEnabled: true });
    expect(video.count()).toBe(3);
  });

  it('detaches the previous video during SPA navigation', async () => {
    youtube(false, true);
    state.youtubeTrackingEnabled = true;
    await load();
    const oldVideo = video;
    video = { ...target(), paused: false, ended: false, matches: () => true };
    page.dispatch('yt-navigate-finish');
    expect(oldVideo.count()).toBe(0);
    await vi.advanceTimersByTimeAsync(500);
    expect(video.count()).toBe(3);
    send.mockClear();
    oldVideo.dispatch('pause');
    expect(send).not.toHaveBeenCalled();
  });

  it('discovers a late video playing in a hidden tab without keeping a poll running', async () => {
    youtube(true);
    state.youtubeTrackingEnabled = true;
    page.querySelector.mockReturnValue(null);
    await load();
    await vi.advanceTimersByTimeAsync(5_000);
    expect(vi.getTimerCount()).toBe(0);
    page.querySelector.mockImplementation((selector: string) => selector.startsWith('video') ? video : null);
    video.paused = false;
    page.dispatch('play', { target: video });
    expect(messages('YOUTUBE_CHANNEL_UPDATE')).toHaveLength(1);
    expect(vi.getTimerCount()).toBe(1);
  });

  it('keeps a newer settings broadcast when the initial response arrives late', async () => {
    let resolve!: (value: TrackingState) => void;
    send.mockImplementation(async message => message.type === 'GET_TRACKING_STATE'
      ? new Promise<TrackingState>(done => { resolve = done; }) : { blocked: false });
    await load();
    configure({ trackingEnabled: false, youtubeTrackingEnabled: false });
    resolve({ trackingEnabled: true, youtubeTrackingEnabled: true });
    await flush();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('cleans up after rejected runtime messages without recursively sending more messages', async () => {
    state.trackingEnabled = true;
    await load();
    send.mockRejectedValue(new Error('Extension context invalidated'));
    await vi.advanceTimersByTimeAsync(15_000);
    expect(vi.getTimerCount()).toBe(0);
    expect(listeners.size).toBe(0);
    expect(page.count()).toBe(0);
  });

  it('does not query YouTube metadata when only general browsing tracking is enabled', async () => {
    youtube(false, true);
    state.trackingEnabled = true;
    await load();
    send.mockClear();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(messages('HEARTBEAT')).toHaveLength(4);
    expect(messages('YOUTUBE_CHANNEL_UPDATE')).toHaveLength(0);
    expect(page.querySelector).not.toHaveBeenCalled();
    expect(video.count()).toBe(0);
    page.hidden = true;
    page.dispatch('visibilitychange');
    expect(vi.getTimerCount()).toBe(0);
    page.hidden = false;
    page.dispatch('visibilitychange');
    expect(vi.getTimerCount()).toBe(1);
  });

  it('redirects a blocked page without initializing tracking', async () => {
    send.mockResolvedValue({ blocked: true, redirectUrl: 'chrome-extension://extension/blocked.html' });
    await load();
    expect(browserWindow.location.replace).toHaveBeenCalledWith('chrome-extension://extension/blocked.html');
    expect(messages('GET_TRACKING_STATE')).toHaveLength(0);
    expect(vi.getTimerCount()).toBe(0);
    expect(listeners.size).toBe(0);
  });

});
