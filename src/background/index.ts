import { OPTIONAL_CONTENT_SCRIPTS, syncOptionalContentScripts, updateOptionalFeatureInOpenTabs } from './optionalFeatures';
import { isSessionFresh } from './sessionTiming';
import { handleYouTubeChannelUpdate, handleYouTubeVisibilityChange, endYouTubeSession, endAllYouTubeSessions } from './playbackTracking';
import { isTrackingExcluded, normalizeExcludedDomains, validateHistoryRange } from '../shared/trackingPrivacy';
import { runTrackingTransition, trackingEvent } from './trackingTransitions';
import { updateBlockingRules, refreshBlockingRules } from './blockingRuleSync';
import {
  deleteHistoryRange,
  SUMMARY_DATES_KEY,
  SUMMARY_PREFIX,
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
  pruneDailyStats,
  getAllDailyStatsSummary,
  getSessionsForRange,
  incrementBlockedAttempt,
  recordSession,
  getActiveSessions,
  addActiveSession,
  removeActiveSession,
  verifyPassword,
  hashPassword,
  passwordHashNeedsUpgrade,
  getDomainCategories,
  setDomainCategory,
  getDailyLimits,
  addDailyLimit,
  updateDailyLimit,
  removeDailyLimit,
  checkDailyLimitForDomain,
  getActiveYouTubeSessions,
  getCustomCategories,
  setCustomCategories,
  addCustomCategory,
  updateCustomCategory,
  deleteCustomCategory,
  getBuiltInCategoryOverrides,
  setBuiltInCategoryName,
  migrateSessionsToCompactFormat,
  recordFocusSession,
  endFocusSession,
  pruneFocusSessions,
} from '../shared/storage';
import {
  blockedSiteMutationRequiresAuth,
  blockedSitesMutationRequiresAuth,
  dailyLimitMutationRequiresAuth,
} from './lockdownGuards';
import { ActiveSession, BlockedSite, MessageType, Settings, TrackingState } from '../shared/types';
import { verifyTotpCode } from '../shared/totp';
import { findBlockingSite } from './blockingRules';
import { decryptBackup, encryptBackup, isEncryptedBackup, validateImportData } from '../shared/backup';
import { replaceImportedData } from './importData';

// Session state keys for chrome.storage.session
const SESSION_KEYS = {
  IS_USER_IDLE: 'isUserIdle',
  LOCKDOWN_AUTH_UNTIL: 'lockdownAuthUntil',
} as const;

// In-memory idle state (restored from session storage on startup)
let isUserIdle = false;
let cachedSettings: Settings | null = null;

async function recordActiveSessionProgress(
  session: ActiveSession,
  endTime: number
): Promise<{ recorded: boolean; visitCounted: boolean }> {
  const duration = Math.round((endTime - session.startTime) / 1000);
  if (duration <= 0) {
    return { recorded: false, visitCounted: false };
  }

  const shouldCountVisit = !session.visitRecorded;
  await recordSession({
    domain: session.domain,
    startTime: session.startTime,
    endTime,
    windowId: session.windowId,
  }, {
    countVisit: shouldCountVisit,
  });

  return { recorded: true, visitCounted: shouldCountVisit };
}

async function getCachedSettings(): Promise<Settings> {
  if (cachedSettings) return cachedSettings;
  cachedSettings = await getSettings();
  return cachedSettings;
}

function trackingState(settings: Settings, url?: string): TrackingState {
  if (url && isTrackingExcluded(url, settings)) return { trackingEnabled: false, youtubeTrackingEnabled: false };
  return { trackingEnabled: settings.trackingEnabled, youtubeTrackingEnabled: settings.youtubeTrackingEnabled };
}

async function publishTrackingState(settings: Settings): Promise<void> {
  const tabs = await chrome.tabs.query({ url: ['http://*/*', 'https://*/*'] });
  await Promise.all(tabs.map(async tab => {
    if (tab.id === undefined) return;
    try {
      await chrome.tabs.sendMessage(tab.id, {
        type: 'TRACKING_STATE_CHANGED', payload: trackingState(settings, tab.url),
      }, { frameId: 0 });
    } catch {
      // Closed tabs and documents without a content script need no update.
    }
  }));
}

async function restrictStorageToExtensionContexts(): Promise<void> {
  await chrome.storage.local.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' });
}

function getGlobalFocusStatus(settings: Settings, now: number = Date.now()) {
  const isActive = !!settings.globalFocusUntil && now < settings.globalFocusUntil;
  const remainingMs = isActive && settings.globalFocusUntil ? settings.globalFocusUntil - now : 0;
  return {
    isActive,
    focusUntil: settings.globalFocusUntil,
    remainingMs,
    focusDuration: settings.globalFocusDuration,
  };
}

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

async function requiresLockdownAuthentication(message: MessageType): Promise<boolean> {
  const protectedTypes = new Set<MessageType['type']>([
    'REMOVE_BLOCKED_SITE',
    'REMOVE_BLOCKED_SITE_FOLDER',
    'CLEAR_TIMER_BLOCK',
    'STOP_FOCUS_SESSION',
    'STOP_GLOBAL_FOCUS_SESSION',
    'REMOVE_DAILY_LIMIT',
    'CLEAR_ALL_DATA',
    'DELETE_HISTORY_RANGE',
    'IMPORT_DATA',
  ]);

  let protectedMutation = protectedTypes.has(message.type);
  if (message.type === 'UPDATE_SETTINGS') {
    const patch = message.payload;
    protectedMutation = patch.blockingEnabled === false ||
      patch.lockdownEnabled === false ||
      Object.prototype.hasOwnProperty.call(patch, 'passwordHash') ||
      Object.prototype.hasOwnProperty.call(patch, 'lockdownAuthMethod') ||
      Object.prototype.hasOwnProperty.call(patch, 'lockdownTotpSecret');
  } else if (message.type === 'UPDATE_BLOCKED_SITE') {
    const current = (await getBlockedSites()).find(site => site.id === message.payload.id);
    protectedMutation = !!current && blockedSiteMutationRequiresAuth(current, message.payload);
  } else if (message.type === 'UPDATE_BLOCKED_SITES') {
    const currentSites = await getBlockedSites();
    protectedMutation = blockedSitesMutationRequiresAuth(currentSites, message.payload);
  } else if (message.type === 'UPDATE_DAILY_LIMIT') {
    const current = (await getDailyLimits()).find(limit => limit.id === message.payload.id);
    protectedMutation = !!current && dailyLimitMutationRequiresAuth(current, message.payload);
  }

  if (!protectedMutation) return false;

  const settings = await getCachedSettings();
  return !!settings.lockdownEnabled && !(await isLockdownSessionValid());
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

      // Check if tab is still active in a visible window with recent heartbeat
      if (tab.active && tab.windowId) {
        const window = await chrome.windows.get(tab.windowId);
        if (window.focused && window.state !== 'minimized' && isSessionFresh(session)) {
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
        await recordActiveSessionProgress(session, Date.now());
      }
      await removeActiveSession(tabId);
    }
  }

  // Start tracking for the currently focused Chrome window if not idle.
  if (!isUserIdle) {
    await startFocusedWindowSession();
  }
}

async function startFocusedWindowSession(): Promise<void> {
  const settings = await getCachedSettings();
  if (!settings.trackingEnabled) return;

  try {
    const window = await chrome.windows.getLastFocused({ windowTypes: ['normal'] });
    if (window.focused && window.state !== 'minimized' && window.id) {
      const [tab] = await chrome.tabs.query({ active: true, windowId: window.id });
      if (tab?.url && tab.id) {
        await startSession(tab.id, tab.url);
      }
    }
  } catch {
    // Chrome has no focused normal window.
  }
}

// Initialize extension
chrome.runtime.onInstalled.addListener(trackingEvent('install', async () => {
  try {
    console.log('BrowserUtils extension installed/updated');
    await restrictStorageToExtensionContexts();
    const settings = await getCachedSettings();
    await syncOptionalContentScripts(settings);
    await updateBlockingRules();
    await setupIdleDetection();
    await migrateSessionsToCompactFormat();
  } catch (error) {
    console.error('[Startup] Failed to install or update extension state', error);
  }
}));

// Service worker startup - restore state and recover session
runTrackingTransition(async () => {
  await restrictStorageToExtensionContexts();
  const settings = await getCachedSettings();
  await syncOptionalContentScripts(settings);
  await setupIdleDetection();
  await updateBlockingRules();
  await recoverSession();
}).catch(error => {
  console.error('[Startup] Failed to initialize extension state', error);
});

// Set up idle detection based on settings
async function setupIdleDetection(): Promise<void> {
  const settings = await getCachedSettings();
  if (settings.idleThreshold > 0) {
    // Minimum is 15 seconds for chrome.idle API
    const threshold = Math.max(15, settings.idleThreshold);
    chrome.idle.setDetectionInterval(threshold);
  }
}

// Handle idle state changes
chrome.idle.onStateChanged.addListener(trackingEvent('idle change', async (state) => {
  const settings = await getCachedSettings();

  // If idle detection is disabled, ignore
  if (settings.idleThreshold === 0) {
    return;
  }

  if (state === 'active') {
    // User became active again
    if (isUserIdle) {
      isUserIdle = false;
      await saveIdleState();
      await startFocusedWindowSession();
    }
  } else {
    // User is idle or locked
    if (!isUserIdle) {
      isUserIdle = true;
      await saveIdleState();

      // Preserve only sessions that are actively producing audio. Marking the
      // user idle prevents every other visible tab from starting again.
      const activeSessions = await getActiveSessions();
      for (const [tabIdStr] of Object.entries(activeSessions)) {
        const tabId = parseInt(tabIdStr);
        try {
          const tab = await chrome.tabs.get(tabId);
          if (!tab.audible) await endSession(tabId);
        } catch {
          await endSession(tabId);
        }
      }
    }
  }
}));


// Tracking messages and reset/settings mutations share the event queue. Reads,
// downloads and unrelated UI operations do not hold up tracking checkpoints.
// Other settings writers also join the queue to keep cachedSettings coherent.
const CONTENT_TRACKING_MESSAGES = new Set<MessageType['type']>([
  'HEARTBEAT', 'VISIBILITY_CHANGE', 'CONTENT_SCRIPT_READY',
  'YOUTUBE_CHANNEL_UPDATE', 'YOUTUBE_VISIBILITY_CHANGE',
]);
const TRACKING_MUTATIONS = new Set<MessageType['type']>([
  ...CONTENT_TRACKING_MESSAGES, 'GET_TRACKING_STATE', 'UPDATE_SETTINGS', 'CLEAR_ALL_DATA', 'IMPORT_DATA', 'DELETE_HISTORY_RANGE',
  'START_GLOBAL_FOCUS_SESSION', 'STOP_GLOBAL_FOCUS_SESSION', 'LOCKDOWN_AUTHENTICATE',
]);

async function handleTrackingMessage(message: MessageType, sender: chrome.runtime.MessageSender): Promise<unknown> {
  if (CONTENT_TRACKING_MESSAGES.has(message.type)) {
    if (sender.tab?.id === undefined) return { success: true };
    let tab: chrome.tabs.Tab;
    try {
      // A queued message's sender is a snapshot. Recheck ownership and URL after
      // earlier transitions: a closed, switched or navigated tab cannot revive it.
      tab = await chrome.tabs.get(sender.tab.id);
    } catch {
      return { success: true };
    }
    if (tab.url !== sender.tab.url) return { success: true };
    if (tab.url && isTrackingExcluded(tab.url, await getCachedSettings())) {
      await endSession(tab.id!);
      await endYouTubeSession(tab.id!);
      return { success: true };
    }
    sender = { ...sender, tab };
  }
  return handleMessage(message, sender);
}

// Handle messages from popup, dashboard, and content scripts
chrome.runtime.onMessage.addListener((message: MessageType, sender, sendResponse) => {
  const response = TRACKING_MUTATIONS.has(message.type)
    ? runTrackingTransition(() => handleTrackingMessage(message, sender))
    : handleMessage(message, sender);
  response.then(sendResponse)
    .catch(error => {
      console.error(`[Message] ${message?.type || 'unknown'} failed`, error);
      sendResponse({
        success: false,
        error: error instanceof Error ? error.message : 'Unexpected extension error',
      });
    });
  return true; // Keep channel open for async response
});

async function handleMessage(message: MessageType, sender?: chrome.runtime.MessageSender): Promise<unknown> {
  if (await requiresLockdownAuthentication(message)) {
    return {
      success: false,
      requiresAuth: true,
      error: 'Lockdown authentication required',
    };
  }

  switch (message.type) {
    case 'GET_STATS': {
      if (message.payload?.date) {
        return getDailyStats(message.payload.date);
      }
      return getAllDailyStats();
    }
    case 'GET_STATS_SUMMARY': {
      return getAllDailyStatsSummary();
    }
    case 'GET_SESSIONS_FOR_RANGE': {
      return getSessionsForRange(message.payload.startDate, message.payload.endDate);
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
    case 'START_TIMER_BLOCK': {
      return startTimerBlock(message.payload.id, message.payload.durationMinutes);
    }
    case 'CLEAR_TIMER_BLOCK': {
      return clearTimerBlock(message.payload.id);
    }
    case 'GET_TIMER_STATUS': {
      const sites = await getBlockedSites();
      const site = sites.find(s => s.id === message.payload.id);
      if (!site) {
        return { found: false };
      }
      const now = Date.now();
      const isActive = site.timerBlockedUntil ? now < site.timerBlockedUntil : false;
      const remainingMs = isActive && site.timerBlockedUntil ? site.timerBlockedUntil - now : 0;
      return {
        found: true,
        isActive,
        blockedUntil: site.timerBlockedUntil,
        remainingMs,
        timerDuration: site.timerDuration,
      };
    }
    case 'GET_BLOCKED_SITES': {
      return getBlockedSites();
    }
    case 'GET_TRACKING_STATE': {
      return trackingState(await getCachedSettings(), sender?.tab?.url);
    }
    case 'GET_SETTINGS': {
      return getCachedSettings();
    }
    case 'GET_STORAGE_USAGE': {
      return {
        bytesInUse: await chrome.storage.local.getBytesInUse(null),
        quotaBytes: chrome.storage.local.QUOTA_BYTES,
      };
    }
    case 'UPDATE_SETTINGS': {
      if (message.payload.excludedDomains !== undefined) {
        message.payload.excludedDomains = normalizeExcludedDomains(message.payload.excludedDomains);
      }
      const previousSettings = await getCachedSettings();
      const settings = await updateSettings(message.payload);
      cachedSettings = settings;
      if (message.payload.excludedDomains !== undefined) {
        const active = await getActiveSessions();
        for (const session of Object.values(active)) {
          if (isTrackingExcluded(session.domain, settings)) await endSession(session.tabId);
        }
        const playback = await getActiveYouTubeSessions();
        if (isTrackingExcluded('www.youtube.com', settings)) {
          for (const session of Object.values(playback)) await endYouTubeSession(session.tabId);
        }
      }
      if (message.payload.excludedDomains !== undefined || previousSettings.trackingEnabled !== settings.trackingEnabled ||
          previousSettings.youtubeTrackingEnabled !== settings.youtubeTrackingEnabled) {
        await publishTrackingState(settings);
      }
      if (!settings.trackingEnabled) await endAllSessions();
      if (!settings.youtubeTrackingEnabled) await endAllYouTubeSessions();
      if (!previousSettings.trackingEnabled && settings.trackingEnabled) {
        await startFocusedWindowSession();
      }
      await syncOptionalContentScripts(settings);
      for (const script of OPTIONAL_CONTENT_SCRIPTS) {
        if (
          message.payload[script.setting] !== undefined &&
          previousSettings[script.setting] !== settings[script.setting]
        ) {
          await updateOptionalFeatureInOpenTabs(script.feature, settings[script.setting]);
        }
      }
      await updateBlockingRules();
      // Update idle detection if threshold changed
      if (message.payload.idleThreshold !== undefined) {
        await setupIdleDetection();
      }
      return settings;
    }
    case 'DELETE_HISTORY_RANGE': {
      const { startDate, endDate } = message.payload;
      validateHistoryRange(startDate, endDate);
      await endAllSessions();
      await endAllYouTubeSessions();
      const deletedDays = await deleteHistoryRange(startDate, endDate);
      await startFocusedWindowSession();
      return { success: true, deletedDays };
    }
    case 'CLEAR_ALL_DATA': {
      await resetAllData();
      return { success: true };
    }
    case 'EXPORT_DATA': {
      const data = await chrome.storage.local.get(null);
      delete data[SUMMARY_DATES_KEY];
      for (const key of Object.keys(data)) if (key.startsWith(SUMMARY_PREFIX)) delete data[key];
      delete data.activeSessions;
      delete data.activeYouTubeSessions;
      return { success: true, backup: await encryptBackup(data, message.payload.password) };
    }
    case 'IMPORT_DATA': {
      const data = isEncryptedBackup(message.payload.backup)
        ? await decryptBackup(message.payload.backup, message.payload.password)
        : message.payload.backup;
      return importAllData(data);
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
          redirectUrl: chrome.runtime.getURL(`blocked.html?site=${result.site.id}&returnUrl=${encodeURIComponent(message.payload.url)}`),
        };
      }

      // Then check daily limits
      const domain = getDomainFromUrl(message.payload.url);
      if (domain) {
        const limitResult = await checkDailyLimitForDomain(domain);
        if (limitResult.exceeded && limitResult.limit) {
          return {
            blocked: true,
            redirectUrl: chrome.runtime.getURL(`blocked.html?type=limit&limitId=${limitResult.limit.id}&returnUrl=${encodeURIComponent(message.payload.url)}`),
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
      const folder = await addBlockedSiteFolder(message.payload);
      await updateBlockingRules();
      return folder;
    }
    case 'UPDATE_BLOCKED_SITE_FOLDER': {
      await updateBlockedSiteFolder(message.payload);
      await updateBlockingRules();
      return { success: true };
    }
    case 'UPDATE_BLOCKED_SITE_FOLDERS': {
      await setBlockedSiteFolders(message.payload);
      await updateBlockingRules();
      return { success: true };
    }
    case 'REMOVE_BLOCKED_SITE_FOLDER': {
      await removeBlockedSiteFolder(message.payload.id);
      await updateBlockingRules();
      return { success: true };
    }
    // Focus session operations
    case 'START_FOCUS_SESSION': {
      const folders = await getBlockedSiteFolders();
      const folder = folders.find(f => f.id === message.payload.folderId);
      if (!folder) {
        return { success: false, error: 'Folder not found' };
      }
      const startTime = Date.now();
      const wasActive = Boolean(folder.focusUntil && folder.focusUntil > startTime);
      const focusUntil = startTime + message.payload.durationMinutes * 60 * 1000;
      folder.focusUntil = focusUntil;
      folder.focusDuration = message.payload.durationMinutes;
      await updateBlockedSiteFolder(folder);
      await recordFocusSession({
        targetType: 'folder',
        targetId: folder.id,
        targetName: folder.name,
        startTime,
        plannedEndTime: focusUntil,
      }, wasActive);
      await updateBlockingRules();
      return { success: true, focusUntil };
    }
    case 'STOP_FOCUS_SESSION': {
      const folders = await getBlockedSiteFolders();
      const folder = folders.find(f => f.id === message.payload.folderId);
      if (!folder) {
        return { success: false, error: 'Folder not found' };
      }
      await endFocusSession('folder', folder.id);
      folder.focusUntil = undefined;
      await updateBlockedSiteFolder(folder);
      await updateBlockingRules();
      return { success: true };
    }
    case 'GET_FOCUS_STATUS': {
      const folders = await getBlockedSiteFolders();
      const folder = folders.find(f => f.id === message.payload.folderId);
      if (!folder) {
        return { found: false };
      }
      const now = Date.now();
      const isActive = folder.focusUntil ? now < folder.focusUntil : false;
      const remainingMs = isActive && folder.focusUntil ? folder.focusUntil - now : 0;
      return {
        found: true,
        isActive,
        focusUntil: folder.focusUntil,
        remainingMs,
        focusDuration: folder.focusDuration,
      };
    }
    case 'START_GLOBAL_FOCUS_SESSION': {
      const settings = await getCachedSettings();
      const startTime = Date.now();
      const wasActive = Boolean(settings.globalFocusUntil && settings.globalFocusUntil > startTime);
      const focusUntil = startTime + message.payload.durationMinutes * 60 * 1000;
      const updatedSettings = await updateSettings({
        globalFocusUntil: focusUntil,
        globalFocusDuration: message.payload.durationMinutes,
      });
      await recordFocusSession({
        targetType: 'global',
        targetName: 'All blocked sites',
        startTime,
        plannedEndTime: focusUntil,
      }, wasActive);
      cachedSettings = updatedSettings;
      await updateBlockingRules();
      return { success: true, focusUntil };
    }
    case 'STOP_GLOBAL_FOCUS_SESSION': {
      await endFocusSession('global', undefined);
      const updatedSettings = await updateSettings({
        globalFocusUntil: undefined,
      });
      cachedSettings = updatedSettings;
      await updateBlockingRules();
      return { success: true };
    }
    case 'GET_GLOBAL_FOCUS_STATUS': {
      const settings = await getCachedSettings();
      return getGlobalFocusStatus(settings);
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
    case 'DOWNLOAD_URL': {
      const id = await chrome.downloads.download({
        url: message.payload.url,
        filename: message.payload.filename,
        conflictAction: 'uniquify',
      });
      return { success: true, id };
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
    // Custom category operations
    case 'GET_CUSTOM_CATEGORIES': {
      return getCustomCategories();
    }
    case 'ADD_CUSTOM_CATEGORY': {
      return addCustomCategory(message.payload);
    }
    case 'UPDATE_CUSTOM_CATEGORY': {
      await updateCustomCategory(message.payload);
      return { success: true };
    }
    case 'UPDATE_CUSTOM_CATEGORIES': {
      await setCustomCategories(message.payload);
      return { success: true };
    }
    case 'DELETE_CUSTOM_CATEGORY': {
      await deleteCustomCategory(message.payload.id);
      return { success: true };
    }
    // Built-in category overrides
    case 'GET_BUILTIN_CATEGORY_OVERRIDES': {
      return getBuiltInCategoryOverrides();
    }
    case 'SET_BUILTIN_CATEGORY_NAME': {
      await setBuiltInCategoryName(message.payload.id, message.payload.name);
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
      const settings = await getCachedSettings();
      const sessionValid = await isLockdownSessionValid();
      const authUntil = await getLockdownAuthUntil();
      return {
        lockdownEnabled: settings.lockdownEnabled ?? false,
        hasPassword: !!settings.passwordHash,
        hasTotp: !!settings.lockdownTotpSecret,
        authMethod: settings.lockdownAuthMethod ?? 'password',
        sessionValid,
        sessionExpiresAt: authUntil,
      };
    }
    case 'LOCKDOWN_AUTHENTICATE': {
      const settings = await getCachedSettings();
      const authMethod = settings.lockdownAuthMethod ?? 'password';
      let valid = false;

      if (authMethod === 'totp') {
        if (!settings.lockdownTotpSecret) {
          return { success: false, error: 'Authenticator app is not set up' };
        }
        valid = await verifyTotpCode(settings.lockdownTotpSecret, message.payload.credential);
      } else {
        if (!settings.passwordHash) {
          return { success: false, error: 'No master password set' };
        }
        valid = await verifyPassword(message.payload.credential, settings.passwordHash);
        if (valid && passwordHashNeedsUpgrade(settings.passwordHash)) {
          settings.passwordHash = await hashPassword(message.payload.credential);
          cachedSettings = await updateSettings({ passwordHash: settings.passwordHash });
        }
      }

      if (!valid) {
        return { success: false, error: authMethod === 'totp' ? 'Invalid code' : 'Invalid password' };
      }
      const expiresAt = await startLockdownSession();
      return { success: true, expiresAt };
    }
    case 'LOCKDOWN_CLEAR_SESSION': {
      await clearLockdownSession();
      return { success: true };
    }
    case 'GET_ACTIVE_YOUTUBE_SESSIONS': {
      return getActiveYouTubeSessions();
    }
    default:
      return { error: 'Unknown message type' };
  }
}

async function resetRuntimeState(): Promise<void> {
  cachedSettings = null;
  isUserIdle = false;
  await saveIdleState();
  await setupIdleDetection();
  await updateBlockingRules();
  await startFocusedWindowSession();
  await publishTrackingState(await getCachedSettings());
}

async function resetAllData(): Promise<void> {
  await endAllSessions();
  await endAllYouTubeSessions();
  await chrome.storage.local.clear();
  await chrome.storage.session.clear();
  await resetRuntimeState();
}

async function importAllData(data: unknown): Promise<{ success: boolean; error?: string }> {
  const validationError = validateImportData(data);
  if (validationError) return { success: false, error: validationError };

  await endAllSessions();
  await endAllYouTubeSessions();

  try {
    await replaceImportedData(data, async () => {
      await chrome.storage.session.clear();
      cachedSettings = null;
      await migrateSessionsToCompactFormat();
      await resetRuntimeState();
    });
  } catch (error) {
    cachedSettings = null;
    await resetRuntimeState().catch(resetError => {
      console.error('[Import] Failed to restore runtime state after rollback', resetError);
    });
    throw error;
  }
  return { success: true };
}

async function enforceDailyLimit(
  tabId: number,
  url: string,
  domain: string,
  additionalSeconds = 0,
  persistActiveSession = true
): Promise<boolean> {
  const result = await checkDailyLimitForDomain(domain, additionalSeconds);
  if (!result.exceeded || !result.limit) return false;

  if (persistActiveSession) {
    await endSession(tabId);
  } else {
    await removeActiveSession(tabId);
  }

  const blockedUrl = chrome.runtime.getURL(
    `blocked.html?type=limit&limitId=${result.limit.id}&returnUrl=${encodeURIComponent(url)}`
  );
  await chrome.tabs.update(tabId, { url: blockedUrl });
  return true;
}

// Handle heartbeat from content script - keeps active sessions fresh between saves.
async function handleHeartbeat(sender?: chrome.runtime.MessageSender): Promise<void> {
  if (!sender?.tab?.id || !sender.tab.url) return;

  const settings = await getCachedSettings();
  if (!settings.trackingEnabled) return;
  if (!sender.tab.active) {
    await endSession(sender.tab.id);
    return;
  }

  const tabId = sender.tab.id;
  const url = sender.tab.url;
  const windowId = sender.tab.windowId ?? 0;
  const domain = getDomainFromUrl(url);
  if (!domain) return;

  // Skip chrome:// and extension pages
  if (url.startsWith('chrome://') || url.startsWith('chrome-extension://')) {
    return;
  }

  try {
    const window = await chrome.windows.get(windowId);
    if (!window.focused || window.state === 'minimized') {
      await endSession(tabId);
      return;
    }
  } catch {
    await endSession(tabId);
    return;
  }

  if (isUserIdle && !sender.tab.audible) {
    await endSession(tabId);
    return;
  }

  const now = Date.now();
  const activeSessions = await getActiveSessions();
  const session = activeSessions[tabId];

  // If this tab has an active session, keep it alive without writing durable stats.
  if (session) {
    if (session.domain !== domain || !isSessionFresh(session, now)) {
      await endSession(tabId);

      if (sender.tab.active && !isUserIdle) {
        try {
          const window = await chrome.windows.get(windowId);
          if (window.focused && window.state !== 'minimized') {
            await addActiveSession(tabId, {
              domain,
              startTime: now,
              lastActiveTime: now,
              tabId,
              windowId,
              visitRecorded: false,
            });
          }
        } catch {
          // Window doesn't exist
        }
      }
      return;
    }

    await addActiveSession(tabId, {
      ...session,
      lastActiveTime: now,
    });

    const unsavedSeconds = Math.max(0, Math.floor((now - session.startTime) / 1000));
    await enforceDailyLimit(tabId, url, domain, unsavedSeconds);
  } else if (sender.tab.active && !isUserIdle) {
    // No active session for this tab - start one if tab is active and visible
    try {
      const window = await chrome.windows.get(windowId);
      if (window.focused && window.state !== 'minimized') {
        await addActiveSession(tabId, {
          domain,
          startTime: now,
          lastActiveTime: now,
          tabId,
          windowId,
          visitRecorded: false,
        });
        await enforceDailyLimit(tabId, url, domain);
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

  const settings = await getCachedSettings();
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
        if (window.focused && window.state !== 'minimized') {
          const activeSessions = await getActiveSessions();
          // Start new session if we don't have one for this tab
          if (!activeSessions[tabId]) {
            const now = Date.now();
            await addActiveSession(tabId, {
              domain,
              startTime: now,
              lastActiveTime: now,
              tabId,
              windowId,
              visitRecorded: false,
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

async function unlockSite(id: string, password?: string): Promise<{ success: boolean; error?: string }> {
  const sites = await getBlockedSites();
  const site = sites.find(s => s.id === id);

  if (!site) {
    return { success: false, error: 'Site not found' };
  }

  if (site.unlockType !== 'password' || !site.passwordHash) {
    return { success: false, error: 'This site does not have a password unlock configured' };
  }
  if (!password) {
    return { success: false, error: 'Password required' };
  }
  const valid = await verifyPassword(password, site.passwordHash);
  if (!valid) {
    return { success: false, error: 'Invalid password' };
  }

  if (passwordHashNeedsUpgrade(site.passwordHash)) {
    site.passwordHash = await hashPassword(password);
  }

  site.unlockedUntil = Date.now() + 15 * 60 * 1000;
  await updateBlockedSite(site);
  await updateBlockingRules();
  await chrome.alarms.create(`siteUnlock:${site.id}`, { when: site.unlockedUntil });
  return { success: true };
}

// Start a timer block for a site
async function startTimerBlock(id: string, durationMinutes?: number): Promise<{ success: boolean; error?: string; blockedUntil?: number }> {
  const sites = await getBlockedSites();
  const site = sites.find(s => s.id === id);

  if (!site) {
    return { success: false, error: 'Site not found' };
  }

  if (site.unlockType !== 'timer') {
    return { success: false, error: 'Site does not use timer blocking' };
  }

  const duration = durationMinutes ?? site.timerDuration ?? 30;
  const blockedUntil = Date.now() + duration * 60 * 1000;
  site.timerBlockedUntil = blockedUntil;
  await updateBlockedSite(site);
  await updateBlockingRules();

  return { success: true, blockedUntil };
}

// Clear a timer block for a site
async function clearTimerBlock(id: string): Promise<{ success: boolean; error?: string }> {
  const sites = await getBlockedSites();
  const site = sites.find(s => s.id === id);

  if (!site) {
    return { success: false, error: 'Site not found' };
  }

  site.timerBlockedUntil = undefined;
  await updateBlockedSite(site);
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
    if (passwordHashNeedsUpgrade(limit.passwordHash)) {
      limit.passwordHash = await hashPassword(password);
    }
  }

  // Grant 15 minutes bypass
  const bypassDuration = 15 * 60 * 1000;
  limit.bypassedUntil = Date.now() + bypassDuration;
  await updateDailyLimit(limit);

  return { success: true };
}

async function checkIfBlocked(url: string): Promise<{ blocked: boolean; site?: BlockedSite }> {
  const settings = await getCachedSettings();
  if (!settings.blockingEnabled) {
    return { blocked: false };
  }

  const sites = await getBlockedSites();
  const folders = await getBlockedSiteFolders();
  const now = Date.now();
  const globalFocus = getGlobalFocusStatus(settings, now);

  // Build a map of folder IDs with active focus sessions
  const activeFocusFolders = new Set<string>();
  for (const folder of folders) {
    if (folder.focusUntil && now < folder.focusUntil) {
      activeFocusFolders.add(folder.id);
    }
  }

  const site = findBlockingSite(url, sites, {
    now,
    globalFocusActive: globalFocus.isActive,
    activeFocusFolderIds: activeFocusFolders,
  });
  return site ? { blocked: true, site } : { blocked: false };
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
    const now = Date.now();
    // Cap end time at lastActiveTime + 30 seconds to prevent over-recording
    // when sessions become stale (e.g., window minimized but alarm didn't fire)
    const maxEndTime = session.lastActiveTime ? session.lastActiveTime + 30000 : now;
    const endTime = Math.min(now, maxEndTime);
    await recordActiveSessionProgress(session, endTime);
  }
}

// End all active sessions
async function endAllSessions(): Promise<void> {
  const activeSessions = await getActiveSessions();

  // Use endSession for each to prevent race conditions
  // (if endSession is called concurrently, we won't double-record)
  for (const [tabIdStr] of Object.entries(activeSessions)) {
    await endSession(parseInt(tabIdStr));
  }
}

// Start a session for a specific tab
async function startSession(tabId: number, url: string): Promise<void> {
  const settings = await getCachedSettings();
  if (!settings.trackingEnabled || isTrackingExcluded(url, settings)) return;

  // Don't start session if user is idle
  if (isUserIdle) return;

  const domain = getDomainFromUrl(url);
  if (!domain) return;

  // Skip chrome:// and extension pages
  if (url.startsWith('chrome://') || url.startsWith('chrome-extension://')) {
    return;
  }

  let actualWindowId: number;
  // Tab activation/update events can be queued behind another transition.
  // Confirm that their snapshot still describes the active document.
  try {
    const tab = await chrome.tabs.get(tabId);
    if (!tab.active || tab.url !== url) return;
    actualWindowId = tab.windowId;
  } catch {
    return;
  }

  try {
    const window = await chrome.windows.get(actualWindowId);
    if (!window.focused || window.state === 'minimized') return;
  } catch {
    return;
  }

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
  const now = Date.now();
  await addActiveSession(tabId, {
    domain,
    startTime: now,
    lastActiveTime: now,
    tabId,
    windowId: actualWindowId,
    visitRecorded: false,
  });

  await enforceDailyLimit(tabId, url, domain);
}

// Tab change listeners
chrome.tabs.onActivated.addListener(trackingEvent('tab activation', async (activeInfo) => {
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
      await startSession(activeInfo.tabId, tab.url);
    }
  } catch {
    // Tab might not exist
  }
}));

chrome.tabs.onUpdated.addListener(trackingEvent('tab update', async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.active && tab.url) {
    await startSession(tabId, tab.url);
  }
}));

chrome.tabs.onRemoved.addListener(trackingEvent('tab removal', async (tabId) => {
  await endSession(tabId);
  await endYouTubeSession(tabId);
}));

// Intercept navigations to blocked sites and redirect to blocked page
// This handles cases where declarativeNetRequest redirect fails (e.g., cross-origin link clicks)
chrome.webNavigation.onBeforeNavigate.addListener(async (details) => {
  // Only handle main frame navigations
  if (details.frameId !== 0) return;

  // Skip extension pages
  if (details.url.startsWith('chrome-extension://')) return;

  // Check if site is blocked
  const result = await checkIfBlocked(details.url);
  if (result.blocked && result.site) {
    // Increment blocked attempt counter
    await incrementBlockedAttempt(result.site.pattern);

    // Redirect to blocked page
    const blockedUrl = chrome.runtime.getURL(`blocked.html?site=${result.site.id}&returnUrl=${encodeURIComponent(details.url)}`);
    chrome.tabs.update(details.tabId, { url: blockedUrl });
    return;
  }

  // Check daily limits
  const domain = getDomainFromUrl(details.url);
  if (domain) {
    const limitResult = await checkDailyLimitForDomain(domain);
    if (limitResult.exceeded && limitResult.limit) {
      const blockedUrl = chrome.runtime.getURL(`blocked.html?type=limit&limitId=${limitResult.limit.id}&returnUrl=${encodeURIComponent(details.url)}`);
      chrome.tabs.update(details.tabId, { url: blockedUrl });
    }
  }
});

chrome.windows.onFocusChanged.addListener(trackingEvent('window focus', async (windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    await endAllSessions();
    return;
  }

  if (isUserIdle) return;

  // A single Chrome window owns general browsing time. End every session from
  // other windows before starting the newly focused tab.
  try {
    const activeSessions = await getActiveSessions();
    for (const [tabIdStr, session] of Object.entries(activeSessions)) {
      if (session.windowId !== windowId) {
        await endSession(parseInt(tabIdStr));
      }
    }
  } catch {
    // Error checking sessions
  }

  // Start a session for the newly focused window's active tab if not minimized
  try {
    const window = await chrome.windows.get(windowId);
    if (window.state !== 'minimized') {
      const [tab] = await chrome.tabs.query({ active: true, windowId });
      if (tab?.url && tab.id) {
        await startSession(tab.id, tab.url);
      }
    }
  } catch {
    // No active tab or window
  }
}));

// Handle window state changes (minimize/restore)
// Note: onBoundsChanged does not fire for minimize, so a periodic check backs up
// focus and window-state events.

// Check for minimized or unfocused windows periodically and handle them.
async function checkInactiveWindows(): Promise<void> {
  const now = Date.now();
  const activeSessions = await getActiveSessions();
  const windows = await chrome.windows.getAll({ windowTypes: ['normal'] });
  const inactiveWindowIds = new Set(
    windows.filter(w => !w.focused || w.state === 'minimized').map(w => w.id)
  );

  for (const [tabIdStr, session] of Object.entries(activeSessions)) {
    if (inactiveWindowIds.has(session.windowId) || !isSessionFresh(session, now)) {
      await endSession(parseInt(tabIdStr));
    }
  }
}

// Periodic save and cleanup
chrome.alarms.create('saveSession', { periodInMinutes: 1 });
chrome.alarms.create('cleanup', { periodInMinutes: 60 });
chrome.alarms.create('checkMinimized', { periodInMinutes: 0.5 }); // Chrome's production minimum: 30 seconds

chrome.alarms.onAlarm.addListener(trackingEvent('alarm', async (alarm) => {
  // Restore idle state in case service worker was restarted
  await restoreIdleState();

  if (alarm.name.startsWith('siteUnlock:')) {
    await refreshBlockingRules();
    return;
  }

  if (alarm.name === 'saveSession') {
    // Save progress for all active sessions
    const activeSessions = await getActiveSessions();
    const now = Date.now();

    for (const [tabIdStr, session] of Object.entries(activeSessions)) {
      const tabId = parseInt(tabIdStr);

      // No recent heartbeat means page is no longer verifiably visible.
      if (!isSessionFresh(session, now)) {
        await endSession(tabId);
        continue;
      }

      // Verify tab still exists and is active
      try {
        const tab = await chrome.tabs.get(tabId);
        if (tab.active && tab.windowId) {
          const window = await chrome.windows.get(tab.windowId);
          if (window.focused && window.state !== 'minimized') {
            const endTime = Math.min(now, session.lastActiveTime);
            const progress = await recordActiveSessionProgress(session, endTime);
            if (progress.recorded) {
              if (tab.url && await enforceDailyLimit(tabId, tab.url, session.domain, 0, false)) {
                continue;
              }
              await addActiveSession(tabId, {
                ...session,
                startTime: endTime,
                visitRecorded: session.visitRecorded || progress.visitCounted,
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

    // Only apply rules if a schedule, unlock, timer or focus boundary changed.
    await refreshBlockingRules();
  }

  if (alarm.name === 'checkMinimized') {
    await checkInactiveWindows();
  }

  if (alarm.name === 'cleanup') {
    // Clean up old stats based on retention setting
    const settings = await getSettings();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - settings.retentionDays);
    const cutoffStr = `${cutoffDate.getFullYear()}-${String(cutoffDate.getMonth() + 1).padStart(2, '0')}-${String(cutoffDate.getDate()).padStart(2, '0')}`;

    await pruneDailyStats(cutoffStr);
    await pruneFocusSessions(cutoffStr);
  }
}));
