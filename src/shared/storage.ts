import { BlockedSite, BlockedSiteFolder, DailyStats, SiteSession, ActiveSession, Settings, DEFAULT_SETTINGS, SiteCategory, DailyLimit, YouTubeChannelSession, ActiveYouTubeSession } from './types';

const STORAGE_KEYS = {
  BLOCKED_SITES: 'blockedSites',
  BLOCKED_SITE_FOLDERS: 'blockedSiteFolders',
  SETTINGS: 'settings',
  DAILY_STATS: 'dailyStats',
  ACTIVE_SESSIONS: 'activeSessions',
  ACTIVE_YOUTUBE_SESSIONS: 'activeYouTubeSessions',
  DOMAIN_CATEGORIES: 'domainCategories',
  DAILY_LIMITS: 'dailyLimits',
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

function getLocalDateString(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export async function getDailyStats(date?: string): Promise<DailyStats> {
  const targetDate = date || getLocalDateString();
  const result = await chrome.storage.local.get(STORAGE_KEYS.DAILY_STATS);
  const allStats = result[STORAGE_KEYS.DAILY_STATS] || {};
  return allStats[targetDate] || {
    date: targetDate,
    totalTime: 0,
    sites: {},
    visits: 0,
    blockedAttempts: 0,
    sessions: [],
  };
}

export async function getAllDailyStats(): Promise<Record<string, DailyStats>> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.DAILY_STATS);
  return result[STORAGE_KEYS.DAILY_STATS] || {};
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
export function mergeIntervals(intervals: { start: number; end: number }[]): { merged: { start: number; end: number }[]; totalSeconds: number } {
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

  const totalSeconds = merged.reduce((sum, interval) => sum + Math.round((interval.end - interval.start) / 1000), 0);
  return { merged, totalSeconds };
}

// Compute stats from sessions (totalTime and sites using interval union)
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
  const sessionDate = new Date(session.startTime);
  const dateStr = getLocalDateString(sessionDate);
  const stats = await getDailyStats(dateStr);

  // Add session
  if (!stats.sessions) stats.sessions = [];
  stats.sessions.push(session);
  stats.visits++;

  // Recompute totals from sessions
  const computed = computeStatsFromSessions(stats.sessions);
  stats.totalTime = computed.totalTime;
  stats.sites = computed.sites;

  await updateDailyStats(dateStr, stats);
}

// Compute YouTube channel stats from sessions (aggregate time per channel)
export function computeYouTubeStatsFromSessions(sessions: YouTubeChannelSession[]): Record<string, number> {
  // Group intervals by channel (using channelId if available, else channelName)
  const channelIntervals = new Map<string, { start: number; end: number }[]>();

  for (const session of sessions) {
    const key = session.channelId || session.channelName;
    const intervals = channelIntervals.get(key) || [];
    intervals.push({ start: session.startTime, end: session.endTime });
    channelIntervals.set(key, intervals);
  }

  // Merge overlapping intervals and calculate time per channel
  const channels: Record<string, number> = {};
  for (const [key, intervals] of channelIntervals) {
    const { totalSeconds } = mergeIntervals(intervals);
    // Use the channel name from the first session with this key
    const channelSession = sessions.find(s => (s.channelId || s.channelName) === key);
    if (channelSession) {
      channels[channelSession.channelName] = totalSeconds;
    }
  }

  return channels;
}

export async function recordYouTubeSession(session: YouTubeChannelSession): Promise<void> {
  const sessionDate = new Date(session.startTime);
  const dateStr = getLocalDateString(sessionDate);
  const stats = await getDailyStats(dateStr);

  // Add YouTube session
  if (!stats.youtubeSessions) stats.youtubeSessions = [];
  stats.youtubeSessions.push(session);

  await updateDailyStats(dateStr, stats);
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
export async function getDomainCategories(): Promise<Record<string, SiteCategory>> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.DOMAIN_CATEGORIES);
  return result[STORAGE_KEYS.DOMAIN_CATEGORIES] || {};
}

export async function setDomainCategory(domain: string, category: SiteCategory | null): Promise<void> {
  const categories = await getDomainCategories();
  if (category === null) {
    delete categories[domain];
  } else {
    categories[domain] = category;
  }
  await chrome.storage.local.set({ [STORAGE_KEYS.DOMAIN_CATEGORIES]: categories });
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
