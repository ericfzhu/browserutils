import { BlockedSite, BlockedSiteFolder, DailyStats, SiteSession, ActiveSession, Settings, DEFAULT_SETTINGS, SiteCategory, DailyLimit, YouTubeChannelSession, ActiveYouTubeSession, CustomCategory, CompactSessions, CompactYouTubeSessions } from './types';
import { getLocalDateString, splitIntervalByLocalDay } from './time';

const STORAGE_KEYS = {
  BLOCKED_SITES: 'blockedSites',
  BLOCKED_SITE_FOLDERS: 'blockedSiteFolders',
  SETTINGS: 'settings',
  DAILY_STATS: 'dailyStats',
  ACTIVE_SESSIONS: 'activeSessions',
  ACTIVE_YOUTUBE_SESSIONS: 'activeYouTubeSessions',
  DOMAIN_CATEGORIES: 'domainCategories',
  DAILY_LIMITS: 'dailyLimits',
  CUSTOM_CATEGORIES: 'customCategories',
  BUILTIN_CATEGORY_OVERRIDES: 'builtInCategoryOverrides',
} as const;

export async function getBlockedSites(): Promise<BlockedSite[]> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.BLOCKED_SITES);
  return result[STORAGE_KEYS.BLOCKED_SITES] || [];
}

export async function setBlockedSites(sites: BlockedSite[]): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.BLOCKED_SITES]: sites });
}

export async function addBlockedSite(site: Omit<BlockedSite, 'id' | 'createdAt'>): Promise<BlockedSite> {
  const sites = await getBlockedSites();
  const newSite: BlockedSite = {
    ...site,
    id: crypto.randomUUID(),
    createdAt: Date.now(),
  };
  sites.push(newSite);
  await setBlockedSites(sites);
  return newSite;
}

export async function removeBlockedSite(id: string): Promise<void> {
  const sites = await getBlockedSites();
  const filtered = sites.filter(s => s.id !== id);
  await setBlockedSites(filtered);
}

export async function updateBlockedSite(site: BlockedSite): Promise<void> {
  const sites = await getBlockedSites();
  const index = sites.findIndex(s => s.id === site.id);
  if (index !== -1) {
    sites[index] = site;
    await setBlockedSites(sites);
  }
}

// Folder storage functions
export async function getBlockedSiteFolders(): Promise<BlockedSiteFolder[]> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.BLOCKED_SITE_FOLDERS);
  return result[STORAGE_KEYS.BLOCKED_SITE_FOLDERS] || [];
}

export async function setBlockedSiteFolders(folders: BlockedSiteFolder[]): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.BLOCKED_SITE_FOLDERS]: folders });
}

export async function addBlockedSiteFolder(folder: Omit<BlockedSiteFolder, 'id'>): Promise<BlockedSiteFolder> {
  const folders = await getBlockedSiteFolders();
  const newFolder: BlockedSiteFolder = {
    ...folder,
    id: crypto.randomUUID(),
  };
  folders.push(newFolder);
  await setBlockedSiteFolders(folders);
  return newFolder;
}

export async function updateBlockedSiteFolder(folder: BlockedSiteFolder): Promise<void> {
  const folders = await getBlockedSiteFolders();
  const index = folders.findIndex(f => f.id === folder.id);
  if (index !== -1) {
    folders[index] = folder;
    await setBlockedSiteFolders(folders);
  }
}

export async function removeBlockedSiteFolder(id: string): Promise<void> {
  const folders = await getBlockedSiteFolders();
  const filtered = folders.filter(f => f.id !== id);
  await setBlockedSiteFolders(filtered);

  // Also clear folderId from any sites that were in this folder
  const sites = await getBlockedSites();
  const updatedSites = sites.map(s =>
    s.folderId === id ? { ...s, folderId: undefined } : s
  );
  await setBlockedSites(updatedSites);
}

export async function getSettings(): Promise<Settings> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.SETTINGS);
  return { ...DEFAULT_SETTINGS, ...result[STORAGE_KEYS.SETTINGS] };
}

export async function updateSettings(settings: Partial<Settings>): Promise<Settings> {
  const current = await getSettings();
  const updated = { ...current, ...settings };
  await chrome.storage.local.set({ [STORAGE_KEYS.SETTINGS]: updated });
  return updated;
}

export async function getDailyStats(date?: string): Promise<DailyStats> {
  const targetDate = date || getLocalDateString();
  const result = await chrome.storage.local.get(STORAGE_KEYS.DAILY_STATS);
  const allStats = result[STORAGE_KEYS.DAILY_STATS] || {};
  const stats = allStats[targetDate];
  if (stats) {
    // Ensure sessions are in compact format
    if (!stats.sessions || Array.isArray(stats.sessions)) stats.sessions = {};
    if (!stats.youtubeSessions || Array.isArray(stats.youtubeSessions)) stats.youtubeSessions = {};
    return stats;
  }
  return {
    date: targetDate,
    totalTime: 0,
    sites: {},
    visits: 0,
    blockedAttempts: 0,
    sessions: {},
    youtubeSessions: {},
  };
}

export async function getAllDailyStats(): Promise<Record<string, DailyStats>> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.DAILY_STATS);
  return result[STORAGE_KEYS.DAILY_STATS] || {};
}

// Get all stats without session arrays (much faster for aggregate views)
export async function getAllDailyStatsSummary(): Promise<Record<string, { date: string; totalTime: number; sites: Record<string, number>; visits: number; blockedAttempts: number }>> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.DAILY_STATS);
  const allStats = result[STORAGE_KEYS.DAILY_STATS] || {};

  // Strip out sessions and youtubeSessions to reduce data size
  const summary: Record<string, { date: string; totalTime: number; sites: Record<string, number>; visits: number; blockedAttempts: number }> = {};
  for (const [date, stats] of Object.entries(allStats as Record<string, DailyStats>)) {
    summary[date] = {
      date: stats.date,
      totalTime: stats.totalTime,
      sites: stats.sites,
      visits: stats.visits,
      blockedAttempts: stats.blockedAttempts,
    };
  }
  return summary;
}

// Get sessions and YouTube sessions for a specific date range (for timeline)
// Expands compact format to UI-compatible format
export async function getSessionsForRange(startDate: string, endDate: string): Promise<{
  sessions: SiteSession[];
  youtubeSessions: YouTubeChannelSession[];
}> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.DAILY_STATS);
  const allStats = result[STORAGE_KEYS.DAILY_STATS] || {};

  const sessions: SiteSession[] = [];
  const youtubeSessions: YouTubeChannelSession[] = [];

  // Iterate through dates in range
  let currentDate = new Date(startDate + 'T00:00:00');
  const endDateObj = new Date(endDate + 'T00:00:00');

  while (currentDate <= endDateObj) {
    const dateStr = getLocalDateString(currentDate);
    const dayStats = allStats[dateStr];
    if (dayStats) {
      // Expand compact sessions to SiteSession[]
      if (dayStats.sessions && typeof dayStats.sessions === 'object' && !Array.isArray(dayStats.sessions)) {
        // Compact format: { domain: [[start, end], ...] }
        for (const [domain, times] of Object.entries(dayStats.sessions as CompactSessions)) {
          for (const [startSec, endSec] of times) {
            sessions.push({
              domain,
              startTime: startSec * 1000,
              endTime: endSec * 1000,
              windowId: 0, // windowId not preserved in compact format
            });
          }
        }
      }

      // Expand compact YouTube sessions
      if (dayStats.youtubeSessions && typeof dayStats.youtubeSessions === 'object' && !Array.isArray(dayStats.youtubeSessions)) {
        // Compact format: { channelName: { url?, times: [[start, end], ...] } }
        for (const [channelName, data] of Object.entries(dayStats.youtubeSessions as CompactYouTubeSessions)) {
          for (const [startSec, endSec] of data.times) {
            youtubeSessions.push({
              channelName,
              channelUrl: data.url,
              startTime: startSec * 1000,
              endTime: endSec * 1000,
              windowId: 0,
            });
          }
        }
      }
    }
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return { sessions, youtubeSessions };
}

export async function updateDailyStats(date: string, stats: DailyStats): Promise<void> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.DAILY_STATS);
  const allStats = result[STORAGE_KEYS.DAILY_STATS] || {};
  allStats[date] = stats;
  await chrome.storage.local.set({ [STORAGE_KEYS.DAILY_STATS]: allStats });
}

export async function incrementBlockedAttempt(_domain: string): Promise<void> {
  const today = getLocalDateString();
  const stats = await getDailyStats(today);
  stats.blockedAttempts++;
  await updateDailyStats(today, stats);
}

// Merge overlapping intervals and return total duration in seconds
// Intervals are in the same unit (either ms or seconds)
export function mergeIntervals(intervals: { start: number; end: number }[], inputInSeconds = false): { merged: { start: number; end: number }[]; totalSeconds: number } {
  if (intervals.length === 0) return { merged: [], totalSeconds: 0 };

  // Sort by start time
  const sorted = [...intervals].sort((a, b) => a.start - b.start);
  const merged: { start: number; end: number }[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i];
    const last = merged[merged.length - 1];

    if (current.start <= last.end) {
      // Overlapping - extend the end if needed
      last.end = Math.max(last.end, current.end);
    } else {
      // Non-overlapping - add new interval
      merged.push(current);
    }
  }

  const divisor = inputInSeconds ? 1 : 1000;
  const totalSeconds = merged.reduce((sum, interval) => sum + Math.round((interval.end - interval.start) / divisor), 0);
  return { merged, totalSeconds };
}

// Compute stats from compact sessions format
export function computeStatsFromCompactSessions(sessions: CompactSessions): { totalTime: number; sites: Record<string, number> } {
  // Calculate per-site time using union of that site's intervals
  const sites: Record<string, number> = {};
  const allIntervals: { start: number; end: number }[] = [];

  for (const [domain, times] of Object.entries(sessions)) {
    const intervals = times.map(([start, end]) => ({ start, end }));
    allIntervals.push(...intervals);
    const { totalSeconds } = mergeIntervals(intervals, true);
    sites[domain] = totalSeconds;
  }

  // Calculate total time using union of all intervals
  const { totalSeconds } = mergeIntervals(allIntervals, true);

  return { totalTime: totalSeconds, sites };
}

// Legacy: Compute stats from old session format (for migration)
export function computeStatsFromSessions(sessions: SiteSession[]): { totalTime: number; sites: Record<string, number> } {
  // Calculate total time using union of all intervals
  const allIntervals = sessions.map(s => ({ start: s.startTime, end: s.endTime }));
  const { totalSeconds } = mergeIntervals(allIntervals);

  // Calculate per-site time using union of that site's intervals
  const siteIntervals = new Map<string, { start: number; end: number }[]>();
  for (const session of sessions) {
    const intervals = siteIntervals.get(session.domain) || [];
    intervals.push({ start: session.startTime, end: session.endTime });
    siteIntervals.set(session.domain, intervals);
  }

  const sites: Record<string, number> = {};
  for (const [domain, intervals] of siteIntervals) {
    const { totalSeconds: siteSeconds } = mergeIntervals(intervals);
    sites[domain] = siteSeconds;
  }

  return { totalTime: totalSeconds, sites };
}

export async function recordSession(session: SiteSession): Promise<void> {
  const segments = splitIntervalByLocalDay(session.startTime, session.endTime);
  if (segments.length === 0) return;

  // Use atomic read-modify-write to prevent race conditions with recordYouTubeSession
  const result = await chrome.storage.local.get(STORAGE_KEYS.DAILY_STATS);
  const allStats = result[STORAGE_KEYS.DAILY_STATS] || {};

  const domain = session.domain;
  let visitCounted = false;

  for (const segment of segments) {
    // Get existing stats for this date, or create minimal structure
    const stats = allStats[segment.date] || {
      date: segment.date,
      totalTime: 0,
      sites: {},
      visits: 0,
      blockedAttempts: 0,
      sessions: {},
      youtubeSessions: {},
    };

    // Ensure sessions is in compact format (object, not array)
    if (!stats.sessions || Array.isArray(stats.sessions)) {
      stats.sessions = {};
    }

    if (!stats.sessions[domain]) {
      stats.sessions[domain] = [];
    }
    stats.sessions[domain].push([segment.startSec, segment.endSec]);

    // Keep visit semantics consistent with previous behavior: one visit per recorded session.
    if (!visitCounted) {
      stats.visits++;
      visitCounted = true;
    }

    // Recompute totals from compact sessions
    const computed = computeStatsFromCompactSessions(stats.sessions);
    stats.totalTime = computed.totalTime;
    stats.sites = computed.sites;

    // Preserve youtubeSessions if they exist
    if (!stats.youtubeSessions) stats.youtubeSessions = {};

    allStats[segment.date] = stats;
  }

  await chrome.storage.local.set({ [STORAGE_KEYS.DAILY_STATS]: allStats });
}

// Compute YouTube channel stats from sessions (aggregate time per channel)
export function computeYouTubeStatsFromSessions(sessions: YouTubeChannelSession[]): Record<string, number> {
  // Group intervals by channelName to ensure consistent merging
  // (channelId may be present in some sessions but not others for the same channel)
  const channelIntervals = new Map<string, { start: number; end: number }[]>();

  for (const session of sessions) {
    const key = session.channelName;
    const intervals = channelIntervals.get(key) || [];
    intervals.push({ start: session.startTime, end: session.endTime });
    channelIntervals.set(key, intervals);
  }

  // Merge overlapping intervals and calculate time per channel
  const channels: Record<string, number> = {};
  for (const [channelName, intervals] of channelIntervals) {
    const { totalSeconds } = mergeIntervals(intervals);
    channels[channelName] = totalSeconds;
  }

  return channels;
}

// Channel stats with URL information
export interface YouTubeChannelStats {
  time: number;
  url?: string;
}

// Compute YouTube channel stats with URLs from compact sessions
export function computeYouTubeStatsWithUrls(sessions: CompactYouTubeSessions): Record<string, YouTubeChannelStats> {
  const channels: Record<string, YouTubeChannelStats> = {};

  for (const [channelName, data] of Object.entries(sessions)) {
    const intervals = data.times.map(([start, end]) => ({ start, end }));
    const { totalSeconds } = mergeIntervals(intervals, true);
    channels[channelName] = {
      time: totalSeconds,
      url: data.url,
    };
  }

  return channels;
}

// Legacy: Compute YouTube stats from old format (for migration)
export function computeYouTubeStatsWithUrlsLegacy(sessions: YouTubeChannelSession[]): Record<string, YouTubeChannelStats> {
  const channelIntervals = new Map<string, { start: number; end: number }[]>();
  const channelUrls = new Map<string, string>();

  for (const session of sessions) {
    const key = session.channelName;
    const intervals = channelIntervals.get(key) || [];
    intervals.push({ start: session.startTime, end: session.endTime });
    channelIntervals.set(key, intervals);
    if (session.channelUrl) {
      channelUrls.set(key, session.channelUrl);
    }
  }

  const channels: Record<string, YouTubeChannelStats> = {};
  for (const [channelName, intervals] of channelIntervals) {
    const { totalSeconds } = mergeIntervals(intervals);
    channels[channelName] = {
      time: totalSeconds,
      url: channelUrls.get(channelName),
    };
  }

  return channels;
}

export async function recordYouTubeSession(session: YouTubeChannelSession): Promise<void> {
  const segments = splitIntervalByLocalDay(session.startTime, session.endTime);
  if (segments.length === 0) return;

  // Use atomic read-modify-write to prevent race conditions with recordSession
  const result = await chrome.storage.local.get(STORAGE_KEYS.DAILY_STATS);
  const allStats = result[STORAGE_KEYS.DAILY_STATS] || {};

  const channelName = session.channelName;
  for (const segment of segments) {
    // Get existing stats for this date, or create minimal structure
    const existingStats = allStats[segment.date] || {
      date: segment.date,
      totalTime: 0,
      sites: {},
      visits: 0,
      blockedAttempts: 0,
      sessions: {},
      youtubeSessions: {},
    };

    // Ensure youtubeSessions is in compact format (object, not array)
    if (!existingStats.youtubeSessions || Array.isArray(existingStats.youtubeSessions)) {
      existingStats.youtubeSessions = {};
    }

    if (!existingStats.youtubeSessions[channelName]) {
      existingStats.youtubeSessions[channelName] = { times: [] };
    }
    existingStats.youtubeSessions[channelName].times.push([segment.startSec, segment.endSec]);
    // Update URL if available (most recent wins)
    if (session.channelUrl) {
      existingStats.youtubeSessions[channelName].url = session.channelUrl;
    }

    allStats[segment.date] = existingStats;
  }

  await chrome.storage.local.set({ [STORAGE_KEYS.DAILY_STATS]: allStats });
}

// Active YouTube sessions management
export async function getActiveYouTubeSessions(): Promise<Record<number, ActiveYouTubeSession>> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.ACTIVE_YOUTUBE_SESSIONS);
  return result[STORAGE_KEYS.ACTIVE_YOUTUBE_SESSIONS] || {};
}

export async function setActiveYouTubeSessions(sessions: Record<number, ActiveYouTubeSession>): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.ACTIVE_YOUTUBE_SESSIONS]: sessions });
}

export async function addActiveYouTubeSession(tabId: number, session: ActiveYouTubeSession): Promise<void> {
  const sessions = await getActiveYouTubeSessions();
  sessions[tabId] = session;
  await setActiveYouTubeSessions(sessions);
}

export async function removeActiveYouTubeSession(tabId: number): Promise<ActiveYouTubeSession | undefined> {
  const sessions = await getActiveYouTubeSessions();
  const session = sessions[tabId];
  if (session) {
    delete sessions[tabId];
    await setActiveYouTubeSessions(sessions);
  }
  return session;
}

export async function clearActiveYouTubeSessions(): Promise<void> {
  await chrome.storage.local.remove(STORAGE_KEYS.ACTIVE_YOUTUBE_SESSIONS);
}

// Active sessions management (multiple windows)
export async function getActiveSessions(): Promise<Record<number, ActiveSession>> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.ACTIVE_SESSIONS);
  return result[STORAGE_KEYS.ACTIVE_SESSIONS] || {};
}

export async function setActiveSessions(sessions: Record<number, ActiveSession>): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.ACTIVE_SESSIONS]: sessions });
}

export async function addActiveSession(tabId: number, session: ActiveSession): Promise<void> {
  const sessions = await getActiveSessions();
  sessions[tabId] = session;
  await setActiveSessions(sessions);
}

export async function removeActiveSession(tabId: number): Promise<ActiveSession | undefined> {
  const sessions = await getActiveSessions();
  const session = sessions[tabId];
  if (session) {
    delete sessions[tabId];
    await setActiveSessions(sessions);
  }
  return session;
}

export async function clearActiveSessions(): Promise<void> {
  await chrome.storage.local.remove(STORAGE_KEYS.ACTIVE_SESSIONS);
}

// Password hashing using Web Crypto API
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const inputHash = await hashPassword(password);
  return inputHash === hash;
}

// URL pattern matching
export function matchesPattern(url: string, pattern: string): boolean {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;
    const pathname = urlObj.pathname;

    // Check if pattern includes a path (has / after domain part)
    const patternHasPath = pattern.includes('/');
    let patternDomain: string;
    let patternPath: string | null = null;

    if (patternHasPath) {
      const slashIndex = pattern.indexOf('/');
      patternDomain = pattern.slice(0, slashIndex);
      patternPath = pattern.slice(slashIndex);
      // Remove trailing /* for matching purposes
      if (patternPath.endsWith('/*')) {
        patternPath = patternPath.slice(0, -2);
      }
    } else {
      patternDomain = pattern;
    }

    // Handle wildcard patterns like *.example.com
    let domainMatches = false;
    if (patternDomain.startsWith('*.')) {
      const baseDomain = patternDomain.slice(2);
      domainMatches = hostname === baseDomain || hostname.endsWith('.' + baseDomain);
    } else {
      // Exact domain match
      domainMatches = hostname === patternDomain || hostname === 'www.' + patternDomain;
    }

    if (!domainMatches) {
      return false;
    }

    // If pattern has no path, domain match is sufficient
    if (!patternPath) {
      return true;
    }

    // Check path match (pathname must start with patternPath)
    return pathname === patternPath || pathname.startsWith(patternPath + '/');
  } catch {
    return false;
  }
}

// Domain category storage functions
export async function getDomainCategories(): Promise<Record<string, string>> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.DOMAIN_CATEGORIES);
  return result[STORAGE_KEYS.DOMAIN_CATEGORIES] || {};
}

export async function setDomainCategory(domain: string, category: string | null): Promise<void> {
  const categories = await getDomainCategories();
  if (category === null) {
    delete categories[domain];
  } else {
    categories[domain] = category;
  }
  await chrome.storage.local.set({ [STORAGE_KEYS.DOMAIN_CATEGORIES]: categories });
}

// Custom categories storage functions
export async function getCustomCategories(): Promise<CustomCategory[]> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.CUSTOM_CATEGORIES);
  return result[STORAGE_KEYS.CUSTOM_CATEGORIES] || [];
}

export async function setCustomCategories(categories: CustomCategory[]): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.CUSTOM_CATEGORIES]: categories });
}

export async function addCustomCategory(category: Omit<CustomCategory, 'id'>): Promise<CustomCategory> {
  const categories = await getCustomCategories();
  const newCategory: CustomCategory = {
    ...category,
    id: crypto.randomUUID(),
  };
  categories.push(newCategory);
  await setCustomCategories(categories);
  return newCategory;
}

export async function updateCustomCategory(category: CustomCategory): Promise<void> {
  const categories = await getCustomCategories();
  const index = categories.findIndex(c => c.id === category.id);
  if (index !== -1) {
    categories[index] = category;
    await setCustomCategories(categories);
  }
}

export async function deleteCustomCategory(id: string): Promise<void> {
  // Remove the category
  const categories = await getCustomCategories();
  const filtered = categories.filter(c => c.id !== id);
  await setCustomCategories(filtered);

  // Clear domain mappings that point to this category
  const domainCategories = await getDomainCategories();
  const updatedDomainCategories: Record<string, string> = {};
  for (const [domain, categoryId] of Object.entries(domainCategories)) {
    if (categoryId !== id) {
      updatedDomainCategories[domain] = categoryId;
    }
  }
  await chrome.storage.local.set({ [STORAGE_KEYS.DOMAIN_CATEGORIES]: updatedDomainCategories });
}

// Built-in category overrides storage functions
export async function getBuiltInCategoryOverrides(): Promise<Record<string, string>> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.BUILTIN_CATEGORY_OVERRIDES);
  return result[STORAGE_KEYS.BUILTIN_CATEGORY_OVERRIDES] || {};
}

export async function setBuiltInCategoryName(id: SiteCategory, name: string | null): Promise<void> {
  const overrides = await getBuiltInCategoryOverrides();
  if (name === null) {
    delete overrides[id];
  } else {
    overrides[id] = name;
  }
  await chrome.storage.local.set({ [STORAGE_KEYS.BUILTIN_CATEGORY_OVERRIDES]: overrides });
}

// Daily limit storage functions
export async function getDailyLimits(): Promise<DailyLimit[]> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.DAILY_LIMITS);
  return result[STORAGE_KEYS.DAILY_LIMITS] || [];
}

export async function setDailyLimits(limits: DailyLimit[]): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.DAILY_LIMITS]: limits });
}

export async function addDailyLimit(limit: Omit<DailyLimit, 'id'>): Promise<DailyLimit> {
  const limits = await getDailyLimits();
  const newLimit: DailyLimit = {
    ...limit,
    id: crypto.randomUUID(),
  };
  limits.push(newLimit);
  await setDailyLimits(limits);
  return newLimit;
}

export async function updateDailyLimit(limit: DailyLimit): Promise<void> {
  const limits = await getDailyLimits();
  const index = limits.findIndex(l => l.id === limit.id);
  if (index !== -1) {
    limits[index] = limit;
    await setDailyLimits(limits);
  }
}

export async function removeDailyLimit(id: string): Promise<void> {
  const limits = await getDailyLimits();
  const filtered = limits.filter(l => l.id !== id);
  await setDailyLimits(filtered);
}

// Check if a domain has exceeded its daily limit
export async function checkDailyLimitForDomain(domain: string): Promise<{
  exceeded: boolean;
  limit?: DailyLimit;
  timeSpent: number;
  remaining: number;
}> {
  const limits = await getDailyLimits();
  const today = getLocalDateString();
  const stats = await getDailyStats(today);

  // Find matching limit
  for (const limit of limits) {
    if (!limit.enabled) continue;

    // Check if bypassed
    if (limit.bypassedUntil && Date.now() < limit.bypassedUntil) {
      continue;
    }

    // Check if domain matches pattern
    const normalizedDomain = domain.replace(/^www\./, '');
    const pattern = limit.pattern.replace(/^www\./, '');

    let matches = false;
    if (pattern.startsWith('*.')) {
      const baseDomain = pattern.slice(2);
      matches = normalizedDomain === baseDomain || normalizedDomain.endsWith('.' + baseDomain);
    } else {
      matches = normalizedDomain === pattern;
    }

    if (matches) {
      // Get time spent on this domain today
      const timeSpent = stats.sites[domain] || stats.sites['www.' + domain] || stats.sites[normalizedDomain] || 0;
      const remaining = Math.max(0, limit.limitSeconds - timeSpent);

      return {
        exceeded: timeSpent >= limit.limitSeconds,
        limit,
        timeSpent,
        remaining,
      };
    }
  }

  return { exceeded: false, timeSpent: 0, remaining: Infinity };
}

// Migration: Convert old session format to compact format
const MIGRATION_KEY = 'sessionFormatMigrated';

export async function migrateSessionsToCompactFormat(): Promise<boolean> {
  // Check if already migrated
  const migrationStatus = await chrome.storage.local.get(MIGRATION_KEY);
  if (migrationStatus[MIGRATION_KEY]) {
    return false; // Already migrated
  }

  console.log('[Migration] Starting session format migration...');
  const result = await chrome.storage.local.get(STORAGE_KEYS.DAILY_STATS);
  const allStats = result[STORAGE_KEYS.DAILY_STATS] || {};

  let migratedCount = 0;

  for (const stats of Object.values(allStats)) {
    const dayStats = stats as Record<string, unknown>;
    let needsUpdate = false;

    // Migrate sessions array to compact format
    if (Array.isArray(dayStats.sessions)) {
      const oldSessions = dayStats.sessions as SiteSession[];
      const compactSessions: CompactSessions = {};

      for (const session of oldSessions) {
        const domain = session.domain;
        const startSec = Math.floor(session.startTime / 1000);
        const endSec = Math.floor(session.endTime / 1000);

        if (!compactSessions[domain]) {
          compactSessions[domain] = [];
        }
        compactSessions[domain].push([startSec, endSec]);
      }

      dayStats.sessions = compactSessions;
      needsUpdate = true;
    }

    // Migrate youtubeSessions array to compact format
    if (Array.isArray(dayStats.youtubeSessions)) {
      const oldYtSessions = dayStats.youtubeSessions as YouTubeChannelSession[];
      const compactYtSessions: CompactYouTubeSessions = {};

      for (const session of oldYtSessions) {
        const channelName = session.channelName;
        const startSec = Math.floor(session.startTime / 1000);
        const endSec = Math.floor(session.endTime / 1000);

        if (!compactYtSessions[channelName]) {
          compactYtSessions[channelName] = { times: [] };
        }
        compactYtSessions[channelName].times.push([startSec, endSec]);
        if (session.channelUrl) {
          compactYtSessions[channelName].url = session.channelUrl;
        }
      }

      dayStats.youtubeSessions = compactYtSessions;
      needsUpdate = true;
    }

    if (needsUpdate) {
      migratedCount++;
    }
  }

  // Save migrated data
  await chrome.storage.local.set({
    [STORAGE_KEYS.DAILY_STATS]: allStats,
    [MIGRATION_KEY]: true,
  });

  console.log(`[Migration] Completed. Migrated ${migratedCount} days of data.`);
  return true;
}
