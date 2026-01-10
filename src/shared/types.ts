// Site Categories
export type SiteCategory =
  | 'social'
  | 'entertainment'
  | 'news'
  | 'shopping'
  | 'productivity'
  | 'development'
  | 'education'
  | 'communication'
  | 'other';

export interface CategoryInfo {
  id: SiteCategory | string;  // Built-in ID or custom category ID
  name: string;
  color: string;  // Tailwind color class
}

// Custom user-created categories
export interface CustomCategory {
  id: string;           // UUID
  name: string;
  color: string;        // Tailwind class e.g. 'bg-rose-500'
  order: number;        // For ordering in the list
}

// Daily Time Limits
export interface DailyLimit {
  id: string;
  pattern: string;           // Domain pattern (like BlockedSite)
  limitSeconds: number;      // Daily limit in seconds
  enabled: boolean;
  bypassType: 'password' | 'cooldown' | 'none';
  passwordHash?: string;     // For password bypass
  cooldownSeconds?: number;  // For cooldown bypass (default 30s)
  bypassedUntil?: number;    // Timestamp when bypass expires
}

export interface BlockedSite {
  id: string;
  pattern: string; // e.g., "twitter.com", "*.reddit.com", "news.ycombinator.com"
  enabled: boolean;
  unlockType: 'password' | 'timer' | 'schedule' | 'none';
  // Password unlock settings
  passwordHash?: string;
  // Timer block settings (temporary block)
  timerDuration?: number; // minutes to block for
  timerBlockedUntil?: number; // timestamp when block expires (site blocked while Date.now() < timerBlockedUntil)
  // Schedule settings
  schedule?: {
    days: number[]; // 0-6, Sunday = 0
    startTime: string; // "HH:MM"
    endTime: string; // "HH:MM"
  };
  createdAt: number;
  // Folder organization
  folderId?: string; // null/undefined = "Uncategorized"
  order?: number; // For ordering within folder
}

export interface BlockedSiteFolder {
  id: string;
  name: string;
  color?: string; // Optional color for visual distinction
  collapsed?: boolean; // UI state - whether folder is expanded
  order: number; // For ordering folders
  focusUntil?: number; // Timestamp when focus session expires (if active)
  focusDuration?: number; // Default focus duration in minutes
}

export interface SiteVisit {
  url: string;
  domain: string;
  title: string;
  timestamp: number;
  duration: number; // seconds spent on page
}

// Legacy session format (for migration)
export interface SiteSession {
  domain: string;
  startTime: number; // timestamp (ms)
  endTime: number;   // timestamp (ms)
  windowId: number;
}

// Legacy YouTube session format (for migration)
export interface YouTubeChannelSession {
  channelName: string;
  channelId?: string; // for deduplication (handle or ID)
  channelUrl?: string; // URL to the channel page
  startTime: number;  // timestamp (ms)
  endTime: number;    // timestamp (ms)
  windowId: number;
}

// Compact session format: domain -> array of [startTimeSec, endTimeSec] tuples
export type CompactSessions = Record<string, [number, number][]>;

// Compact YouTube session format: channelName -> { url?, times: [[start, end], ...] }
export type CompactYouTubeSessions = Record<string, { url?: string; times: [number, number][] }>;

export interface DailyStats {
  date: string; // YYYY-MM-DD
  totalTime: number; // seconds (computed from sessions union)
  sites: Record<string, number>; // domain -> seconds (computed from sessions)
  visits: number;
  blockedAttempts: number;
  // Compact format: domain -> [[startSec, endSec], ...]
  sessions: CompactSessions;
  // Compact format: channelName -> { url?, times: [[startSec, endSec], ...] }
  youtubeSessions?: CompactYouTubeSessions;
}

export interface Settings {
  trackingEnabled: boolean;
  blockingEnabled: boolean;
  youtubeTrackingEnabled: boolean; // track YouTube channel watch time
  passwordHash?: string; // master password for unlocking
  lockdownEnabled?: boolean; // require master password to disable blocking
  theme: 'light' | 'dark' | 'system';
  retentionDays: number; // how long to keep history
  idleThreshold: number; // seconds before considered idle (0 = disabled)
  displayName: string; // user's name for greeting
  quickLinks: QuickLink[]; // bookmarks for new tab
}

export interface QuickLink {
  id: string;
  name: string;
  url: string;
  icon?: string; // emoji or URL
}

export interface ActiveSession {
  domain: string;
  startTime: number;
  tabId: number;
  windowId: number;
}

export interface ActiveYouTubeSession {
  channelName: string;
  channelId?: string;
  channelUrl?: string;
  startTime: number;
  tabId: number;
  windowId: number;
}

export interface StorageData {
  blockedSites: BlockedSite[];
  blockedSiteFolders: BlockedSiteFolder[];
  settings: Settings;
  dailyStats: Record<string, DailyStats>; // date -> stats
  activeSessions: Record<number, ActiveSession>; // tabId -> session (multiple windows)
  domainCategories: Record<string, string>; // User category overrides (domain -> category ID)
  dailyLimits: DailyLimit[];
  customCategories: CustomCategory[]; // User-created categories
  builtInCategoryOverrides: Record<SiteCategory, string>; // Built-in category ID -> custom name
}

export const DEFAULT_SETTINGS: Settings = {
  trackingEnabled: true,
  blockingEnabled: true,
  youtubeTrackingEnabled: false, // off by default
  theme: 'system',
  retentionDays: 30,
  idleThreshold: 60, // 60 seconds default
  displayName: '',
  quickLinks: [],
};

// Lightweight stats without session arrays (for faster loading)
export interface DailyStatsSummary {
  date: string;
  totalTime: number;
  sites: Record<string, number>;
  visits: number;
  blockedAttempts: number;
}

export type MessageType =
  | { type: 'GET_STATS'; payload?: { date?: string } }
  | { type: 'GET_STATS_SUMMARY' } // Returns all stats without sessions (faster)
  | { type: 'GET_SESSIONS_FOR_RANGE'; payload: { startDate: string; endDate: string } } // Get sessions for timeline
  | { type: 'ADD_BLOCKED_SITE'; payload: Omit<BlockedSite, 'id' | 'createdAt'> }
  | { type: 'REMOVE_BLOCKED_SITE'; payload: { id: string } }
  | { type: 'UPDATE_BLOCKED_SITE'; payload: BlockedSite }
  | { type: 'UPDATE_BLOCKED_SITES'; payload: BlockedSite[] }
  | { type: 'UNLOCK_SITE'; payload: { id: string; password?: string } }
  | { type: 'START_TIMER_BLOCK'; payload: { id: string; durationMinutes?: number } }
  | { type: 'CLEAR_TIMER_BLOCK'; payload: { id: string } }
  | { type: 'GET_TIMER_STATUS'; payload: { id: string } }
  | { type: 'GET_BLOCKED_SITES' }
  | { type: 'GET_SETTINGS' }
  | { type: 'UPDATE_SETTINGS'; payload: Partial<Settings> }
  | { type: 'CHECK_SITE'; payload: { url: string } }
  | { type: 'CHECK_SITE_WITH_REDIRECT'; payload: { url: string } }
  | { type: 'INCREMENT_BLOCKED_ATTEMPT'; payload: { domain: string } }
  // Folder operations
  | { type: 'GET_BLOCKED_SITE_FOLDERS' }
  | { type: 'ADD_BLOCKED_SITE_FOLDER'; payload: Omit<BlockedSiteFolder, 'id'> }
  | { type: 'UPDATE_BLOCKED_SITE_FOLDER'; payload: BlockedSiteFolder }
  | { type: 'UPDATE_BLOCKED_SITE_FOLDERS'; payload: BlockedSiteFolder[] }
  | { type: 'REMOVE_BLOCKED_SITE_FOLDER'; payload: { id: string } }
  | { type: 'START_FOCUS_SESSION'; payload: { folderId: string; durationMinutes: number } }
  | { type: 'STOP_FOCUS_SESSION'; payload: { folderId: string } }
  | { type: 'GET_FOCUS_STATUS'; payload: { folderId: string } }
  // Content script messages
  | { type: 'HEARTBEAT'; payload: { url: string; timestamp: number } }
  | { type: 'VISIBILITY_CHANGE'; payload: { visible: boolean; url: string; timestamp: number } }
  | { type: 'CONTENT_SCRIPT_READY'; payload: { visible: boolean; url: string; timestamp: number } }
  // Category operations
  | { type: 'GET_DOMAIN_CATEGORIES' }
  | { type: 'SET_DOMAIN_CATEGORY'; payload: { domain: string; category: string | null } }
  // Custom category operations
  | { type: 'GET_CUSTOM_CATEGORIES' }
  | { type: 'ADD_CUSTOM_CATEGORY'; payload: Omit<CustomCategory, 'id'> }
  | { type: 'UPDATE_CUSTOM_CATEGORY'; payload: CustomCategory }
  | { type: 'UPDATE_CUSTOM_CATEGORIES'; payload: CustomCategory[] }
  | { type: 'DELETE_CUSTOM_CATEGORY'; payload: { id: string } }
  // Built-in category overrides
  | { type: 'GET_BUILTIN_CATEGORY_OVERRIDES' }
  | { type: 'SET_BUILTIN_CATEGORY_NAME'; payload: { id: SiteCategory; name: string | null } }
  // Daily limit operations
  | { type: 'GET_DAILY_LIMITS' }
  | { type: 'ADD_DAILY_LIMIT'; payload: Omit<DailyLimit, 'id'> }
  | { type: 'UPDATE_DAILY_LIMIT'; payload: DailyLimit }
  | { type: 'REMOVE_DAILY_LIMIT'; payload: { id: string } }
  | { type: 'BYPASS_DAILY_LIMIT'; payload: { id: string; password?: string } }
  | { type: 'CHECK_DAILY_LIMIT'; payload: { url: string } }
  // YouTube tracking messages
  | { type: 'YOUTUBE_CHANNEL_UPDATE'; payload: { channelName: string; channelId?: string; channelUrl?: string; url: string; timestamp: number } }
  | { type: 'YOUTUBE_VISIBILITY_CHANGE'; payload: { visible: boolean; channelName?: string; channelId?: string; channelUrl?: string; url: string; timestamp: number } }
  | { type: 'GET_ACTIVE_YOUTUBE_SESSIONS' }
  // Lockdown mode messages
  | { type: 'LOCKDOWN_GET_STATUS' }
  | { type: 'LOCKDOWN_AUTHENTICATE'; payload: { password: string } }
  | { type: 'LOCKDOWN_CLEAR_SESSION' };

// Lockdown status response
export interface LockdownStatus {
  lockdownEnabled: boolean;
  hasPassword: boolean;
  sessionValid: boolean;
  sessionExpiresAt?: number;
}
