import { getSettings, getBlockedSites, getBlockedSiteFolders, buildUrlPatternRegex } from '../shared/storage';
import type { BlockedSite, BlockedSiteFolder, Settings } from '../shared/types';
import { isSiteRuleActive } from './blockingRules';

interface RuleSnapshot {
  settings: Settings;
  folders: BlockedSiteFolder[];
  entries: { site: BlockedSite; rule: chrome.declarativeNetRequest.Rule }[];
}

let snapshot: RuleSnapshot | undefined;
let appliedRules: chrome.declarativeNetRequest.Rule[] | undefined;
let pending: Promise<void> = Promise.resolve();

// Rule mutations also arrive from non-tracking messages. Serialize the entire
// read/compile/apply operation so an older snapshot cannot overwrite newer rules.
function serialize(operation: () => Promise<void>): Promise<void> {
  const result = pending.then(operation);
  pending = result.catch(() => undefined);
  return result;
}

function fingerprint(rules: chrome.declarativeNetRequest.Rule[]): string {
  return JSON.stringify([...rules].sort((a, b) => a.id - b.id), (_key, value) => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return Object.fromEntries(Object.keys(value).sort().map(key => [key, value[key]]));
    }
    return value;
  });
}

async function loadSnapshot(): Promise<void> {
  const [settings, sites, folders] = await Promise.all([getSettings(), getBlockedSites(), getBlockedSiteFolders()]);
  const entries: RuleSnapshot['entries'] = [];
  for (const [index, site] of sites.entries()) {
    const regexFilter = buildUrlPatternRegex(site.pattern);
    if (!regexFilter) continue;
    entries.push({ site, rule: {
      // Stable within this definition snapshot, even when timed rules expire.
      id: index + 1,
      priority: sites.length - index,
      action: {
        type: chrome.declarativeNetRequest.RuleActionType.REDIRECT,
        redirect: { regexSubstitution: `${chrome.runtime.getURL('blocked.html')}#site=${encodeURIComponent(site.id)}&returnUrl=\\0` },
      },
      condition: { regexFilter, resourceTypes: [chrome.declarativeNetRequest.ResourceType.MAIN_FRAME] },
    } });
  }
  snapshot = { settings, folders, entries };
}

async function applySnapshot(): Promise<void> {
  const { settings, folders, entries } = snapshot!;
  const now = Date.now();
  const context = {
    now,
    globalFocusActive: !!settings.globalFocusUntil && now < settings.globalFocusUntil,
    activeFocusFolderIds: new Set(folders.filter(folder => folder.focusUntil && now < folder.focusUntil).map(folder => folder.id)),
  };
  const rules = settings.blockingEnabled
    ? entries.filter(({ site }) => isSiteRuleActive(site, context)).map(({ rule }) => rule)
    : [];
  // Dynamic rules outlive the worker. Reconcile with Chrome after every restart.
  appliedRules ??= await chrome.declarativeNetRequest.getDynamicRules();
  if (rules.length === appliedRules.length && rules.every((rule, index) => rule === appliedRules![index])) return;
  if (fingerprint(rules) === fingerprint(appliedRules)) {
    appliedRules = rules;
    return;
  }
  try {
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: appliedRules.map(rule => rule.id), addRules: rules,
    });
    appliedRules = rules;
  } catch (error) {
    // A failed/uncertain update must be reconciled on the next attempt.
    appliedRules = undefined;
    throw error;
  }
}

// Call after changing definitions/settings, after import/reset, and on startup.
export function updateBlockingRules(): Promise<void> {
  return serialize(async () => {
    await loadSnapshot();
    await applySnapshot();
  });
}

// Existing minute checkpoints and unlock alarms still evaluate local schedule,
// timer and focus boundaries, including clock/timezone changes. No storage reads
// or regex recompilation are needed while definitions remain unchanged.
export function refreshBlockingRules(): Promise<void> {
  return serialize(async () => {
    if (!snapshot) await loadSnapshot();
    await applySnapshot();
  });
}
