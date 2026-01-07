import { Tag, Plus, Wrench, Bug, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// Changelog data - update this when releasing new versions
const CURRENT_VERSION = '0.7.0';

interface ChangelogEntry {
  version: string;
  date: string;
  added?: string[];
  changed?: string[];
  fixed?: string[];
}

const changelog: ChangelogEntry[] = [
  {
    version: '0.7.0',
    date: '2026-01-07',
    added: [
      'Dark mode support with three options: Light, Dark, and System (follows OS preference)',
      'Theme selector in Settings under new "Appearance" section',
      'Automatic theme switching when OS preference changes (in System mode)',
    ],
  },
  {
    version: '0.6.1',
    date: '2026-01-07',
    changed: [
      'Activity timeline now merges overlapping sessions for cleaner visualization',
    ],
  },
  {
    version: '0.6.0',
    date: '2026-01-07',
    added: [
      'Site Categories - domains automatically categorized (Social, Entertainment, News, etc.)',
      'Category breakdown view in Metrics and Overview pages',
      'Pre-built category mappings for ~300 popular domains',
      'Daily Time Limits - set maximum daily browsing time per site',
      'New "Daily Limits" page for managing time limits',
      'Bypass options for daily limits: wait timer, password, or no bypass',
      'Limits approaching warning on Overview page',
      'Blocked page shows daily limit exceeded UI with bypass options',
    ],
  },
  {
    version: '0.5.1',
    date: '2026-01-07',
    fixed: [
      'Sidebar now stays fixed while scrolling, keeping version and "What\'s New" visible on all pages',
      'Back button on changelog page now returns to previous page instead of settings',
    ],
  },
  {
    version: '0.5.0',
    date: '2026-01-07',
    added: [
      'Multi-window session tracking - tracks activity across all visible browser windows',
      'Activity Timeline visualization showing when sites were visited throughout the day',
      'Timeline preview on Overview page with link to full view',
      'Full timeline on Metrics page with date navigation and calendar picker',
      'Date range mode to view aggregated data across multiple days',
      'Slide animations when navigating between dates',
      'Multiple windows indicator on timeline rows',
    ],
    changed: [
      'Refactored time tracking from single-session to multi-session model',
      '"Time today" now represents union of all browsing sessions (no double-counting)',
    ],
  },
  {
    version: '0.4.2',
    date: '2026-01-06',
    added: [
      'Smooth expand/collapse animation for folder sections',
    ],
  },
  {
    version: '0.4.1',
    date: '2026-01-06',
    changed: [
      'New tab greeting is now deterministic based on day of year',
    ],
  },
  {
    version: '0.4.0',
    date: '2026-01-06',
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
    version: '0.3.2',
    date: '2026-01-05',
    fixed: [
      'Scheduled blocking now correctly checks if current time is within the blocking window',
      'Sites with service workers that bypass declarativeNetRequest are now blocked',
    ],
    changed: [
      'Content script runs at document_start for faster blocking',
      'Blocked attempts tracked from content script fallback',
    ],
  },
  {
    version: '0.3.1',
    date: '2026-01-05',
    fixed: [
      'Blocked site metrics now properly increment',
    ],
  },
  {
    version: '0.3.0',
    date: '2026-01-04',
    added: [
      'Content script heartbeat system for accurate time tracking',
      'Page Visibility API integration for true visibility detection',
      'Session state persistence across service worker restarts',
      'Media detection - continues tracking when audio is playing',
    ],
    fixed: [
      'UTC date bug - all date calculations now use local timezone',
      'Maximum tracking data loss reduced from 60+ seconds to ~15 seconds',
    ],
  },
  {
    version: '0.2.1',
    date: '2026-01-03',
    changed: [
      'Quick links now auto-fetch favicons',
      'Simplified add link modal - just enter URL',
      'Auto-extract site name from domain',
    ],
  },
  {
    version: '0.2.0',
    date: '2026-01-02',
    added: [
      'Custom new tab page with time-based greetings',
      'Personalized name display in settings',
      'Large clock with date on new tab',
      'Quick links with emoji icons',
      "Today's browsing stats on new tab",
    ],
  },
  {
    version: '0.1.1',
    date: '2026-01-01',
    added: [
      'Percentage display in daily breakdown hover tooltip',
      'Included dist folder for easy extension loading',
    ],
  },
  {
    version: '0.1.0',
    date: '2026-01-01',
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
