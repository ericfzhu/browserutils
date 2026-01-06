import {
  getBlockedSites,
  addBlockedSite,
  removeBlockedSite,
  updateBlockedSite,
  getSettings,
  updateSettings,
  getDailyStats,
  getAllDailyStats,
  incrementBlockedAttempt,
  recordVisit,
  setActiveSession,
  verifyPassword,
  matchesPattern,
} from '../shared/storage';
import { BlockedSite, MessageType } from '../shared/types';

// Track active tab for time tracking
let activeTabId: number | null = null;
let activeTabDomain: string | null = null;
let activeTabStartTime: number | null = null;
let isUserIdle = false;

// Initialize extension
chrome.runtime.onInstalled.addListener(async () => {
  console.log('BrowserUtils extension installed');
  await updateBlockingRules();
  await setupIdleDetection();
});

// Also set up idle detection on service worker startup (in case it was restarted)
setupIdleDetection();

// Set up idle detection based on settings
async function setupIdleDetection(): Promise<void> {
  const settings = await getSettings();
  if (settings.idleThreshold > 0) {
    // Minimum is 15 seconds for chrome.idle API
    const threshold = Math.max(15, settings.idleThreshold);
    chrome.idle.setDetectionInterval(threshold);
  }
}

// Handle idle state changes
chrome.idle.onStateChanged.addListener(async (state) => {
  const settings = await getSettings();

  // If idle detection is disabled, ignore
  if (settings.idleThreshold === 0) {
    return;
  }

  if (state === 'active') {
    // User became active again
    if (isUserIdle) {
      isUserIdle = false;
      // Resume tracking if we have an active tab
      if (activeTabId) {
        try {
          const tab = await chrome.tabs.get(activeTabId);
          if (tab.url) {
            await startSession(activeTabId, tab.url);
          }
        } catch {
          // Tab no longer exists
        }
      }
    }
  } else {
    // User is idle or locked
    if (!isUserIdle) {
      isUserIdle = true;
      await endCurrentSession();
    }
  }
});

// Handle messages from popup and dashboard
chrome.runtime.onMessage.addListener((message: MessageType, _sender, sendResponse) => {
  handleMessage(message).then(sendResponse);
  return true; // Keep channel open for async response
});

async function handleMessage(message: MessageType): Promise<unknown> {
  switch (message.type) {
    case 'GET_STATS': {
      if (message.payload?.date) {
        return getDailyStats(message.payload.date);
      }
      return getAllDailyStats();
    }
    case 'ADD_BLOCKED_SITE': {
      const site = await addBlockedSite(message.payload);
      await updateBlockingRules();
      return site;
    }
    case 'REMOVE_BLOCKED_SITE': {
      await removeBlockedSite(message.payload.id);
      await updateBlockingRules();
      return { success: true };
    }
    case 'UPDATE_BLOCKED_SITE': {
      await updateBlockedSite(message.payload);
      await updateBlockingRules();
      return { success: true };
    }
    case 'UNLOCK_SITE': {
      return unlockSite(message.payload.id, message.payload.password);
    }
    case 'GET_BLOCKED_SITES': {
      return getBlockedSites();
    }
    case 'GET_SETTINGS': {
      return getSettings();
    }
    case 'UPDATE_SETTINGS': {
      const settings = await updateSettings(message.payload);
      await updateBlockingRules();
      // Update idle detection if threshold changed
      if (message.payload.idleThreshold !== undefined) {
        await setupIdleDetection();
      }
      return settings;
    }
    case 'CHECK_SITE': {
      return checkIfBlocked(message.payload.url);
    }
    default:
      return { error: 'Unknown message type' };
  }
}

async function unlockSite(id: string, password?: string): Promise<{ success: boolean; error?: string }> {
  const sites = await getBlockedSites();
  const site = sites.find(s => s.id === id);

  if (!site) {
    return { success: false, error: 'Site not found' };
  }

  if (site.unlockType === 'password' && site.passwordHash) {
    if (!password) {
      return { success: false, error: 'Password required' };
    }
    const valid = await verifyPassword(password, site.passwordHash);
    if (!valid) {
      return { success: false, error: 'Invalid password' };
    }
  }

  if (site.unlockType === 'timer' && site.timerDuration) {
    // Set unlock until timestamp
    site.timerUnlockedUntil = Date.now() + site.timerDuration * 60 * 1000;
    await updateBlockedSite(site);
  }

  await updateBlockingRules();
  return { success: true };
}

async function checkIfBlocked(url: string): Promise<{ blocked: boolean; site?: BlockedSite }> {
  const settings = await getSettings();
  if (!settings.blockingEnabled) {
    return { blocked: false };
  }

  const sites = await getBlockedSites();

  for (const site of sites) {
    if (!site.enabled) continue;

    if (matchesPattern(url, site.pattern)) {
      // Check if temporarily unlocked
      if (site.unlockType === 'timer' && site.timerUnlockedUntil) {
        if (Date.now() < site.timerUnlockedUntil) {
          return { blocked: false };
        }
      }

      // Check schedule
      if (site.unlockType === 'schedule' && site.schedule) {
        const now = new Date();
        const day = now.getDay();
        const time = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

        if (site.schedule.days.includes(day)) {
          if (time >= site.schedule.startTime && time <= site.schedule.endTime) {
            return { blocked: true, site };
          }
        }
        return { blocked: false };
      }

      return { blocked: true, site };
    }
  }

  return { blocked: false };
}

async function updateBlockingRules(): Promise<void> {
  const settings = await getSettings();
  const sites = await getBlockedSites();

  // Remove all existing dynamic rules
  const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
  const ruleIdsToRemove = existingRules.map(r => r.id);

  if (ruleIdsToRemove.length > 0) {
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: ruleIdsToRemove,
    });
  }

  if (!settings.blockingEnabled) {
    return;
  }

  const rules: chrome.declarativeNetRequest.Rule[] = [];
  let ruleId = 1;

  for (const site of sites) {
    if (!site.enabled) continue;

    // Skip if temporarily unlocked
    if (site.unlockType === 'timer' && site.timerUnlockedUntil) {
      if (Date.now() < site.timerUnlockedUntil) {
        continue;
      }
    }

    // Build URL filter
    let urlFilter: string;
    if (site.pattern.startsWith('*.')) {
      urlFilter = `||${site.pattern.slice(2)}`;
    } else {
      urlFilter = `||${site.pattern}`;
    }

    rules.push({
      id: ruleId++,
      priority: 1,
      action: {
        type: chrome.declarativeNetRequest.RuleActionType.REDIRECT,
        redirect: {
          extensionPath: `/blocked.html?site=${encodeURIComponent(site.id)}`,
        },
      },
      condition: {
        urlFilter,
        resourceTypes: [chrome.declarativeNetRequest.ResourceType.MAIN_FRAME],
      },
    });
  }

  if (rules.length > 0) {
    await chrome.declarativeNetRequest.updateDynamicRules({
      addRules: rules,
    });
  }
}

// Time tracking
function getDomainFromUrl(url: string): string | null {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch {
    return null;
  }
}

async function endCurrentSession(): Promise<void> {
  if (activeTabDomain && activeTabStartTime) {
    const duration = Math.round((Date.now() - activeTabStartTime) / 1000);
    if (duration > 0) {
      await recordVisit(activeTabDomain, duration);
    }
  }
  activeTabId = null;
  activeTabDomain = null;
  activeTabStartTime = null;
  await setActiveSession(undefined);
}

async function startSession(tabId: number, url: string): Promise<void> {
  const settings = await getSettings();
  if (!settings.trackingEnabled) return;

  // Don't start session if user is idle
  if (isUserIdle) return;

  const domain = getDomainFromUrl(url);
  if (!domain) return;

  // Skip chrome:// and extension pages
  if (url.startsWith('chrome://') || url.startsWith('chrome-extension://')) {
    return;
  }

  // Check if window is minimized
  try {
    const tab = await chrome.tabs.get(tabId);
    if (tab.windowId) {
      const window = await chrome.windows.get(tab.windowId);
      if (window.state === 'minimized') {
        return; // Don't track minimized windows
      }
    }
  } catch {
    // Tab or window doesn't exist
    return;
  }

  await endCurrentSession();

  activeTabId = tabId;
  activeTabDomain = domain;
  activeTabStartTime = Date.now();

  await setActiveSession({
    domain,
    startTime: activeTabStartTime,
    tabId,
  });
}

// Tab change listeners
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    if (tab.url) {
      await startSession(activeInfo.tabId, tab.url);
    }
  } catch {
    // Tab might not exist
  }
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.active && tab.url) {
    await startSession(tabId, tab.url);

    // Check if blocked and increment counter
    const result = await checkIfBlocked(tab.url);
    if (result.blocked) {
      const domain = getDomainFromUrl(tab.url);
      if (domain) {
        await incrementBlockedAttempt(domain);
      }
    }
  }
});

chrome.tabs.onRemoved.addListener(async (tabId) => {
  if (tabId === activeTabId) {
    await endCurrentSession();
  }
});

chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    await endCurrentSession();
  } else {
    try {
      const [tab] = await chrome.tabs.query({ active: true, windowId });
      if (tab?.url && tab.id) {
        await startSession(tab.id, tab.url);
      }
    } catch {
      // No active tab
    }
  }
});

// Periodic save and cleanup
chrome.alarms.create('saveSession', { periodInMinutes: 1 });
chrome.alarms.create('cleanup', { periodInMinutes: 60 });

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'saveSession') {
    // Save current session progress
    if (activeTabDomain && activeTabStartTime) {
      const duration = Math.round((Date.now() - activeTabStartTime) / 1000);
      if (duration > 0) {
        await recordVisit(activeTabDomain, duration);
        activeTabStartTime = Date.now(); // Reset for next interval
      }
    }
    // Refresh blocking rules (for timer-based unlocks that may have expired)
    await updateBlockingRules();
  }

  if (alarm.name === 'cleanup') {
    // Clean up old stats based on retention setting
    const settings = await getSettings();
    const allStats = await getAllDailyStats();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - settings.retentionDays);
    const cutoffStr = cutoffDate.toISOString().split('T')[0];

    const filteredStats: Record<string, typeof allStats[string]> = {};
    for (const [date, stats] of Object.entries(allStats)) {
      if (date >= cutoffStr) {
        filteredStats[date] = stats;
      }
    }

    await chrome.storage.local.set({ dailyStats: filteredStats });
  }
});
