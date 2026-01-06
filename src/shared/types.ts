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
}

export interface SiteVisit {
  url: string;
  domain: string;
  title: string;
  timestamp: number;
  duration: number; // seconds spent on page
}

export interface DailyStats {
  date: string; // YYYY-MM-DD
  totalTime: number; // seconds
  sites: Record<string, number>; // domain -> seconds
  visits: number;
  blockedAttempts: number;
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

export interface StorageData {
  blockedSites: BlockedSite[];
  settings: Settings;
  dailyStats: Record<string, DailyStats>; // date -> stats
  activeSession?: {
    domain: string;
    startTime: number;
    tabId: number;
  };
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
  | { type: 'UNLOCK_SITE'; payload: { id: string; password?: string } }
  | { type: 'GET_BLOCKED_SITES' }
  | { type: 'GET_SETTINGS' }
  | { type: 'UPDATE_SETTINGS'; payload: Partial<Settings> }
  | { type: 'CHECK_SITE'; payload: { url: string } }
  // Content script messages
  | { type: 'HEARTBEAT'; payload: { url: string; timestamp: number } }
  | { type: 'VISIBILITY_CHANGE'; payload: { visible: boolean; url: string; timestamp: number } }
  | { type: 'CONTENT_SCRIPT_READY'; payload: { visible: boolean; url: string; timestamp: number } };
