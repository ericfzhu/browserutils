import { BlockedSite, BlockedSiteFolder, DailyStats, Settings, StorageData, DEFAULT_SETTINGS } from './types';

const STORAGE_KEYS = {
  BLOCKED_SITES: 'blockedSites',
  BLOCKED_SITE_FOLDERS: 'blockedSiteFolders',
  SETTINGS: 'settings',
  DAILY_STATS: 'dailyStats',
  ACTIVE_SESSION: 'activeSession',
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

export async function recordVisit(domain: string, duration: number): Promise<void> {
  const today = getLocalDateString();
  const stats = await getDailyStats(today);
  stats.totalTime += duration;
  stats.sites[domain] = (stats.sites[domain] || 0) + duration;
  stats.visits++;
  await updateDailyStats(today, stats);
}

export async function getActiveSession(): Promise<StorageData['activeSession'] | undefined> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.ACTIVE_SESSION);
  return result[STORAGE_KEYS.ACTIVE_SESSION];
}

export async function setActiveSession(session: StorageData['activeSession'] | undefined): Promise<void> {
  if (session) {
    await chrome.storage.local.set({ [STORAGE_KEYS.ACTIVE_SESSION]: session });
  } else {
    await chrome.storage.local.remove(STORAGE_KEYS.ACTIVE_SESSION);
  }
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

    // Handle wildcard patterns like *.example.com
    if (pattern.startsWith('*.')) {
      const baseDomain = pattern.slice(2);
      return hostname === baseDomain || hostname.endsWith('.' + baseDomain);
    }

    // Exact domain match
    return hostname === pattern || hostname === 'www.' + pattern;
  } catch {
    return false;
  }
}
