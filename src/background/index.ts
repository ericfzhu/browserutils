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

// Session state keys for chrome.storage.session
const SESSION_KEYS = {
  ACTIVE_TAB_ID: 'activeTabId',
  ACTIVE_TAB_DOMAIN: 'activeTabDomain',
  ACTIVE_TAB_START_TIME: 'activeTabStartTime',
  IS_USER_IDLE: 'isUserIdle',
} as const;

// In-memory cache (restored from session storage on startup)
let activeTabId: number | null = null;
let activeTabDomain: string | null = null;
let activeTabStartTime: number | null = null;
let isUserIdle = false;

// Session state helpers
async function saveSessionState(): Promise<void> {
  await chrome.storage.session.set({
    [SESSION_KEYS.ACTIVE_TAB_ID]: activeTabId,
    [SESSION_KEYS.ACTIVE_TAB_DOMAIN]: activeTabDomain,
    [SESSION_KEYS.ACTIVE_TAB_START_TIME]: activeTabStartTime,
    [SESSION_KEYS.IS_USER_IDLE]: isUserIdle,
  });
}

async function restoreSessionState(): Promise<void> {
  const data = await chrome.storage.session.get([
    SESSION_KEYS.ACTIVE_TAB_ID,
    SESSION_KEYS.ACTIVE_TAB_DOMAIN,
    SESSION_KEYS.ACTIVE_TAB_START_TIME,
    SESSION_KEYS.IS_USER_IDLE,
  ]);

  activeTabId = data[SESSION_KEYS.ACTIVE_TAB_ID] ?? null;
  activeTabDomain = data[SESSION_KEYS.ACTIVE_TAB_DOMAIN] ?? null;
  activeTabStartTime = data[SESSION_KEYS.ACTIVE_TAB_START_TIME] ?? null;
  isUserIdle = data[SESSION_KEYS.IS_USER_IDLE] ?? false;
}

// Recover tracking session on service worker wake-up
async function recoverSession(): Promise<void> {
  await restoreSessionState();

  // If we had an active session, verify the tab still exists and is active
  if (activeTabId && activeTabStartTime) {
    try {
      const tab = await chrome.tabs.get(activeTabId);

      // Check if tab is still active in a focused window
      if (tab.active && tab.windowId) {
        const window = await chrome.windows.get(tab.windowId);
        if (window.focused && window.state !== 'minimized') {
          // Session is still valid, continue tracking
          console.log('Recovered active session for:', activeTabDomain);
          return;
        }
      }

      // Tab exists but isn't active anymore - save accumulated time and end session
      if (activeTabDomain && activeTabStartTime) {
        const duration = Math.round((Date.now() - activeTabStartTime) / 1000);
        if (duration > 0) {
          await recordVisit(activeTabDomain, duration);
        }
      }
    } catch {
      // Tab no longer exists - save what we have
      if (activeTabDomain && activeTabStartTime) {
        const duration = Math.round((Date.now() - activeTabStartTime) / 1000);
        // Cap at reasonable max (10 minutes) in case of stale data
        if (duration > 0 && duration < 600) {
          await recordVisit(activeTabDomain, duration);
        }
      }
    }

    // Clear the session
    activeTabId = null;
    activeTabDomain = null;
    activeTabStartTime = null;
    await saveSessionState();
    await setActiveSession(undefined);
  }

  // Check current active tab and start tracking if appropriate
  if (!isUserIdle) {
    try {
      const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      if (tab?.url && tab.id) {
        const window = await chrome.windows.get(tab.windowId!);
        if (window.focused && window.state !== 'minimized') {
          await startSession(tab.id, tab.url);
        }
      }
    } catch {
      // No active tab
    }
  }
}

// Initialize extension
chrome.runtime.onInstalled.addListener(async () => {
  console.log('BrowserUtils extension installed');
  await updateBlockingRules();
  await setupIdleDetection();
});

// Service worker startup - restore state and recover session
(async () => {
  await setupIdleDetection();
  await recoverSession();
})();

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
      await saveSessionState();
      // Resume tracking if we have an active tab
      if (activeTabId) {
        try {
          const tab = await chrome.tabs.get(activeTabId);
          if (tab.url) {
            await startSession(activeTabId, tab.url);
          }
        } catch {
          // Tab no longer exists - find current active tab
          try {
            const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
            if (tab?.url && tab.id) {
              await startSession(tab.id, tab.url);
            }
          } catch {
            // No active tab
          }
        }
      }
    }
  } else {
    // User is idle or locked
    if (!isUserIdle) {
      // Check if active tab is playing audio (e.g., YouTube video)
      // If so, don't pause tracking
      if (activeTabId) {
        try {
          const tab = await chrome.tabs.get(activeTabId);
          if (tab.audible) {
            // Tab is playing audio, continue tracking
            return;
          }
        } catch {
          // Tab no longer exists
        }
      }
      isUserIdle = true;
      await saveSessionState();
      await endCurrentSession();
    }
  }
});


// Handle messages from popup, dashboard, and content scripts
chrome.runtime.onMessage.addListener((message: MessageType, sender, sendResponse) => {
  handleMessage(message, sender).then(sendResponse);
  return true; // Keep channel open for async response
});

async function handleMessage(message: MessageType, sender?: chrome.runtime.MessageSender): Promise<unknown> {
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
    // Content script messages
    case 'HEARTBEAT': {
      await handleHeartbeat(sender);
      return { success: true };
    }
    case 'VISIBILITY_CHANGE': {
      await handleVisibilityChange(message.payload, sender);
      return { success: true };
    }
    case 'CONTENT_SCRIPT_READY': {
      await handleContentScriptReady(message.payload, sender);
      return { success: true };
    }
    default:
      return { error: 'Unknown message type' };
  }
}

// Handle heartbeat from content script - saves progress every 15 seconds
async function handleHeartbeat(sender?: chrome.runtime.MessageSender): Promise<void> {
  if (!sender?.tab?.id || !sender.tab.url) return;

  const settings = await getSettings();
  if (!settings.trackingEnabled) return;

  // Restore session state if needed
  await restoreSessionState();

  const tabId = sender.tab.id;
  const url = sender.tab.url;
  const domain = getDomainFromUrl(url);
  if (!domain) return;

  // Skip chrome:// and extension pages
  if (url.startsWith('chrome://') || url.startsWith('chrome-extension://')) {
    return;
  }

  const now = Date.now();

  // If this is the active session, save progress
  if (activeTabId === tabId && activeTabDomain && activeTabStartTime) {
    const duration = Math.round((now - activeTabStartTime) / 1000);
    if (duration > 0) {
      await recordVisit(activeTabDomain, duration);
      activeTabStartTime = now;
      await saveSessionState();
    }
  } else if (!activeTabId || !activeTabStartTime) {
    // No active session - start one if this tab is active
    if (sender.tab.active) {
      try {
        const window = await chrome.windows.get(sender.tab.windowId!);
        if (window.focused && window.state !== 'minimized') {
          activeTabId = tabId;
          activeTabDomain = domain;
          activeTabStartTime = now;
          await saveSessionState();
          await setActiveSession({
            domain,
            startTime: activeTabStartTime,
            tabId,
          });
        }
      } catch {
        // Window doesn't exist
      }
    }
  }
}

// Handle visibility change from content script
async function handleVisibilityChange(
  payload: { visible: boolean; url: string; timestamp: number },
  sender?: chrome.runtime.MessageSender
): Promise<void> {
  if (!sender?.tab?.id || !sender.tab.url) return;

  const settings = await getSettings();
  if (!settings.trackingEnabled) return;

  await restoreSessionState();

  const tabId = sender.tab.id;
  const domain = getDomainFromUrl(payload.url);
  if (!domain) return;

  if (payload.visible) {
    // Page became visible - start tracking if this is the active tab
    if (sender.tab.active && !isUserIdle) {
      try {
        const window = await chrome.windows.get(sender.tab.windowId!);
        if (window.focused && window.state !== 'minimized') {
          // End any existing session first
          if (activeTabId && activeTabId !== tabId) {
            await endCurrentSession();
          }

          // Start new session
          if (activeTabId !== tabId) {
            activeTabId = tabId;
            activeTabDomain = domain;
            activeTabStartTime = Date.now();
            await saveSessionState();
            await setActiveSession({
              domain,
              startTime: activeTabStartTime,
              tabId,
            });
          }
        }
      } catch {
        // Window doesn't exist
      }
    }
  } else {
    // Page became hidden - save progress and end session for this tab
    if (activeTabId === tabId && activeTabDomain && activeTabStartTime) {
      const duration = Math.round((Date.now() - activeTabStartTime) / 1000);
      if (duration > 0) {
        await recordVisit(activeTabDomain, duration);
      }
      activeTabId = null;
      activeTabDomain = null;
      activeTabStartTime = null;
      await saveSessionState();
      await setActiveSession(undefined);
    }
  }
}

// Handle content script ready - initial page load
async function handleContentScriptReady(
  payload: { visible: boolean; url: string; timestamp: number },
  sender?: chrome.runtime.MessageSender
): Promise<void> {
  if (!payload.visible) return;

  // Treat as visibility becoming true
  await handleVisibilityChange(payload, sender);
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
  await saveSessionState();
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

  await saveSessionState();
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
  // Restore session state in case service worker was restarted
  await restoreSessionState();

  if (alarm.name === 'saveSession') {
    // Check if we have a session but in-memory state was lost
    if (!activeTabStartTime) {
      // Try to recover from session storage
      const data = await chrome.storage.session.get([
        SESSION_KEYS.ACTIVE_TAB_ID,
        SESSION_KEYS.ACTIVE_TAB_DOMAIN,
        SESSION_KEYS.ACTIVE_TAB_START_TIME,
      ]);

      if (data[SESSION_KEYS.ACTIVE_TAB_START_TIME]) {
        // We had a session, verify it's still valid
        const storedTabId = data[SESSION_KEYS.ACTIVE_TAB_ID];
        if (storedTabId) {
          try {
            const tab = await chrome.tabs.get(storedTabId);
            if (tab.active && tab.windowId) {
              const window = await chrome.windows.get(tab.windowId);
              if (window.focused && window.state !== 'minimized') {
                // Restore the session
                activeTabId = storedTabId;
                activeTabDomain = data[SESSION_KEYS.ACTIVE_TAB_DOMAIN];
                activeTabStartTime = data[SESSION_KEYS.ACTIVE_TAB_START_TIME];
              }
            }
          } catch {
            // Tab doesn't exist anymore
          }
        }
      }
    }

    // Save current session progress
    if (activeTabDomain && activeTabStartTime) {
      const duration = Math.round((Date.now() - activeTabStartTime) / 1000);
      if (duration > 0) {
        await recordVisit(activeTabDomain, duration);
        activeTabStartTime = Date.now(); // Reset for next interval
        await saveSessionState();
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
    const cutoffStr = `${cutoffDate.getFullYear()}-${String(cutoffDate.getMonth() + 1).padStart(2, '0')}-${String(cutoffDate.getDate()).padStart(2, '0')}`;

    const filteredStats: Record<string, typeof allStats[string]> = {};
    for (const [date, stats] of Object.entries(allStats)) {
      if (date >= cutoffStr) {
        filteredStats[date] = stats;
      }
    }

    await chrome.storage.local.set({ dailyStats: filteredStats });
  }
});
