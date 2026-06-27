import { useEffect } from 'react';
import { Tag, Plus, Wrench, Bug, ArrowLeft, Minus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// Changelog data - update this when releasing new versions
const CURRENT_VERSION = '0.40.0';

interface ChangelogEntry {
  version: string;
  date: string;
  added?: string[];
  changed?: string[];
  fixed?: string[];
  removed?: string[];
}

const changelog: ChangelogEntry[] = [
  {
    version: '0.40.0',
    date: '2026-06-27',
    added: [
      'Paste Anyway lets you paste into text fields on sites that block paste events',
      'Settings include a Paste Anyway toggle that applies as soon as it changes',
    ],
    changed: [
      'Settings controls autosave instead of relying on repeated Save Settings buttons',
      'Changelog history uses one release-numbering scheme: each release increments the middle number',
    ],
  },
  {
    version: '0.39.0',
    date: '2026-06-22',
    changed: [
      'General browser usage tracking keeps active tab sessions in temporary session storage instead of local storage',
      'Heartbeats refresh live tracking state without writing finalized stats on every tick, which cuts down storage writes while keeping minute-level saves',
      'Recorded usage intervals are compacted as they are saved, and visits count once per browsing session instead of once per heartbeat segment',
    ],
  },
  {
    version: '0.38.0',
    date: '2026-06-22',
    changed: [
      'Cleaned up the dashboard, popup, new tab, and blocked page visuals with softer surfaces, clearer spacing, and steadier live numbers',
      'Daily limits on the Overview page separate exceeded limits from limits that are close to their threshold',
    ],
  },
  {
    version: '0.37.0',
    date: '2026-05-28',
    added: [
      'shadcn/ui primitives and Tailwind semantic color tokens across the extension UI',
      'Color Theme setting with Monochrome and Classic Blue palette options',
    ],
    changed: [
      'Updated popup, new tab, blocked page, settings, daily limits, category controls, dashboard shell, and lockdown authentication UI to use the new shared component system',
      'Unified app chrome around semantic theme tokens while preserving category, chart, warning, and status colors in Monochrome mode',
    ],
  },
  {
    version: '0.36.0',
    date: '2026-05-24',
    fixed: [
      'Blocked pages resolve focus mode before rendering, so the generic blocked message no longer flashes first',
    ],
  },
  {
    version: '0.35.0',
    date: '2026-03-30',
    fixed: [
      'Daily limits normalize pasted URLs to the tracked domain format, keeping limit matching and reported usage aligned',
    ],
  },
  {
    version: '0.34.0',
    date: '2026-03-30',
    changed: [
      'Active focus sessions use the same extension controls as new sessions: 30m, 1h, 1.5h presets, 30-minute steps, and custom minutes',
    ],
  },
  {
    version: '0.33.0',
    date: '2026-03-30',
    changed: [
      'Focus sessions use 30m, 1h, and 1.5h presets, 30-minute step controls, and a custom minutes input',
    ],
  },
  {
    version: '0.32.0',
    date: '2026-03-23',
    added: [
      'The extension popup shows the active focus target and remaining time',
    ],
  },
  {
    version: '0.31.0',
    date: '2026-03-09',
    added: [
      'Lockdown Mode can use an authenticator app instead of the master password',
      'Authenticator setup shows a QR code for standard TOTP enrollment',
    ],
    changed: [
      'Settings let you configure both master password and authenticator app, then choose which method Lockdown Mode requires',
    ],
    fixed: [
      'Lockdown-protected actions use the selected authentication method immediately instead of waiting for a reload',
    ],
  },
  {
    version: '0.30.0',
    date: '2026-03-09',
    added: [
      'Global Focus mode on the Blocked Sites page blocks every blocked site at once, including uncategorized sites',
    ],
    changed: [
      'Blocked pages show focus mode messaging before the site\'s normal block reason when a focus session is active',
    ],
    fixed: [
      'Prevented stale tracking sessions from resuming across sleep, lid-close, restart, or next-day login gaps and logging phantom overnight time',
    ],
  },
  {
    version: '0.29.0',
    date: '2026-02-20',
    changed: [
      'Reduced background storage reads by caching settings in the service worker for hot tracking and blocking paths',
      'Timeline rows precompute per-domain window counts instead of filtering sessions during each render',
    ],
    fixed: [
      'Session recording splits cross-midnight intervals into per-day segments',
      'Scheduled blocking handles overnight windows, such as 23:00 to 06:00',
    ],
  },
  {
    version: '0.28.0',
    date: '2026-02-19',
    changed: [
      'Tracking requires fresh content-script heartbeats, so hidden or stale tabs stop counting',
      'Periodic session saves record only up to the last confirmed activity instead of assuming the tab stayed visible',
    ],
    fixed: [
      'Multi-window tracking ends stale sessions quickly when windows are minimized, hidden, or no longer sending visibility heartbeats',
      'Two visible windows on the same site track independently while dashboard totals still avoid double-counting overlap',
    ],
  },
  {
    version: '0.27.0',
    date: '2026-01-16',
    fixed: [
      'Minimized windows stop tracking immediately on focus change instead of waiting for the next periodic check',
      'Sessions cap recorded time at last confirmed activity plus 30 seconds, avoiding hours of phantom time if alarms fail',
      'Session end events no longer record the same session twice when they fire at the same time',
    ],
  },
  {
    version: '0.26.0',
    date: '2026-01-10',
    added: [
      'Focus sessions for blocking every site in a folder with one shared timer',
      'Focus button on folder headers opens modal to set duration',
      'Quick duration presets (15m, 30m, 1h, 2h) in focus modal',
      'Focus sessions override individual site settings and block everything in the folder',
    ],
    removed: [
      'New tab page override. Chrome uses its default new tab page again',
    ],
    changed: [
      'Timer blocking is temporary. Sites stay accessible until you start the timer',
      'Timer sites show "Disabled" button that starts blocking when clicked, "Stop" to end early',
      'Active timer blocks display remaining time with live countdown in dashboard and blocked page',
      'Time remaining appears to the left of the block type label',
      'Enable All and Disable All on folders start or clear timer blocks for timer-type sites',
      'Status buttons use the same width for Blocking, Disabled, and Stop states',
    ],
    fixed: [
      'Timer duration input can be cleared before typing a new value',
      'Timer blocks start immediately when clicking Disabled or Enable All',
    ],
  },
  {
    version: '0.25.0',
    date: '2026-01-10',
    changed: [
      'Compact session storage format reduces data size by ~65%',
      'Faster loading of Categories and Metrics pages by loading summary data first',
      'Timeline and YouTube data load only for the selected date range',
      'One-time migration converts existing data to compact format on update',
    ],
  },
  {
    version: '0.24.0',
    date: '2026-01-10',
    added: [
      'Categories page showing sites grouped by category with time spent',
      'Collapsible categories',
      'Expand all/Collapse all button for quick category management',
      'Select mode for bulk moving multiple sites between categories',
      'Drag and drop to reorder categories (except "Other" which stays at the bottom)',
      'Drag and drop sites between categories to recategorize them',
      'Drop sites onto collapsed categories',
      'Custom categories with names and colors',
      'Drag a site to "Drop here to create new category" zone to create a category for it',
      'Rename built-in categories (original names preserved, can reset anytime)',
      'Delete custom categories (sites return to their default category)',
      'Default badge on built-in categories to distinguish from custom ones',
    ],
  },
  {
    version: '0.23.0',
    date: '2026-01-10',
    added: [
      'Day/Week/Month/Custom date selector on Metrics page with animated sliding indicator',
      'Custom date range picker with calendar and presets (Week to date, Month to date, Last 7 days, Last 30 days)',
      'Expandable/collapsible Activity timeline and YouTube channels sections on Metrics page',
      'Clickable domain links in Metrics page Activity timeline and Top sites',
      'Anchor navigation from Overview "View all" links to specific sections on Metrics page',
    ],
    changed: [
      'Overview and Metrics labels use sentence case',
      'Consistent spacing between sections on Overview and Metrics pages',
      'Activity timeline shows day markers instead of hour markers for multi-day date ranges',
    ],
  },
  {
    version: '0.22.0',
    date: '2026-01-10',
    added: [
      'GitHub link in Settings page under new About section',
    ],
    fixed: [
      'Blocked pages open when a link to a blocked site comes from another website instead of showing Chrome ERR_BLOCKED_BY_CLIENT',
    ],
  },
  {
    version: '0.21.0',
    date: '2026-01-09',
    added: [
      'Clickable YouTube channel names in Overview and Metrics',
      'Clickable site URLs in Overview',
    ],
    fixed: [
      'YouTube session data survives overlaps between YouTube tracking and site tracking',
      'YouTube channel URLs are captured from video pages',
    ],
  },
  {
    version: '0.20.0',
    date: '2026-01-09',
    added: [
      'Lockdown Mode requires the master password to disable blocking, remove sites, or disable limits',
      'Disabling blocking from the popup requires the master password when one is set',
      '5-minute authentication session after entering password for uninterrupted changes',
      'Session automatically clears when dashboard is closed',
      'New shield icon as extension favicon and toolbar icon',
    ],
  },
  {
    version: '0.19.0',
    date: '2026-01-08',
    added: [
      'Path-based site blocking for URL paths like reddit.com/r/funny/*',
      'URL input normalization strips https:// and formats patterns correctly',
    ],
    changed: [
      'https://example.com/ normalizes to example.com',
      'https://example.com/path/ normalizes to example.com/path/*',
    ],
  },
  {
    version: '0.18.0',
    date: '2026-01-08',
    added: [
      'Folder reordering by drag and drop in Blocked Sites',
      'Site reordering within folders by drag and drop in Blocked Sites',
    ],
    changed: [
      'Clicking anywhere on a folder header expands or collapses it',
    ],
    fixed: [
      'Missing gap between YouTube Channels and other sections in Overview and Metrics tabs',
      'Drag and drop works when folders are collapsed in Blocked Sites',
      'Folder headers and site rows are easier to tell apart in Blocked Sites',
    ],
  },
  {
    version: '0.17.0',
    date: '2026-01-07',
    changed: [
      'YouTube tracking uses the Media Session API for channel detection',
      'YouTube watch time tracks playback (play/pause) instead of page open time',
      'YouTube continues tracking when tab is in background (if video is still playing)',
      'Overview progress bars are relative to the top item',
    ],
    fixed: [
      'YouTube channel detection works across video pages',
      'Channel changes are no longer detected falsely when channelId appears intermittently',
    ],
  },
  {
    version: '0.16.0',
    date: '2026-01-07',
    added: [
      'YouTube Channel Tracking for videos and Shorts',
      'New setting to enable/disable YouTube tracking (off by default)',
      'YouTube Channels section in Overview showing top watched channels',
      'YouTube Channels section in Metrics with full channel breakdown',
    ],
  },
  {
    version: '0.15.0',
    date: '2026-01-07',
    added: [
      'Dark mode support with three options: Light, Dark, and System (follows OS preference)',
      'Theme selector in Settings under new "Appearance" section',
      'Automatic theme switching when OS preference changes (in System mode)',
    ],
    fixed: [
      'Blocked sites list follows the dark mode theme',
    ],
  },
  {
    version: '0.14.0',
    date: '2026-01-07',
    changed: [
      'Activity timeline merges overlapping sessions',
    ],
  },
  {
    version: '0.13.0',
    date: '2026-01-07',
    added: [
      'Site Categories automatically categorize domains (Social, Entertainment, News, etc.)',
      'Category breakdown view in Metrics and Overview pages',
      'Pre-built category mappings for ~300 popular domains',
      'Daily Time Limits for maximum daily browsing time per site',
      'New "Daily Limits" page for managing time limits',
      'Bypass options for daily limits: wait timer, password, or no bypass',
      'Limits approaching warning on Overview page',
      'Blocked page shows daily limit exceeded UI with bypass options',
    ],
  },
  {
    version: '0.12.0',
    date: '2026-01-07',
    fixed: [
      'Sidebar stays fixed while scrolling, keeping version and "What\'s New" visible on all pages',
      'Back button on the changelog page returns to the previous page instead of Settings',
    ],
  },
  {
    version: '0.11.0',
    date: '2026-01-07',
    added: [
      'Multi-window session tracking across all visible browser windows',
      'Activity Timeline visualization showing when sites were visited throughout the day',
      'Timeline preview on Overview page with link to full view',
      'Full timeline on Metrics page with date navigation and calendar picker',
      'Date range mode to view aggregated data across multiple days',
      'Slide animations when navigating between dates',
      'Multiple windows indicator on timeline rows',
    ],
    changed: [
      'Refactored time tracking from single-session to multi-session model',
      '"Time today" represents the union of all browsing sessions, avoiding overlap double-counting',
    ],
  },
  {
    version: '0.10.0',
    date: '2026-01-07',
    added: [
      'Smooth expand/collapse animation for folder sections',
    ],
  },
  {
    version: '0.9.0',
    date: '2026-01-07',
    changed: [
      'New tab greeting is deterministic based on day of year',
    ],
  },
  {
    version: '0.8.0',
    date: '2026-01-07',
    added: [
      'Folder organization for blocked sites',
      'Drag-and-drop support for moving sites between folders',
      'Collapsible folder sections',
      'Group-level enable/disable controls per folder',
      'Folder selector when adding/editing blocked sites',
    ],
    changed: [
      'Blocked Sites page refactored from table to grouped folder view',
    ],
  },
  {
    version: '0.7.0',
    date: '2026-01-07',
    fixed: [
      'Scheduled blocking checks whether the current time is inside the blocking window',
      'Sites with service workers that bypass declarativeNetRequest are blocked',
    ],
    changed: [
      'Content script runs at document_start for faster blocking',
      'Blocked attempts tracked from content script fallback',
    ],
  },
  {
    version: '0.6.0',
    date: '2026-01-07',
    fixed: [
      'Blocked site metrics increment correctly',
    ],
  },
  {
    version: '0.5.0',
    date: '2026-01-07',
    added: [
      'Content script heartbeat system for accurate time tracking',
      'Page Visibility API integration for true visibility detection',
      'Session state persistence across service worker restarts',
      'Media detection keeps tracking active when audio is playing',
    ],
    fixed: [
      'Date calculations use local timezone instead of UTC',
      'Maximum tracking data loss reduced from 60+ seconds to ~15 seconds',
    ],
  },
  {
    version: '0.4.0',
    date: '2026-01-07',
    changed: [
      'Quick links auto-fetch favicons',
      'Simplified add link modal: just enter URL',
      'Auto-extract site name from domain',
    ],
  },
  {
    version: '0.3.0',
    date: '2026-01-07',
    added: [
      'Custom new tab page with time-based greetings',
      'Personalized name display in settings',
      'Large clock with date on new tab',
      'Quick links with emoji icons',
      "Today's browsing stats on new tab",
    ],
  },
  {
    version: '0.2.0',
    date: '2026-01-06',
    added: [
      'Percentage display in daily breakdown hover tooltip',
      'Included dist folder for easy extension loading',
    ],
  },
  {
    version: '0.1.0',
    date: '2026-01-06',
    added: [
      'Website time tracking with per-site breakdowns',
      'Site blocking with password, timer, and schedule options',
      'Dashboard with Overview and Metrics pages',
      'Popup for quick stats access',
      'Settings for tracking, blocking, theme, and data retention',
      'Idle detection to pause tracking when inactive',
    ],
  },
];

export { CURRENT_VERSION };

export default function Changelog() {
  const navigate = useNavigate();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate(-1)}
          className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Changelog</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">What's new in BrowserUtils</p>
        </div>
      </div>

      <div className="space-y-6">
        {changelog.map((entry, index) => (
          <div
            key={entry.version}
            className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className={`p-2 rounded-lg ${index === 0 ? 'bg-blue-100 dark:bg-blue-900/50' : 'bg-gray-100 dark:bg-gray-700'}`}>
                <Tag className={`w-5 h-5 ${index === 0 ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'}`} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold">v{entry.version}</h2>
                  {index === 0 && (
                    <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 text-xs font-medium rounded-full">
                      Current
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400">{formatDate(entry.date)}</p>
              </div>
            </div>

            <div className="space-y-4">
              {entry.added && entry.added.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 text-green-600 mb-2">
                    <Plus className="w-4 h-4" />
                    <span className="text-sm font-medium">Added</span>
                  </div>
                  <ul className="space-y-1 ml-6">
                    {entry.added.map((item, i) => (
                      <li key={i} className="text-sm text-gray-600 dark:text-gray-300 list-disc">
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {entry.changed && entry.changed.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 mb-2">
                    <Wrench className="w-4 h-4" />
                    <span className="text-sm font-medium">Changed</span>
                  </div>
                  <ul className="space-y-1 ml-6">
                    {entry.changed.map((item, i) => (
                      <li key={i} className="text-sm text-gray-600 dark:text-gray-300 list-disc">
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {entry.fixed && entry.fixed.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 text-red-600 dark:text-red-400 mb-2">
                    <Bug className="w-4 h-4" />
                    <span className="text-sm font-medium">Fixed</span>
                  </div>
                  <ul className="space-y-1 ml-6">
                    {entry.fixed.map((item, i) => (
                      <li key={i} className="text-sm text-gray-600 dark:text-gray-300 list-disc">
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {entry.removed && entry.removed.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-2">
                    <Minus className="w-4 h-4" />
                    <span className="text-sm font-medium">Removed</span>
                  </div>
                  <ul className="space-y-1 ml-6">
                    {entry.removed.map((item, i) => (
                      <li key={i} className="text-sm text-gray-600 dark:text-gray-300 list-disc">
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}
