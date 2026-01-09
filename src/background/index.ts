import {
  getBlockedSites,
  setBlockedSites,
  addBlockedSite,
  removeBlockedSite,
  updateBlockedSite,
  getBlockedSiteFolders,
  setBlockedSiteFolders,
  addBlockedSiteFolder,
  updateBlockedSiteFolder,
  removeBlockedSiteFolder,
  getSettings,
  updateSettings,
  getDailyStats,
  getAllDailyStats,
  incrementBlockedAttempt,
  recordSession,
  getActiveSessions,
  addActiveSession,
  removeActiveSession,
  clearActiveSessions,
  verifyPassword,
  matchesPattern,
  getDomainCategories,
  setDomainCategory,
  getDailyLimits,
  addDailyLimit,
  updateDailyLimit,
  removeDailyLimit,
  checkDailyLimitForDomain,
  recordYouTubeSession,
  getActiveYouTubeSessions,
  addActiveYouTubeSession,
  removeActiveYouTubeSession,
  clearActiveYouTubeSessions,
} from '../shared/storage';
import { BlockedSite, MessageType } from '../shared/types';

// Session state keys for chrome.storage.session
const SESSION_KEYS = {
  IS_USER_IDLE: 'isUserIdle',
  LOCKDOWN_AUTH_UNTIL: 'lockdownAuthUntil',
} as const;

// In-memory idle state (restored from session storage on startup)
let isUserIdle = false;

// Session state helpers
async function saveIdleState(): Promise<void> {
  await chrome.storage.session.set({
    [SESSION_KEYS.IS_USER_IDLE]: isUserIdle,
  });
}

async function restoreIdleState(): Promise<void> {
  const data = await chrome.storage.session.get([SESSION_KEYS.IS_USER_IDLE]);
  isUserIdle = data[SESSION_KEYS.IS_USER_IDLE] ?? false;
}

// Lockdown session helpers
const LOCKDOWN_SESSION_DURATION = 5 * 60 * 1000; // 5 minutes

async function isLockdownSessionValid(): Promise<boolean> {
  const data = await chrome.storage.session.get([SESSION_KEYS.LOCKDOWN_AUTH_UNTIL]);
  const authUntil = data[SESSION_KEYS.LOCKDOWN_AUTH_UNTIL];
  return authUntil ? Date.now() < authUntil : false;
}

async function startLockdownSession(): Promise<number> {
  const authUntil = Date.now() + LOCKDOWN_SESSION_DURATION;
  await chrome.storage.session.set({
    [SESSION_KEYS.LOCKDOWN_AUTH_UNTIL]: authUntil,
  });
  return authUntil;
}

async function clearLockdownSession(): Promise<void> {
  await chrome.storage.session.remove([SESSION_KEYS.LOCKDOWN_AUTH_UNTIL]);
}

async function getLockdownAuthUntil(): Promise<number | undefined> {
  const data = await chrome.storage.session.get([SESSION_KEYS.LOCKDOWN_AUTH_UNTIL]);
  return data[SESSION_KEYS.LOCKDOWN_AUTH_UNTIL];
}

// Recover tracking sessions on service worker wake-up
async function recoverSession(): Promise<void> {
  await restoreIdleState();

  // Get all active sessions and verify they're still valid
  const activeSessions = await getActiveSessions();

  for (const [tabIdStr, session] of Object.entries(activeSessions)) {
    const tabId = parseInt(tabIdStr);
    try {
      const tab = await chrome.tabs.get(tabId);

      // Check if tab is still active in a visible window
      if (tab.active && tab.windowId) {
        const window = await chrome.windows.get(tab.windowId);
        if (window.state !== 'minimized') {
          // Session is still valid, continue tracking
          console.log('Recovered active session for:', session.domain);
          continue;
        }
      }

      // Tab exists but isn't active anymore - end the session
      await endSession(tabId);
    } catch {
      // Tab no longer exists - end the session (cap at 10 minutes for stale data)
      const duration = Date.now() - session.startTime;
      if (duration > 0 && duration < 600000) {
        await recordSession({
          domain: session.domain,
          startTime: session.startTime,
          endTime: Date.now(),
          windowId: session.windowId,
        });
      }
      await removeActiveSession(tabId);
    }
  }

  // Start tracking for all visible windows if not idle
  if (!isUserIdle) {
    await startAllVisibleSessions();
  }
}

// Start sessions for all visible (non-minimized) windows
async function startAllVisibleSessions(): Promise<void> {
  const settings = await getSettings();
  if (!settings.trackingEnabled) return;

  try {
    const windows = await chrome.windows.getAll({ windowTypes: ['normal'] });
    for (const window of windows) {
      if (window.state !== 'minimized' && window.id) {
        const [tab] = await chrome.tabs.query({ active: true, windowId: window.id });
        if (tab?.url && tab.id) {
          await startSession(tab.id, tab.url, window.id);
        }
      }
    }
  } catch {
    // Failed to get windows
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
      await saveIdleState();
      // Resume tracking for all visible windows
      await startAllVisibleSessions();
    }
  } else {
    // User is idle or locked
    if (!isUserIdle) {
      // Check if any active session is playing audio (e.g., YouTube video)
      const activeSessions = await getActiveSessions();
      for (const [tabIdStr] of Object.entries(activeSessions)) {
        try {
          const tab = await chrome.tabs.get(parseInt(tabIdStr));
          if (tab.audible) {
            // A tab is playing audio, continue tracking
            return;
          }
        } catch {
          // Tab no longer exists
        }
      }
      isUserIdle = true;
      await saveIdleState();
      await endAllSessions();
      await endAllYouTubeSessions();
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
    case 'UPDATE_BLOCKED_SITES': {
      await setBlockedSites(message.payload);
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
    case 'CHECK_SITE_WITH_REDIRECT': {
      // First check if site is blocked
      const result = await checkIfBlocked(message.payload.url);
      if (result.blocked && result.site) {
        return {
          blocked: true,
          redirectUrl: chrome.runtime.getURL(`blocked.html?site=${result.site.id}`),
        };
      }

      // Then check daily limits
      const domain = getDomainFromUrl(message.payload.url);
      if (domain) {
        const limitResult = await checkDailyLimitForDomain(domain);
        if (limitResult.exceeded && limitResult.limit) {
          return {
            blocked: true,
            redirectUrl: chrome.runtime.getURL(`blocked.html?type=limit&limitId=${limitResult.limit.id}`),
          };
        }
      }

      return { blocked: false };
    }
    case 'INCREMENT_BLOCKED_ATTEMPT': {
      await incrementBlockedAttempt(message.payload.domain);
      return { success: true };
    }
    // Folder operations
    case 'GET_BLOCKED_SITE_FOLDERS': {
      return getBlockedSiteFolders();
    }
    case 'ADD_BLOCKED_SITE_FOLDER': {
      return addBlockedSiteFolder(message.payload);
    }
    case 'UPDATE_BLOCKED_SITE_FOLDER': {
      await updateBlockedSiteFolder(message.payload);
      return { success: true };
    }
    case 'UPDATE_BLOCKED_SITE_FOLDERS': {
      await setBlockedSiteFolders(message.payload);
      return { success: true };
    }
    case 'REMOVE_BLOCKED_SITE_FOLDER': {
      await removeBlockedSiteFolder(message.payload.id);
      await updateBlockingRules();
      return { success: true };
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
    // YouTube tracking messages
    case 'YOUTUBE_CHANNEL_UPDATE': {
      await handleYouTubeChannelUpdate(message.payload, sender);
      return { success: true };
    }
    case 'YOUTUBE_VISIBILITY_CHANGE': {
      await handleYouTubeVisibilityChange(message.payload, sender);
      return { success: true };
    }
    // Category operations
    case 'GET_DOMAIN_CATEGORIES': {
      return getDomainCategories();
    }
    case 'SET_DOMAIN_CATEGORY': {
      await setDomainCategory(message.payload.domain, message.payload.category);
      return { success: true };
    }
    // Daily limit operations
    case 'GET_DAILY_LIMITS': {
      return getDailyLimits();
    }
    case 'ADD_DAILY_LIMIT': {
      const limit = await addDailyLimit(message.payload);
      return limit;
    }
    case 'UPDATE_DAILY_LIMIT': {
      await updateDailyLimit(message.payload);
      return { success: true };
    }
    case 'REMOVE_DAILY_LIMIT': {
      await removeDailyLimit(message.payload.id);
      return { success: true };
    }
    case 'BYPASS_DAILY_LIMIT': {
      return bypassDailyLimit(message.payload.id, message.payload.password);
    }
    case 'CHECK_DAILY_LIMIT': {
      const domain = getDomainFromUrl(message.payload.url);
      if (!domain) return { exceeded: false, timeSpent: 0, remaining: Infinity };
      return checkDailyLimitForDomain(domain);
    }
    // Lockdown mode operations
    case 'LOCKDOWN_GET_STATUS': {
      const settings = await getSettings();
      const sessionValid = await isLockdownSessionValid();
      const authUntil = await getLockdownAuthUntil();
      return {
        lockdownEnabled: settings.lockdownEnabled ?? false,
        hasPassword: !!settings.passwordHash,
        sessionValid,
        sessionExpiresAt: authUntil,
      };
    }
    case 'LOCKDOWN_AUTHENTICATE': {
      const settings = await getSettings();
      if (!settings.passwordHash) {
        return { success: false, error: 'No master password set' };
      }
      const valid = await verifyPassword(message.payload.password, settings.passwordHash);
      if (!valid) {
        return { success: false, error: 'Invalid password' };
      }
      const expiresAt = await startLockdownSession();
      return { success: true, expiresAt };
    }
    case 'LOCKDOWN_CLEAR_SESSION': {
      await clearLockdownSession();
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

  const tabId = sender.tab.id;
  const url = sender.tab.url;
  const windowId = sender.tab.windowId ?? 0;
  const domain = getDomainFromUrl(url);
  if (!domain) return;

  // Skip chrome:// and extension pages
  if (url.startsWith('chrome://') || url.startsWith('chrome-extension://')) {
    return;
  }

  const now = Date.now();
  const activeSessions = await getActiveSessions();
  const session = activeSessions[tabId];

  // If this tab has an active session, save progress
  if (session) {
    const duration = Math.round((now - session.startTime) / 1000);
    if (duration > 0) {
      await recordSession({
        domain: session.domain,
        startTime: session.startTime,
        endTime: now,
        windowId: session.windowId,
      });
      // Reset session start time
      await addActiveSession(tabId, {
        domain: session.domain,
        startTime: now,
        tabId,
        windowId: session.windowId,
      });
    }
  } else if (sender.tab.active && !isUserIdle) {
    // No active session for this tab - start one if tab is active and visible
    try {
      const window = await chrome.windows.get(windowId);
      if (window.state !== 'minimized') {
        await addActiveSession(tabId, {
          domain,
          startTime: now,
          tabId,
          windowId,
        });
      }
    } catch {
      // Window doesn't exist
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

  const tabId = sender.tab.id;
  const windowId = sender.tab.windowId ?? 0;
  const domain = getDomainFromUrl(payload.url);
  if (!domain) return;

  if (payload.visible) {
    // Page became visible - start tracking if this is the active tab in a visible window
    if (sender.tab.active && !isUserIdle) {
      try {
        const window = await chrome.windows.get(windowId);
        if (window.state !== 'minimized') {
          const activeSessions = await getActiveSessions();
          // Start new session if we don't have one for this tab
          if (!activeSessions[tabId]) {
            await addActiveSession(tabId, {
              domain,
              startTime: Date.now(),
              tabId,
              windowId,
            });
          }
        }
      } catch {
        // Window doesn't exist
      }
    }
  } else {
    // Page became hidden - end session for this tab
    await endSession(tabId);
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

// Handle YouTube channel update from content script
async function handleYouTubeChannelUpdate(
  payload: { channelName: string; channelId?: string; url: string; timestamp: number },
  sender?: chrome.runtime.MessageSender
): Promise<void> {
  console.log('[YouTube] Channel update received:', payload);

  if (!sender?.tab?.id) {
    console.log('[YouTube] No tab ID, ignoring');
    return;
  }

  const settings = await getSettings();
  if (!settings.youtubeTrackingEnabled) {
    console.log('[YouTube] Tracking disabled in settings');
    return;
  }

  const tabId = sender.tab.id;
  const windowId = sender.tab.windowId ?? 0;
  const now = Date.now();

  // Get existing YouTube session for this tab
  const activeYoutubeSessions = await getActiveYouTubeSessions();
  const existingSession = activeYoutubeSessions[tabId];
  console.log('[YouTube] Existing session:', existingSession);

  if (existingSession) {
    // Compare by name primarily, only use channelId if both have it
    const nameChanged = existingSession.channelName !== payload.channelName;
    const idChanged = existingSession.channelId && payload.channelId &&
                      existingSession.channelId !== payload.channelId;
    const channelChanged = nameChanged || idChanged;
    if (channelChanged) {
      console.log('[YouTube] Channel changed, ending previous session');
      // Channel changed - end previous session and start new one
      await endYouTubeSession(tabId);
      // Start new session for new channel
      await addActiveYouTubeSession(tabId, {
        channelName: payload.channelName,
        channelId: payload.channelId,
        startTime: now,
        tabId,
        windowId,
      });
      console.log('[YouTube] Started new session for:', payload.channelName);
    } else {
      // Same channel - update channelId if we got it now but didn't have it before
      if (payload.channelId && !existingSession.channelId) {
        console.log('[YouTube] Updating session with channelId:', payload.channelId);
        await addActiveYouTubeSession(tabId, {
          ...existingSession,
          channelId: payload.channelId,
        });
      } else {
        console.log('[YouTube] Same channel, keeping session alive');
      }
    }
    // Same channel - just keep the session alive, don't record yet
    // Session will be recorded when user leaves or channel changes
    return;
  }

  // No existing session - start new one
  console.log('[YouTube] Starting new session for:', payload.channelName);
  await addActiveYouTubeSession(tabId, {
    channelName: payload.channelName,
    channelId: payload.channelId,
    startTime: now,
    tabId,
    windowId,
  });
}

// Handle YouTube visibility change
async function handleYouTubeVisibilityChange(
  payload: { visible: boolean; channelName?: string; channelId?: string; url: string; timestamp: number },
  sender?: chrome.runtime.MessageSender
): Promise<void> {
  console.log('[YouTube] Visibility change received:', payload);

  if (!sender?.tab?.id) {
    console.log('[YouTube] No tab ID, ignoring');
    return;
  }

  const settings = await getSettings();
  if (!settings.youtubeTrackingEnabled) {
    console.log('[YouTube] Tracking disabled in settings');
    return;
  }

  const tabId = sender.tab.id;

  if (!payload.visible) {
    console.log('[YouTube] Video paused/ended, ending session for tab:', tabId);
    // Page became hidden - end YouTube session
    await endYouTubeSession(tabId);
  }
}

// End a YouTube session and record it
async function endYouTubeSession(tabId: number): Promise<void> {
  const session = await removeActiveYouTubeSession(tabId);
  console.log('[YouTube] Ending session:', session);

  if (session && session.startTime) {
    const duration = Math.round((Date.now() - session.startTime) / 1000);
    console.log('[YouTube] Session duration:', duration, 'seconds');
    if (duration > 0) {
      await recordYouTubeSession({
        channelName: session.channelName,
        channelId: session.channelId,
        startTime: session.startTime,
        endTime: Date.now(),
        windowId: session.windowId,
      });
      console.log('[YouTube] Session recorded for:', session.channelName);
    } else {
      console.log('[YouTube] Duration too short, not recording');
    }
  } else {
    console.log('[YouTube] No session to end');
  }
}

// End all active YouTube sessions
async function endAllYouTubeSessions(): Promise<void> {
  const activeYoutubeSessions = await getActiveYouTubeSessions();
  const now = Date.now();

  for (const [, session] of Object.entries(activeYoutubeSessions)) {
    if (session.startTime) {
      const duration = Math.round((now - session.startTime) / 1000);
      if (duration > 0) {
        await recordYouTubeSession({
          channelName: session.channelName,
          channelId: session.channelId,
          startTime: session.startTime,
          endTime: now,
          windowId: session.windowId,
        });
      }
    }
  }

  await clearActiveYouTubeSessions();
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

// Bypass a daily limit temporarily
async function bypassDailyLimit(id: string, password?: string): Promise<{ success: boolean; error?: string }> {
  const limits = await getDailyLimits();
  const limit = limits.find(l => l.id === id);

  if (!limit) {
    return { success: false, error: 'Limit not found' };
  }

  if (limit.bypassType === 'none') {
    return { success: false, error: 'This limit cannot be bypassed' };
  }

  if (limit.bypassType === 'password') {
    if (!password) {
      return { success: false, error: 'Password required' };
    }
    if (!limit.passwordHash) {
      return { success: false, error: 'No password set for this limit' };
    }
    const valid = await verifyPassword(password, limit.passwordHash);
    if (!valid) {
      return { success: false, error: 'Invalid password' };
    }
  }

  // Grant 15 minutes bypass
  const bypassDuration = 15 * 60 * 1000;
  limit.bypassedUntil = Date.now() + bypassDuration;
  await updateDailyLimit(limit);

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

    // Skip if outside scheduled blocking period
    if (site.unlockType === 'schedule' && site.schedule) {
      const now = new Date();
      const day = now.getDay();
      const time = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

      const isBlockingDay = site.schedule.days.includes(day);
      const isBlockingTime = time >= site.schedule.startTime && time <= site.schedule.endTime;

      if (!isBlockingDay || !isBlockingTime) {
        continue;
      }
    }

    // Build URL filter
    let urlFilter: string;
    const patternHasPath = site.pattern.includes('/');

    if (patternHasPath) {
      // Pattern has a path component (e.g., domain.com/path/*)
      let filterPattern = site.pattern;
      // Remove trailing /* and replace with * for URL filter
      if (filterPattern.endsWith('/*')) {
        filterPattern = filterPattern.slice(0, -2) + '*';
      }
      if (filterPattern.startsWith('*.')) {
        urlFilter = `||${filterPattern.slice(2)}`;
      } else {
        urlFilter = `||${filterPattern}`;
      }
    } else if (site.pattern.startsWith('*.')) {
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

// End a specific session by tab ID
async function endSession(tabId: number): Promise<void> {
  const session = await removeActiveSession(tabId);
  if (session && session.startTime) {
    const duration = Math.round((Date.now() - session.startTime) / 1000);
    if (duration > 0) {
      await recordSession({
        domain: session.domain,
        startTime: session.startTime,
        endTime: Date.now(),
        windowId: session.windowId,
      });
    }
  }
}

// End all active sessions
async function endAllSessions(): Promise<void> {
  const activeSessions = await getActiveSessions();
  const now = Date.now();

  for (const [, session] of Object.entries(activeSessions)) {
    if (session.startTime) {
      const duration = Math.round((now - session.startTime) / 1000);
      if (duration > 0) {
        await recordSession({
          domain: session.domain,
          startTime: session.startTime,
          endTime: now,
          windowId: session.windowId,
        });
      }
    }
  }

  await clearActiveSessions();
}

// Start a session for a specific tab
async function startSession(tabId: number, url: string, windowId?: number): Promise<void> {
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

  // Get window ID if not provided
  let actualWindowId = windowId;
  if (!actualWindowId) {
    try {
      const tab = await chrome.tabs.get(tabId);
      actualWindowId = tab.windowId;
      if (actualWindowId) {
        const window = await chrome.windows.get(actualWindowId);
        if (window.state === 'minimized') {
          return; // Don't track minimized windows
        }
      }
    } catch {
      // Tab or window doesn't exist
      return;
    }
  }

  if (!actualWindowId) return;

  // Check if we already have a session for this tab
  const activeSessions = await getActiveSessions();
  const existingSession = activeSessions[tabId];

  if (existingSession) {
    // If domain changed, end current session and start new one
    if (existingSession.domain !== domain) {
      await endSession(tabId);
    } else {
      // Same domain, keep existing session
      return;
    }
  }

  // Start new session
  await addActiveSession(tabId, {
    domain,
    startTime: Date.now(),
    tabId,
    windowId: actualWindowId,
  });
}

// Tab change listeners
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  if (isUserIdle) return;

  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);

    // End the previous active tab's session in this window
    const activeSessions = await getActiveSessions();
    for (const [tabIdStr, session] of Object.entries(activeSessions)) {
      if (session.windowId === tab.windowId && parseInt(tabIdStr) !== activeInfo.tabId) {
        await endSession(parseInt(tabIdStr));
      }
    }

    // Start session for newly activated tab
    if (tab.url) {
      await startSession(activeInfo.tabId, tab.url, tab.windowId);
    }
  } catch {
    // Tab might not exist
  }
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.active && tab.url) {
    await startSession(tabId, tab.url, tab.windowId);
  }
});

chrome.tabs.onRemoved.addListener(async (tabId) => {
  await endSession(tabId);
  await endYouTubeSession(tabId);
});

chrome.windows.onFocusChanged.addListener(async (windowId) => {
  // For multi-window tracking, we don't end sessions when focus changes
  // Sessions continue in all visible windows
  // Only start a session for the newly focused window's active tab if needed
  if (windowId !== chrome.windows.WINDOW_ID_NONE && !isUserIdle) {
    try {
      const window = await chrome.windows.get(windowId);
      if (window.state !== 'minimized') {
        const [tab] = await chrome.tabs.query({ active: true, windowId });
        if (tab?.url && tab.id) {
          await startSession(tab.id, tab.url, windowId);
        }
      }
    } catch {
      // No active tab
    }
  }
});

// Handle window state changes (minimize/restore)
// Note: onBoundsChanged doesn't fire for minimize, so we use periodic checkMinimizedWindows

// Check for minimized windows periodically and handle them
async function checkMinimizedWindows(): Promise<void> {
  const activeSessions = await getActiveSessions();
  const windows = await chrome.windows.getAll({ windowTypes: ['normal'] });
  const minimizedWindowIds = new Set(
    windows.filter(w => w.state === 'minimized').map(w => w.id)
  );

  for (const [tabIdStr, session] of Object.entries(activeSessions)) {
    if (minimizedWindowIds.has(session.windowId)) {
      await endSession(parseInt(tabIdStr));
    }
  }
}

// Periodic save and cleanup
chrome.alarms.create('saveSession', { periodInMinutes: 1 });
chrome.alarms.create('cleanup', { periodInMinutes: 60 });
chrome.alarms.create('checkMinimized', { periodInMinutes: 0.25 }); // Every 15 seconds

chrome.alarms.onAlarm.addListener(async (alarm) => {
  // Restore idle state in case service worker was restarted
  await restoreIdleState();

  if (alarm.name === 'saveSession') {
    // Save progress for all active sessions
    const activeSessions = await getActiveSessions();
    const now = Date.now();

    for (const [tabIdStr, session] of Object.entries(activeSessions)) {
      const tabId = parseInt(tabIdStr);
      // Verify tab still exists and is active
      try {
        const tab = await chrome.tabs.get(tabId);
        if (tab.active && tab.windowId) {
          const window = await chrome.windows.get(tab.windowId);
          if (window.state !== 'minimized') {
            // Save session progress
            const duration = Math.round((now - session.startTime) / 1000);
            if (duration > 0) {
              await recordSession({
                domain: session.domain,
                startTime: session.startTime,
                endTime: now,
                windowId: session.windowId,
              });
              // Reset start time for next interval
              await addActiveSession(tabId, {
                ...session,
                startTime: now,
              });
            }
            continue;
          }
        }
        // Tab not active or window minimized - end session
        await endSession(tabId);
      } catch {
        // Tab doesn't exist anymore - end session
        await endSession(tabId);
      }
    }

    // Refresh blocking rules (for timer-based unlocks that may have expired)
    await updateBlockingRules();
  }

  if (alarm.name === 'checkMinimized') {
    await checkMinimizedWindows();
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
