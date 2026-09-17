import { validateHistoryRange } from './trackingPrivacy';
import { BlockedSite, BlockedSiteFolder, DailyStatsSummary, DailyStats, SiteSession, ActiveSession, Settings, DEFAULT_SETTINGS, SiteCategory, DailyLimit, YouTubeChannelSession, ActiveYouTubeSession, CustomCategory, CompactSessions, CompactYouTubeSessions, FocusSession } from './types';
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
  FOCUS_SESSIONS: 'focusSessions',
} as const;

const DAILY_STATS_PREFIX = 'dailyStats:';
export const SUMMARY_DATES_KEY = 'dailyStatsSummaryDates';
export const SUMMARY_PREFIX = 'dailyStatsSummary:';
const STORAGE_SCHEMA_VERSION_KEY = 'storageSchemaVersion';
const DAILY_STATS_SCHEMA_VERSION = 2;

// Service-worker events can interleave at each await. Serialize dailyStats
// read-modify-write operations so stale snapshots cannot overwrite newer data.
let dailyStatsWriteQueue: Promise<void> = Promise.resolve();
let focusSessionsWriteQueue: Promise<void> = Promise.resolve();
let activeSessionsWriteQueue: Promise<void> = Promise.resolve();
let activeYouTubeSessionsWriteQueue: Promise<void> = Promise.resolve();
let dailyStatsMigrationPromise: Promise<void> | null = null;

function queueDailyStatsWrite<T>(operation: () => Promise<T>): Promise<T> {
  const result = dailyStatsWriteQueue.then(operation, operation);
  dailyStatsWriteQueue = result.then(() => undefined, () => undefined);
  return result;
}

function queueFocusSessionsWrite<T>(operation: () => Promise<T>): Promise<T> {
  const result = focusSessionsWriteQueue.then(operation, operation);
  focusSessionsWriteQueue = result.then(() => undefined, () => undefined);
  return result;
}

function queueActiveSessionsWrite<T>(operation: () => Promise<T>): Promise<T> {
  const result = activeSessionsWriteQueue.then(operation, operation);
  activeSessionsWriteQueue = result.then(() => undefined, () => undefined);
  return result;
}

function queueActiveYouTubeSessionsWrite<T>(operation: () => Promise<T>): Promise<T> {
  const result = activeYouTubeSessionsWriteQueue.then(operation, operation);
  activeYouTubeSessionsWriteQueue = result.then(() => undefined, () => undefined);
  return result;
}

function dailyStatsKey(date: string): string {
  return `${DAILY_STATS_PREFIX}${date}`;
}

function createEmptyDailyStats(date: string): DailyStats {
  return {
    date,
    totalTime: 0,
    sites: {},
    visits: 0,
    blockedAttempts: 0,
    sessions: {},
    youtubeSessions: {},
  };
}

function normalizeDailyStats(date: string, value: DailyStats): DailyStats {
  return {
    ...createEmptyDailyStats(date),
    ...value,
    date,
    sessions: value.sessions && !Array.isArray(value.sessions) ? value.sessions : {},
    youtubeSessions: value.youtubeSessions && !Array.isArray(value.youtubeSessions)
      ? value.youtubeSessions
      : {},
  };
}

function datesInRange(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const current = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  while (current <= end) {
    dates.push(getLocalDateString(current));
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

function dailyStatsFromStorage(result: Record<string, unknown>): Record<string, DailyStats> {
  const allStats: Record<string, DailyStats> = {};
  for (const [key, value] of Object.entries(result)) {
    if (!key.startsWith(DAILY_STATS_PREFIX) || !value) continue;
    const date = key.slice(DAILY_STATS_PREFIX.length);
    allStats[date] = normalizeDailyStats(date, value as DailyStats);
  }
  return allStats;
}

async function ensureDailyStatsStorageMigrated(): Promise<void> {
  if (!dailyStatsMigrationPromise) {
    dailyStatsMigrationPromise = migrateDailyStatsStorage().finally(() => {
      dailyStatsMigrationPromise = null;
    });
  }
  await dailyStatsMigrationPromise;
}

async function migrateDailyStatsStorage(): Promise<void> {
  const result = await chrome.storage.local.get([
    STORAGE_SCHEMA_VERSION_KEY,
    STORAGE_KEYS.DAILY_STATS,
  ]);
  const schemaVersion = result[STORAGE_SCHEMA_VERSION_KEY] as number | undefined;
  if (schemaVersion !== undefined && schemaVersion >= DAILY_STATS_SCHEMA_VERSION) {
    return;
  }

  const legacyStats = (result[STORAGE_KEYS.DAILY_STATS] || {}) as Record<string, DailyStats>;
  const migrated: Record<string, unknown> = {
    [STORAGE_SCHEMA_VERSION_KEY]: DAILY_STATS_SCHEMA_VERSION,
  };
  for (const [date, stats] of Object.entries(legacyStats)) {
    migrated[dailyStatsKey(date)] = normalizeDailyStats(date, stats);
  }

  await chrome.storage.local.set(migrated);
  if (Object.keys(legacyStats).length > 0) {
    const verification = await chrome.storage.local.get(Object.keys(legacyStats).map(dailyStatsKey));
    const complete = Object.keys(legacyStats).every(date => verification[dailyStatsKey(date)] !== undefined);
    if (!complete) {
      throw new Error('Daily history migration could not be verified');
    }
  }
  await chrome.storage.local.remove(STORAGE_KEYS.DAILY_STATS);
}

export async function recordFocusSession(
  session: Omit<FocusSession, 'id'>,
  extendActive = false
): Promise<FocusSession> {
  return queueFocusSessionsWrite(async () => {
    const result = await chrome.storage.local.get(STORAGE_KEYS.FOCUS_SESSIONS);
    const sessions: FocusSession[] = result[STORAGE_KEYS.FOCUS_SESSIONS] || [];

    if (extendActive) {
      const active = [...sessions].reverse().find(candidate =>
        candidate.targetType === session.targetType &&
        candidate.targetId === session.targetId &&
        candidate.endTime === undefined &&
        candidate.plannedEndTime > session.startTime
      );
      if (active) {
        active.plannedEndTime = session.plannedEndTime;
        active.targetName = session.targetName;
        await chrome.storage.local.set({ [STORAGE_KEYS.FOCUS_SESSIONS]: sessions });
        return active;
      }
    }

    const created: FocusSession = { ...session, id: crypto.randomUUID() };
    sessions.push(created);
    await chrome.storage.local.set({ [STORAGE_KEYS.FOCUS_SESSIONS]: sessions });
    return created;
  });
}

export async function endFocusSession(
  targetType: FocusSession['targetType'],
  targetId: string | undefined,
  endTime: number = Date.now()
): Promise<void> {
  await queueFocusSessionsWrite(async () => {
    const result = await chrome.storage.local.get(STORAGE_KEYS.FOCUS_SESSIONS);
    const sessions: FocusSession[] = result[STORAGE_KEYS.FOCUS_SESSIONS] || [];
    const active = [...sessions].reverse().find(candidate =>
      candidate.targetType === targetType &&
      candidate.targetId === targetId &&
      candidate.endTime === undefined &&
      candidate.plannedEndTime > endTime
    );

    if (!active) return;
    active.endTime = Math.min(endTime, active.plannedEndTime);
    await chrome.storage.local.set({ [STORAGE_KEYS.FOCUS_SESSIONS]: sessions });
  });
}

export async function getFocusSessionsForRange(
  startDate: string,
  endDate: string
): Promise<FocusSession[]> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.FOCUS_SESSIONS);
  const sessions: FocusSession[] = result[STORAGE_KEYS.FOCUS_SESSIONS] || [];
  const rangeStart = new Date(`${startDate}T00:00:00`).getTime();
  const rangeEnd = new Date(`${endDate}T00:00:00`);
  rangeEnd.setDate(rangeEnd.getDate() + 1);

  return sessions.filter(session => {
    const effectiveEnd = session.endTime ?? Math.min(session.plannedEndTime, Date.now());
    return session.startTime < rangeEnd.getTime() && effectiveEnd > rangeStart;
  });
}

export async function pruneFocusSessions(cutoffDate: string): Promise<void> {
  await queueFocusSessionsWrite(async () => {
    const result = await chrome.storage.local.get(STORAGE_KEYS.FOCUS_SESSIONS);
    const sessions: FocusSession[] = result[STORAGE_KEYS.FOCUS_SESSIONS] || [];
    const cutoff = new Date(`${cutoffDate}T00:00:00`).getTime();
    const retained = sessions.filter(session =>
      (session.endTime ?? session.plannedEndTime) >= cutoff
    );
    await chrome.storage.local.set({ [STORAGE_KEYS.FOCUS_SESSIONS]: retained });
  });
}

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
  const stored = { ...(result[STORAGE_KEYS.SETTINGS] || {}) } as Record<string, unknown>;
  const hadRetiredNewTabSettings = 'displayName' in stored || 'quickLinks' in stored;
  delete stored.displayName;
  delete stored.quickLinks;
  const settings = { ...DEFAULT_SETTINGS, ...stored } as Settings;
  if (hadRetiredNewTabSettings) {
    await chrome.storage.local.set({ [STORAGE_KEYS.SETTINGS]: settings });
  }
  return settings;
}

export async function updateSettings(settings: Partial<Settings>): Promise<Settings> {
  const current = await getSettings();
  const updated = { ...current, ...settings };
  await chrome.storage.local.set({ [STORAGE_KEYS.SETTINGS]: updated });
  return updated;
}

export async function getDailyStats(date?: string): Promise<DailyStats> {
  await ensureDailyStatsStorageMigrated();
  const targetDate = date || getLocalDateString();
  const key = dailyStatsKey(targetDate);
  const result = await chrome.storage.local.get(key);
  return result[key]
    ? normalizeDailyStats(targetDate, result[key] as DailyStats)
    : createEmptyDailyStats(targetDate);
}

export async function getAllDailyStats(): Promise<Record<string, DailyStats>> {
  await ensureDailyStatsStorageMigrated();
  return dailyStatsFromStorage(await chrome.storage.local.get(null));
}

export async function deleteHistoryRange(startDate: string, endDate: string): Promise<number> {
  validateHistoryRange(startDate, endDate);
  return queueDailyStatsWrite(async () => {
    await ensureDailyStatsStorageMigrated();
    const allItems = await chrome.storage.local.get(null);
    const keys = Object.keys(allItems).filter(key => key.startsWith(DAILY_STATS_PREFIX) &&
      key.slice(DAILY_STATS_PREFIX.length) >= startDate && key.slice(DAILY_STATS_PREFIX.length) <= endDate);
    await chrome.storage.local.remove([...keys, SUMMARY_DATES_KEY,
      ...keys.map(key => SUMMARY_PREFIX + key.slice(DAILY_STATS_PREFIX.length))]);
    return keys.length;
  });
}

export async function pruneDailyStats(cutoffDate: string): Promise<void> {
  await queueDailyStatsWrite(async () => {
    await ensureDailyStatsStorageMigrated();
    const allItems = await chrome.storage.local.get(null);
    const expiredKeys = Object.keys(allItems).filter(key =>
      key.startsWith(DAILY_STATS_PREFIX) && key.slice(DAILY_STATS_PREFIX.length) < cutoffDate
    );
    if (expiredKeys.length > 0) {
      await chrome.storage.local.remove([...expiredKeys, SUMMARY_DATES_KEY,
        ...expiredKeys.map(key => SUMMARY_PREFIX + key.slice(DAILY_STATS_PREFIX.length))]);
    }
  });
}

function summarizeDay(stats: DailyStats): DailyStatsSummary {
  return { date: stats.date, totalTime: stats.totalTime, sites: stats.sites,
    visits: stats.visits, blockedAttempts: stats.blockedAttempts };
}

// Disposable derived data: first read builds the index; subsequent reads never
// load detailed intervals. This does not change the authoritative history format.
export async function getAllDailyStatsSummary(): Promise<Record<string, DailyStatsSummary>> {
  return queueDailyStatsWrite(async () => {
    const cached = await chrome.storage.local.get(SUMMARY_DATES_KEY);
    const dates = cached[SUMMARY_DATES_KEY] as string[] | undefined;
    if (dates) {
      const entries = await chrome.storage.local.get(dates.map(date => SUMMARY_PREFIX + date));
      return Object.fromEntries(dates.map(date => [date, entries[SUMMARY_PREFIX + date]]));
    }
    const history = await getAllDailyStats();
    const summaries = Object.fromEntries(Object.entries(history).map(([date, stats]) => [date, summarizeDay(stats)]));
    await chrome.storage.local.set({
      [SUMMARY_DATES_KEY]: Object.keys(summaries),
      ...Object.fromEntries(Object.entries(summaries).map(([date, summary]) => [SUMMARY_PREFIX + date, summary])),
    });
    return summaries;
  });
}

// Called only inside the history write queue. Keep cached summaries in the same
// storage.set as their source day so readers cannot see mismatched versions.
async function writeDailyStats(updates: Record<string, DailyStats>): Promise<void> {
  const cached = await chrome.storage.local.get(SUMMARY_DATES_KEY);
  const dates = cached[SUMMARY_DATES_KEY] as string[] | undefined;
  const payload: Record<string, unknown> = { ...updates };
  if (dates) {
    const knownDates = new Set(dates);
    for (const stats of Object.values(updates)) {
      payload[SUMMARY_PREFIX + stats.date] = summarizeDay(stats);
      knownDates.add(stats.date);
    }
    if (knownDates.size !== dates.length) payload[SUMMARY_DATES_KEY] = [...knownDates];
  }
  await chrome.storage.local.set(payload);
}

// Get sessions and YouTube sessions for a specific date range (for timeline)
// Expands compact format to UI-compatible format
export async function getSessionsForRange(startDate: string, endDate: string): Promise<{
  sessions: SiteSession[];
  youtubeSessions: YouTubeChannelSession[];
  focusSessions: FocusSession[];
}> {
  await ensureDailyStatsStorageMigrated();
  const rangeDates = datesInRange(startDate, endDate);
  const result = await chrome.storage.local.get(rangeDates.map(dailyStatsKey));

  const sessions: SiteSession[] = [];
  const youtubeSessions: YouTubeChannelSession[] = [];

  // Iterate through dates in range
  for (const dateStr of rangeDates) {
    const stored = result[dailyStatsKey(dateStr)] as DailyStats | undefined;
    const dayStats = stored ? normalizeDailyStats(dateStr, stored) : undefined;
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
  }

  const focusSessions = await getFocusSessionsForRange(startDate, endDate);
  return { sessions, youtubeSessions, focusSessions };
}

export async function updateDailyStats(date: string, stats: DailyStats): Promise<void> {
  await queueDailyStatsWrite(async () => {
    await ensureDailyStatsStorageMigrated();
    await writeDailyStats({ [dailyStatsKey(date)]: normalizeDailyStats(date, stats) });
  });
}

export async function incrementBlockedAttempt(_domain: string): Promise<void> {
  await queueDailyStatsWrite(async () => {
    await ensureDailyStatsStorageMigrated();
    const today = getLocalDateString();
    const key = dailyStatsKey(today);
    const result = await chrome.storage.local.get(key);
    const stats = result[key]
      ? normalizeDailyStats(today, result[key] as DailyStats)
      : createEmptyDailyStats(today);

    stats.blockedAttempts++;
    await writeDailyStats({ [key]: stats });
  });
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

function compactSessionTuples(times: [number, number][]): [number, number][] {
  const intervals = times
    .filter(([start, end]) => end > start)
    .map(([start, end]) => ({ start, end }));
  const { merged } = mergeIntervals(intervals, true);
  return merged.map(({ start, end }) => [start, end]);
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

export async function recordSession(session: SiteSession, options: { countVisit?: boolean } = {}): Promise<void> {
  const segments = splitIntervalByLocalDay(session.startTime, session.endTime);
  if (segments.length === 0) return;

  await queueDailyStatsWrite(async () => {
    await ensureDailyStatsStorageMigrated();
    const keys = [...new Set(segments.map(segment => dailyStatsKey(segment.date)))];
    const result = await chrome.storage.local.get(keys);
    const updates: Record<string, DailyStats> = {};

    const domain = session.domain;
    const countVisit = options.countVisit ?? true;
    let visitCounted = false;

    for (const segment of segments) {
      const key = dailyStatsKey(segment.date);
      const stats = updates[key] || (result[key]
        ? normalizeDailyStats(segment.date, result[key] as DailyStats)
        : createEmptyDailyStats(segment.date));

      if (!stats.sessions || Array.isArray(stats.sessions)) {
        stats.sessions = {};
      }
      if (!stats.sessions[domain]) {
        stats.sessions[domain] = [];
      }
      stats.sessions[domain].push([segment.startSec, segment.endSec]);
      stats.sessions[domain] = compactSessionTuples(stats.sessions[domain]);

      if (countVisit && !visitCounted) {
        stats.visits++;
        visitCounted = true;
      }

      const computed = computeStatsFromCompactSessions(stats.sessions);
      stats.totalTime = computed.totalTime;
      stats.sites = computed.sites;
      if (!stats.youtubeSessions) stats.youtubeSessions = {};

      updates[key] = stats;
    }

    await writeDailyStats(updates);
  });
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

  await queueDailyStatsWrite(async () => {
    await ensureDailyStatsStorageMigrated();
    const keys = [...new Set(segments.map(segment => dailyStatsKey(segment.date)))];
    const result = await chrome.storage.local.get(keys);
    const updates: Record<string, DailyStats> = {};

    const channelName = session.channelName;
    for (const segment of segments) {
      const key = dailyStatsKey(segment.date);
      const existingStats = updates[key] || (result[key]
        ? normalizeDailyStats(segment.date, result[key] as DailyStats)
        : createEmptyDailyStats(segment.date));

      if (!existingStats.youtubeSessions || Array.isArray(existingStats.youtubeSessions)) {
        existingStats.youtubeSessions = {};
      }

      if (!existingStats.youtubeSessions[channelName]) {
        existingStats.youtubeSessions[channelName] = { times: [] };
      }
      existingStats.youtubeSessions[channelName].times.push([segment.startSec, segment.endSec]);
      if (session.channelUrl) {
        existingStats.youtubeSessions[channelName].url = session.channelUrl;
      }

      updates[key] = existingStats;
    }

    await writeDailyStats(updates);
  });
}

// Active YouTube sessions management
export async function getActiveYouTubeSessions(): Promise<Record<number, ActiveYouTubeSession>> {
  const sessionResult = await chrome.storage.session.get(STORAGE_KEYS.ACTIVE_YOUTUBE_SESSIONS);
  const sessionValue = sessionResult[STORAGE_KEYS.ACTIVE_YOUTUBE_SESSIONS];
  if (sessionValue && Object.keys(sessionValue).length > 0) {
    return sessionValue;
  }

  // Migrate transient state left by builds that stored it durably.
  const localResult = await chrome.storage.local.get(STORAGE_KEYS.ACTIVE_YOUTUBE_SESSIONS);
  const localValue = localResult[STORAGE_KEYS.ACTIVE_YOUTUBE_SESSIONS] || {};
  if (Object.keys(localValue).length > 0) {
    await chrome.storage.session.set({ [STORAGE_KEYS.ACTIVE_YOUTUBE_SESSIONS]: localValue });
    await chrome.storage.local.remove(STORAGE_KEYS.ACTIVE_YOUTUBE_SESSIONS);
  }
  return localValue;
}

export async function setActiveYouTubeSessions(sessions: Record<number, ActiveYouTubeSession>): Promise<void> {
  await queueActiveYouTubeSessionsWrite(() =>
    chrome.storage.session.set({ [STORAGE_KEYS.ACTIVE_YOUTUBE_SESSIONS]: sessions })
  );
}

export async function addActiveYouTubeSession(tabId: number, session: ActiveYouTubeSession): Promise<void> {
  await queueActiveYouTubeSessionsWrite(async () => {
    const sessions = await getActiveYouTubeSessions();
    sessions[tabId] = session;
    await chrome.storage.session.set({ [STORAGE_KEYS.ACTIVE_YOUTUBE_SESSIONS]: sessions });
  });
}

export async function removeActiveYouTubeSession(tabId: number): Promise<ActiveYouTubeSession | undefined> {
  return queueActiveYouTubeSessionsWrite(async () => {
    const sessions = await getActiveYouTubeSessions();
    const session = sessions[tabId];
    if (session) {
      delete sessions[tabId];
      await chrome.storage.session.set({ [STORAGE_KEYS.ACTIVE_YOUTUBE_SESSIONS]: sessions });
    }
    return session;
  });
}

export async function clearActiveYouTubeSessions(): Promise<void> {
  await queueActiveYouTubeSessionsWrite(async () => {
    await chrome.storage.session.remove(STORAGE_KEYS.ACTIVE_YOUTUBE_SESSIONS);
    await chrome.storage.local.remove(STORAGE_KEYS.ACTIVE_YOUTUBE_SESSIONS);
  });
}

// Active sessions management (multiple windows)
export async function getActiveSessions(): Promise<Record<number, ActiveSession>> {
  const sessionResult = await chrome.storage.session.get(STORAGE_KEYS.ACTIVE_SESSIONS);
  const sessionValue = sessionResult[STORAGE_KEYS.ACTIVE_SESSIONS];
  if (sessionValue && Object.keys(sessionValue).length > 0) {
    return sessionValue;
  }

  // One-time migration from older builds that kept transient sessions in durable storage.
  const localResult = await chrome.storage.local.get(STORAGE_KEYS.ACTIVE_SESSIONS);
  const localValue = localResult[STORAGE_KEYS.ACTIVE_SESSIONS] || {};
  if (Object.keys(localValue).length > 0) {
    await chrome.storage.session.set({ [STORAGE_KEYS.ACTIVE_SESSIONS]: localValue });
    await chrome.storage.local.remove(STORAGE_KEYS.ACTIVE_SESSIONS);
  }
  return localValue;
}

export async function setActiveSessions(sessions: Record<number, ActiveSession>): Promise<void> {
  await queueActiveSessionsWrite(() =>
    chrome.storage.session.set({ [STORAGE_KEYS.ACTIVE_SESSIONS]: sessions })
  );
}

export async function addActiveSession(tabId: number, session: ActiveSession): Promise<void> {
  await queueActiveSessionsWrite(async () => {
    const sessions = await getActiveSessions();
    sessions[tabId] = session;
    await chrome.storage.session.set({ [STORAGE_KEYS.ACTIVE_SESSIONS]: sessions });
  });
}

export async function removeActiveSession(tabId: number): Promise<ActiveSession | undefined> {
  return queueActiveSessionsWrite(async () => {
    const sessions = await getActiveSessions();
    const session = sessions[tabId];
    if (session) {
      delete sessions[tabId];
      await chrome.storage.session.set({ [STORAGE_KEYS.ACTIVE_SESSIONS]: sessions });
    }
    return session;
  });
}

export async function clearActiveSessions(): Promise<void> {
  await queueActiveSessionsWrite(async () => {
    await chrome.storage.session.remove(STORAGE_KEYS.ACTIVE_SESSIONS);
    await chrome.storage.local.remove(STORAGE_KEYS.ACTIVE_SESSIONS);
  });
}

const PASSWORD_HASH_PREFIX = 'pbkdf2-sha256';
const PASSWORD_HASH_ITERATIONS = 210_000;

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, character => character.charCodeAt(0));
}

function bytesEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index++) {
    difference |= left[index] ^ right[index];
  }
  return difference === 0;
}

async function derivePasswordHash(
  password: string,
  salt: Uint8Array,
  iterations: number
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits({
    name: 'PBKDF2',
    hash: 'SHA-256',
    salt: Uint8Array.from(salt).buffer,
    iterations,
  }, key, 256);
  return new Uint8Array(bits);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derivePasswordHash(password, salt, PASSWORD_HASH_ITERATIONS);
  return `${PASSWORD_HASH_PREFIX}$${PASSWORD_HASH_ITERATIONS}$${bytesToBase64(salt)}$${bytesToBase64(hash)}`;
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  if (!hash.startsWith(`${PASSWORD_HASH_PREFIX}$`)) {
    const data = new TextEncoder().encode(password);
    const legacyHash = new Uint8Array(await crypto.subtle.digest('SHA-256', data));
    const expected = Uint8Array.from(hash.match(/.{1,2}/g) || [], byte => Number.parseInt(byte, 16));
    return /^[a-f0-9]{64}$/i.test(hash) && bytesEqual(legacyHash, expected);
  }

  const [, iterationsValue, saltValue, expectedValue] = hash.split('$');
  const iterations = Number.parseInt(iterationsValue, 10);
  if (!Number.isFinite(iterations) || iterations <= 0 || !saltValue || !expectedValue) return false;

  try {
    const actual = await derivePasswordHash(password, base64ToBytes(saltValue), iterations);
    return bytesEqual(actual, base64ToBytes(expectedValue));
  } catch {
    return false;
  }
}

export function passwordHashNeedsUpgrade(hash: string): boolean {
  return !hash.startsWith(`${PASSWORD_HASH_PREFIX}$`);
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

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Build the same exact-domain/path semantics as matchesPattern for DNR rules.
export function buildUrlPatternRegex(pattern: string): string | null {
  const slashIndex = pattern.indexOf('/');
  const domainPattern = (slashIndex === -1 ? pattern : pattern.slice(0, slashIndex)).toLowerCase();
  const wildcard = domainPattern.startsWith('*.');
  const rawDomain = wildcard ? domainPattern.slice(2) : domainPattern;

  if (!rawDomain || /[^a-z0-9.-]/.test(rawDomain) || rawDomain.startsWith('.') || rawDomain.endsWith('.')) {
    return null;
  }

  const domain = escapeRegex(rawDomain);
  const host = wildcard ? `([^./]+\\.)*${domain}` : `(www\\.)?${domain}`;
  const origin = `^https?://${host}(:\\d+)?`;

  if (slashIndex === -1) {
    return `${origin}/`;
  }

  let path = pattern.slice(slashIndex);
  if (path.endsWith('/*')) {
    path = path.slice(0, -2);
  }
  path = path.replace(/\/+$/, '') || '/';

  if (path === '/') {
    return `${origin}/`;
  }

  return `${origin}${escapeRegex(path)}(/|[?#]|$)`;
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
export async function checkDailyLimitForDomain(domain: string, additionalSeconds = 0): Promise<{
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
      const recordedTime = stats.sites[domain] || stats.sites['www.' + domain] || stats.sites[normalizedDomain] || 0;
      const timeSpent = recordedTime + Math.max(0, additionalSeconds);
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
  return queueDailyStatsWrite(async () => {
    await ensureDailyStatsStorageMigrated();
    return migrateSessions();
  });
}

async function migrateSessions(): Promise<boolean> {
  // Check if already migrated
  const migrationStatus = await chrome.storage.local.get(MIGRATION_KEY);
  if (migrationStatus[MIGRATION_KEY]) {
    return false; // Already migrated
  }

  console.log('[Migration] Starting session format migration...');
  const result = await chrome.storage.local.get(null);
  const allStats = dailyStatsFromStorage(result);

  let migratedCount = 0;

  for (const stats of Object.values(allStats)) {
    const dayStats = stats as unknown as Record<string, unknown>;
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

  const updates: Record<string, unknown> = { [MIGRATION_KEY]: true };
  for (const [date, stats] of Object.entries(allStats)) {
    updates[dailyStatsKey(date)] = stats;
  }
  await chrome.storage.local.set(updates);

  console.log(`[Migration] Completed. Migrated ${migratedCount} days of data.`);
  return true;
}
