// Run the actual worker with mocked Chrome APIs. Counts API operations over one
// simulated hour, not CPU/battery use. No real timers, websites or browser data.
import { build } from 'esbuild';
import vm from 'node:vm';
import { createHash, webcrypto } from 'node:crypto';
import { writeFileSync } from 'node:fs';
const { outputFiles } = await build({ entryPoints: ['src/background/index.ts'], bundle: true, write: false, format: 'iife' });
const code = outputFiles[0].text;
async function measure(count, timer = false) {
  let now = new Date('2026-09-18T12:00:00').getTime();
  const counts = { localReads: 0, dnrReads: 0, dnrUpdates: 0, submittedRules: 0 };
  const local = { settings: { trackingEnabled: false, blockingEnabled: true, youtubeTrackingEnabled: false }, blockedSites: Array.from({ length: count }, (_, i) => ({ id: `site-${i}`, pattern: `example${i}.com`, enabled: true, unlockType: timer ? 'timer' : 'none', timerBlockedUntil: timer ? now + 30 * 60_000 : undefined, createdAt: now })), blockedSiteFolders: [], dailyLimits: [], storageSchemaVersion: 2, sessionsMigrationV1: true };
  let rules = [];
  const event = () => ({ listeners: [], addListener(fn) { this.listeners.push(fn); } });
  function area(store, durable = false) {
    return { async get(keys) { if (durable) counts.localReads++; if (keys == null) return structuredClone(store); return Object.fromEntries((Array.isArray(keys) ? keys : [keys]).map(k => [k, structuredClone(store[k])])); }, async set(items) { Object.assign(store, structuredClone(items)); }, async remove(keys) { for(const k of Array.isArray(keys) ? keys : [keys]) delete store[k]; }, async clear() { for(const k of Object.keys(store)) delete store[k]; }, async setAccessLevel() {} };
  }
  const chrome = {
    storage: { local: area(local, true), session: area({}) },
    runtime: { getURL: path => `chrome-extension://benchmark/${path}`, onInstalled: event(), onMessage: event() },
    scripting: { async getRegisteredContentScripts() { return []; }, async registerContentScripts() {}, async unregisterContentScripts() {} },
    declarativeNetRequest: { RuleActionType: { REDIRECT: 'redirect' }, ResourceType: { MAIN_FRAME: 'main_frame' }, async getDynamicRules() { counts.dnrReads++; return structuredClone(rules); }, async updateDynamicRules(update) { counts.dnrUpdates++; counts.submittedRules += update.addRules.length; rules = rules.filter(r => !update.removeRuleIds.includes(r.id)).concat(update.addRules); } },
    idle: { setDetectionInterval() {}, onStateChanged: event() },
    tabs: { onActivated: event(), onUpdated: event(), onRemoved: event(), async query() { return []; } },
    windows: { WINDOW_ID_NONE: -1, onFocusChanged: event(), async getLastFocused() { return { focused: false }; }, async getAll() { return []; } },
    webNavigation: { onBeforeNavigate: event() },
    alarms: { async create() {}, onAlarm: event() },
  };
  vm.runInNewContext(code, { chrome, URL, crypto: webcrypto, structuredClone, TextEncoder, TextDecoder, console: { log() {}, error(...args) { throw new Error(args.join(' ')); } }, Date: class extends Date { constructor(...args) { super(...(args.length ? args : [now])); } static now() { return now; } } });
  await new Promise(resolve => chrome.runtime.onMessage.listeners[0]({ type: 'GET_TRACKING_STATE' }, {}, resolve));
  await chrome.runtime.onInstalled.listeners[0]();
  const setup = { ...counts };
  for (const key of Object.keys(counts)) counts[key] = 0;
  for (let i = 0; i < 60; i++) { now += 60_000; await chrome.alarms.onAlarm.listeners[0]({ name: 'saveSession' }); }
  return { scenario: timer ? '100-timers-expire-at-30-minutes' : `${count}-permanent-rules`, setup, observation: { ...counts }, finalRuleCount: rules.length };
}
const report = { sourceSha256: createHash('sha256').update(code).digest('hex'), simulatedSeconds: 3600, methodology: 'Actual worker bundle in VM, mocked Chrome APIs, 60 save alarms after startup/install. Counts include the whole alarm handler. No CPU or battery measurement.', results: await Promise.all([measure(0), measure(100), measure(100, true)]) };
const json = JSON.stringify(report, null, 2) + '\n';
if(process.argv[2]) writeFileSync(process.argv[2], json);
console.log(json);
