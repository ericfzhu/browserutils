import { useEffect, useState } from 'react';
import { Clock, Shield, ShieldOff, BarChart3, Settings } from 'lucide-react';
import { DailyStats, Settings as SettingsType } from '../shared/types';

function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

export default function App() {
  const [stats, setStats] = useState<DailyStats | null>(null);
  const [settings, setSettings] = useState<SettingsType | null>(null);
  const [loading, setLoading] = useState(true);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const now = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const [statsRes, settingsRes] = await Promise.all([
        chrome.runtime.sendMessage({ type: 'GET_STATS', payload: { date: today } }),
        chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }),
      ]);
      setStats(statsRes);
      setSettings(settingsRes);
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  }

  async function toggleBlocking() {
    if (!settings) return;
    const updated = await chrome.runtime.sendMessage({
      type: 'UPDATE_SETTINGS',
      payload: { blockingEnabled: !settings.blockingEnabled },
    });
    setSettings(updated);
  }

  function openDashboard() {
    chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') });
  }

  if (loading) {
    return (
      <div className="w-80 p-4 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const topSites = stats
    ? Object.entries(stats.sites)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
    : [];

  return (
    <div className="w-80 bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-4">
        <div className="flex items-center justify-between">
          <h1
            className="text-lg font-semibold cursor-default relative overflow-hidden"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
          >
            <span
              className={`inline-block transition-all duration-300 ${
                isHovered ? 'opacity-0 -translate-y-full' : 'opacity-100 translate-y-0'
              }`}
            >
              BrowserUtils
            </span>
            <span
              className={`absolute left-0 transition-all duration-300 ${
                isHovered ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-full'
              }`}
            >
              Boyoung😘Utils
            </span>
          </h1>
          <button
            onClick={toggleBlocking}
            className={`p-2 rounded-lg transition-colors ${
              settings?.blockingEnabled
                ? 'bg-white/20 hover:bg-white/30'
                : 'bg-red-500/50 hover:bg-red-500/70'
            }`}
            title={settings?.blockingEnabled ? 'Blocking enabled' : 'Blocking disabled'}
          >
            {settings?.blockingEnabled ? (
              <Shield className="w-5 h-5" />
            ) : (
              <ShieldOff className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>

      {/* Today's Stats */}
      <div className="p-4 border-b dark:border-gray-700">
        <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">Today</h2>
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center">
            <div className="flex items-center justify-center mb-1">
              <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="text-lg font-semibold">
              {formatTime(stats?.totalTime || 0)}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Time</div>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center mb-1">
              <BarChart3 className="w-4 h-4 text-green-600 dark:text-green-400" />
            </div>
            <div className="text-lg font-semibold">{stats?.visits || 0}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Visits</div>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center mb-1">
              <Shield className="w-4 h-4 text-red-600 dark:text-red-400" />
            </div>
            <div className="text-lg font-semibold">{stats?.blockedAttempts || 0}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Blocked</div>
          </div>
        </div>
      </div>

      {/* Top Sites */}
      {topSites.length > 0 && (
        <div className="p-4 border-b dark:border-gray-700">
          <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Top Sites</h2>
          <div className="space-y-2">
            {topSites.map(([domain, time]) => (
              <div key={domain} className="flex items-center justify-between">
                <span className="text-sm truncate flex-1">{domain}</span>
                <span className="text-sm text-gray-500 dark:text-gray-400 ml-2">{formatTime(time)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="p-4">
        <button
          onClick={openDashboard}
          className="w-full flex items-center justify-center gap-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 py-2 px-4 rounded-lg transition-colors"
        >
          <Settings className="w-4 h-4" />
          Open Dashboard
        </button>
      </div>
    </div>
  );
}
