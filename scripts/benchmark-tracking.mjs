// Deterministic operation counts for the real bundled content script. This is
// simulated elapsed time, not a CPU/battery benchmark or Chrome throttling model.
import { build } from 'esbuild';
import vm from 'node:vm';
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';

const { outputFiles } = await build({ entryPoints: ['src/content/index.ts'], bundle: true, write: false, format: 'iife' });
const code = outputFiles[0].text;
const scenarios = [
  { name: 'disabled-visible', trackingEnabled: false, youtubeTrackingEnabled: false },
  { name: 'enabled-visible', trackingEnabled: true, youtubeTrackingEnabled: false },
  { name: 'disabled-youtube-playing', youtube: true, playing: true, trackingEnabled: false, youtubeTrackingEnabled: false },
  { name: 'youtube-paused-hidden', youtube: true, hidden: true, trackingEnabled: false, youtubeTrackingEnabled: true },
  { name: 'youtube-playing-hidden', youtube: true, hidden: true, playing: true, trackingEnabled: false, youtubeTrackingEnabled: true },
  { name: 'youtube-playing-visible', youtube: true, playing: true, trackingEnabled: true, youtubeTrackingEnabled: true },
];

async function measure(scenario) {
  let time = 0;
  let nextId = 0;
  let callbacks = 0;
  let queries = 0;
  const messages = {};
  const timers = new Map();
  const targets = [];
  function target() {
    const listeners = new Map();
    const result = {
      addEventListener(type, fn) {
        if (!listeners.has(type)) listeners.set(type, new Set());
        listeners.get(type).add(fn);
      },
      removeEventListener(type, fn) { listeners.get(type)?.delete(fn); },
      dispatch(type) { for (const fn of [...(listeners.get(type) ?? [])]) fn(); },
      count: () => [...listeners.values()].reduce((n, set) => n + set.size, 0),
    };
    targets.push(result);
    return result;
  }
  const schedule = (fn, delay, repeat = false) => {
    const id = ++nextId;
    timers.set(id, { fn, at: time + delay, delay, repeat });
    return id;
  };
  const video = Object.assign(target(), { paused: !scenario.playing, ended: false });
  const location = { hostname: scenario.youtube ? 'www.youtube.com' : 'example.com', pathname: scenario.youtube ? '/watch' : '/', href: scenario.youtube ? 'https://www.youtube.com/watch?v=example' : 'https://example.com/', replace() {} };
  const document = Object.assign(target(), {
    hidden: false,
    querySelector(selector) {
      queries++;
      return selector.startsWith('video') ? video : { href: 'https://www.youtube.com/@example', textContent: 'Example', getAttribute: () => '/@example' };
    },
  });
  const window = Object.assign(target(), { location,
    setInterval: (fn, delay) => schedule(fn, delay, true),
    setTimeout: (fn, delay) => schedule(fn, delay),
    clearInterval: id => timers.delete(id), clearTimeout: id => timers.delete(id),
  });
  const runtimeListeners = new Set();
  const context = vm.createContext({ window, document,
    navigator: { mediaSession: { metadata: { artist: 'Example' } } },
    console: { log() {}, error() {}, warn() {} },
    Date: class extends Date { static now() { return time; } },
    setTimeout: window.setTimeout, clearTimeout: window.clearTimeout,
    setInterval: window.setInterval, clearInterval: window.clearInterval,
    chrome: { runtime: {
      onMessage: { addListener: fn => runtimeListeners.add(fn), removeListener: fn => runtimeListeners.delete(fn) },
      async sendMessage(message) {
        messages[message.type] = (messages[message.type] ?? 0) + 1;
        if (message.type === 'GET_TRACKING_STATE') return { trackingEnabled: scenario.trackingEnabled, youtubeTrackingEnabled: scenario.youtubeTrackingEnabled };
        return { blocked: false };
      },
    } },
  });
  const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
  async function advance(end) {
    while (true) {
      const next = [...timers.entries()].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
      if (!next) break;
      const [id, timer] = next;
      time = timer.at;
      if (timer.repeat) timer.at += timer.delay;
      else timers.delete(id);
      callbacks++;
      timer.fn();
      await flush();
    }
    time = end;
  }
  vm.runInContext(code, context);
  await flush();
  await advance(5_000);
  if (scenario.hidden) {
    document.hidden = true;
    document.dispatch('visibilitychange');
    await flush();
  }
  const setupMessages = { ...messages };
  for (const key of Object.keys(messages)) delete messages[key];
  callbacks = 0;
  queries = 0;
  await advance(605_000);
  return { scenario: scenario.name, timerCallbacks: callbacks, domQueries: queries, messages: { ...messages }, pageListeners: targets.reduce((n, t) => n + t.count(), 0), runtimeListeners: runtimeListeners.size, activeTimers: timers.size, setupMessages };
}
const report = {
  sourceSha256: createHash('sha256').update(code).digest('hex'),
  simulatedSeconds: 600, warmupSeconds: 5,
  methodology: 'Bundled production content code in a VM with deterministic timers, mocked DOM and Chrome runtime. Hidden scenarios transition to hidden after warmup. No real CPU, power or Chrome scheduling measurements.',
  results: await Promise.all(scenarios.map(measure)),
};
const json = JSON.stringify(report, null, 2) + '\n';
if (process.argv[2]) writeFileSync(process.argv[2], json);
console.log(json);
