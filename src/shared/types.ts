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
  id: SiteCategory;
  name: string;
  color: string;  // Tailwind color class
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
  // Timer unlock settings
  timerDuration?: number; // minutes
  timerUnlockedUntil?: number; // timestamp
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
}

export interface SiteVisit {
  url: string;
  domain: string;
  title: string;
  timestamp: number;
  duration: number; // seconds spent on page
}

export interface SiteSession {
  domain: string;
  startTime: number; // timestamp (ms)
  endTime: number;   // timestamp (ms)
  windowId: number;
}

export interface DailyStats {
  date: string; // YYYY-MM-DD
  totalTime: number; // seconds (computed from sessions union)
  sites: Record<string, number>; // domain -> seconds (computed from sessions)
  visits: number;
  blockedAttempts: number;
  sessions: SiteSession[]; // detailed session records
}

export interface Settings {
  trackingEnabled: boolean;
  blockingEnabled: boolean;
  passwordHash?: string; // master password for unlocking
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

export interface StorageData {
  blockedSites: BlockedSite[];
  blockedSiteFolders: BlockedSiteFolder[];
  settings: Settings;
  dailyStats: Record<string, DailyStats>; // date -> stats
  activeSessions: Record<number, ActiveSession>; // tabId -> session (multiple windows)
  domainCategories: Record<string, SiteCategory>; // User category overrides
  dailyLimits: DailyLimit[];
}

export const DEFAULT_SETTINGS: Settings = {
  trackingEnabled: true,
  blockingEnabled: true,
  theme: 'system',
  retentionDays: 30,
  idleThreshold: 60, // 60 seconds default
  displayName: '',
  quickLinks: [],
};

export type MessageType =
  | { type: 'GET_STATS'; payload?: { date?: string } }
  | { type: 'ADD_BLOCKED_SITE'; payload: Omit<BlockedSite, 'id' | 'createdAt'> }
  | { type: 'REMOVE_BLOCKED_SITE'; payload: { id: string } }
  | { type: 'UPDATE_BLOCKED_SITE'; payload: BlockedSite }
  | { type: 'UPDATE_BLOCKED_SITES'; payload: BlockedSite[] }
  | { type: 'UNLOCK_SITE'; payload: { id: string; password?: string } }
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
  // Content script messages
  | { type: 'HEARTBEAT'; payload: { url: string; timestamp: number } }
  | { type: 'VISIBILITY_CHANGE'; payload: { visible: boolean; url: string; timestamp: number } }
  | { type: 'CONTENT_SCRIPT_READY'; payload: { visible: boolean; url: string; timestamp: number } }
  // Category operations
  | { type: 'GET_DOMAIN_CATEGORIES' }
  | { type: 'SET_DOMAIN_CATEGORY'; payload: { domain: string; category: SiteCategory | null } }
  // Daily limit operations
  | { type: 'GET_DAILY_LIMITS' }
  | { type: 'ADD_DAILY_LIMIT'; payload: Omit<DailyLimit, 'id'> }
  | { type: 'UPDATE_DAILY_LIMIT'; payload: DailyLimit }
  | { type: 'REMOVE_DAILY_LIMIT'; payload: { id: string } }
  | { type: 'BYPASS_DAILY_LIMIT'; payload: { id: string; password?: string } }
  | { type: 'CHECK_DAILY_LIMIT'; payload: { url: string } };
