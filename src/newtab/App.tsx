import { useEffect, useState } from 'react';
import { Plus, X, Settings } from 'lucide-react';
import { DailyStats, Settings as SettingsType, QuickLink } from '../shared/types';

function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

function getGreeting(): string {
  const now = new Date();
  const hour = now.getHours();

  // Get day of year (1-366) as a seed for deterministic selection
  const startOfYear = new Date(now.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((now.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24));

  // Select phrase based on day of year (same day = same phrase for each time period)
  const selectPhrase = (phrases: string[]) => phrases[dayOfYear % phrases.length];

  // Late night / early morning (12am - 4am)
  if (hour >= 0 && hour < 4) {
    return selectPhrase(['Hello, night owl', 'Burning the midnight oil', 'The night is still young', 'Late night thoughts']);
  }

  // Early morning (4am - 7am)
  if (hour >= 4 && hour < 7) {
    return selectPhrase(['Early bird', 'Rise and shine', 'Up before the sun', 'Fresh start']);
  }

  // Morning (7am - 12pm)
  if (hour >= 7 && hour < 12) {
    return selectPhrase(['Good morning', 'Morning', 'Hello there', 'Ready for today']);
  }

  // Afternoon (12pm - 5pm)
  if (hour >= 12 && hour < 17) {
    return selectPhrase(['Good afternoon', 'Afternoon', 'Hey there', 'How\'s your day going']);
  }

  // Evening (5pm - 9pm)
  if (hour >= 17 && hour < 21) {
    return selectPhrase(['Good evening', 'Evening', 'Winding down', 'Hope you had a good day']);
  }

  // Night (9pm - 12am)
  return selectPhrase(['Good night', 'Getting late', 'Evening thoughts', 'Night time']);
}

function formatClock(): string {
  return new Date().toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function formatDate(): string {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

function getFaviconUrl(url: string): string {
  try {
    const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
    return `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=64`;
  } catch {
    return '';
  }
}

function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
    // Remove www. prefix and return hostname
    return urlObj.hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export default function App() {
  const [time, setTime] = useState(formatClock());
  const [greeting] = useState(getGreeting());
  const [settings, setSettings] = useState<SettingsType | null>(null);
  const [stats, setStats] = useState<DailyStats | null>(null);
  const [showAddLink, setShowAddLink] = useState(false);
  const [newLinkUrl, setNewLinkUrl] = useState('');

  useEffect(() => {
    loadData();

    // Update clock every second
    const interval = setInterval(() => {
      setTime(formatClock());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  async function loadData() {
    try {
      const now = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const [settingsRes, statsRes] = await Promise.all([
        chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }),
        chrome.runtime.sendMessage({ type: 'GET_STATS', payload: { date: today } }),
      ]);
      setSettings(settingsRes);
      setStats(statsRes);
    } catch (err) {
      console.error('Failed to load data:', err);
    }
  }

  async function addQuickLink() {
    if (!settings || !newLinkUrl) return;

    const fullUrl = newLinkUrl.startsWith('http') ? newLinkUrl : `https://${newLinkUrl}`;
    const domain = extractDomain(newLinkUrl);

    const link: QuickLink = {
      id: crypto.randomUUID(),
      name: domain.split('.')[0].charAt(0).toUpperCase() + domain.split('.')[0].slice(1), // Capitalize first part of domain
      url: fullUrl,
    };

    const updatedSettings = {
      ...settings,
      quickLinks: [...settings.quickLinks, link],
    };

    await chrome.runtime.sendMessage({
      type: 'UPDATE_SETTINGS',
      payload: { quickLinks: updatedSettings.quickLinks },
    });

    setSettings(updatedSettings);
    setNewLinkUrl('');
    setShowAddLink(false);
  }

  async function removeQuickLink(id: string) {
    if (!settings) return;

    const updatedLinks = settings.quickLinks.filter((l) => l.id !== id);
    await chrome.runtime.sendMessage({
      type: 'UPDATE_SETTINGS',
      payload: { quickLinks: updatedLinks },
    });

    setSettings({ ...settings, quickLinks: updatedLinks });
  }

  function openDashboard() {
    window.location.href = chrome.runtime.getURL('dashboard.html');
  }

  const topSites = stats
    ? Object.entries(stats.sites)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
    : [];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-16">
        {/* Header with settings */}
        <div className="absolute top-4 right-4">
          <button
            onClick={openDashboard}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
            title="Open Dashboard"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>

        {/* Greeting & Time */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-light text-gray-700 mb-2">
            {greeting}
            {settings?.displayName && (
              <span className="text-blue-600">, {settings.displayName}</span>
            )}
          </h1>
          <div className="text-6xl font-extralight tracking-tight text-gray-900 mb-2">{time}</div>
          <p className="text-gray-400">{formatDate()}</p>
        </div>

        {/* Quick Links */}
        <div className="mb-12">
          <div className="flex flex-wrap justify-center gap-4">
            {settings?.quickLinks.map((link) => (
              <a
                key={link.id}
                href={link.url}
                className="group relative flex flex-col items-center gap-2 p-4 bg-white hover:bg-gray-100 rounded-2xl transition-colors min-w-[100px] border border-gray-200 shadow-sm"
              >
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    removeQuickLink(link.id);
                  }}
                  className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-3 h-3" />
                </button>
                <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center overflow-hidden">
                  <img
                    src={getFaviconUrl(link.url)}
                    alt={link.name}
                    className="w-8 h-8"
                    onError={(e) => {
                      // Fallback to first letter if favicon fails
                      e.currentTarget.style.display = 'none';
                      e.currentTarget.parentElement!.innerHTML = `<span class="text-2xl text-gray-400">${link.name.charAt(0).toUpperCase()}</span>`;
                    }}
                  />
                </div>
                <span className="text-sm text-gray-600">{link.name}</span>
              </a>
            ))}

            {/* Add Link Button */}
            <button
              onClick={() => setShowAddLink(true)}
              className="flex flex-col items-center gap-2 p-4 bg-white hover:bg-gray-100 rounded-2xl transition-colors min-w-[100px] border-2 border-dashed border-gray-300"
            >
              <div className="w-12 h-12 rounded-xl flex items-center justify-center">
                <Plus className="w-6 h-6 text-gray-400" />
              </div>
              <span className="text-sm text-gray-400">Add</span>
            </button>
          </div>
        </div>

        {/* Today's Stats */}
        <div className="max-w-sm mx-auto">
          <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
            <h2 className="text-sm font-medium text-gray-400 mb-4">Today</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Browsing time</span>
                <span className="font-medium text-gray-900">{formatTime(stats?.totalTime || 0)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Sites visited</span>
                <span className="font-medium text-gray-900">{Object.keys(stats?.sites || {}).length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Distractions blocked</span>
                <span className="font-medium text-gray-900">{stats?.blockedAttempts || 0}</span>
              </div>

              {topSites.length > 0 && (
                <>
                  <div className="border-t border-gray-100 my-3" />
                  <p className="text-xs text-gray-400 mb-2">Top sites</p>
                  {topSites.map(([domain, siteTime]) => (
                    <div key={domain} className="flex items-center justify-between text-sm">
                      <span className="text-gray-500 truncate">{domain}</span>
                      <span className="text-gray-400">{formatTime(siteTime)}</span>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Add Link Modal */}
      {showAddLink && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm mx-4 shadow-xl">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Add Quick Link</h2>
            <div className="space-y-4">
              <div>
                <input
                  type="text"
                  value={newLinkUrl}
                  onChange={(e) => setNewLinkUrl(e.target.value)}
                  placeholder="Enter URL (e.g., github.com)"
                  className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newLinkUrl) {
                      addQuickLink();
                    }
                  }}
                />
                <p className="text-xs text-gray-400 mt-2">
                  Favicon and name will be auto-detected
                </p>
              </div>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowAddLink(false);
                    setNewLinkUrl('');
                  }}
                  className="px-4 py-2 text-gray-600 hover:text-gray-900 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={addQuickLink}
                  disabled={!newLinkUrl}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg transition-colors"
                >
                  Add
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
