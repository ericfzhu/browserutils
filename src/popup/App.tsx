import { useEffect, useState } from 'react';
import { Clock, Shield, ShieldOff, BarChart3, Settings, Lock } from 'lucide-react';
import { DailyStats, Settings as SettingsType, LockdownStatus } from '../shared/types';

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

  // Lockdown state
  const [lockdownStatus, setLockdownStatus] = useState<LockdownStatus | null>(null);
  const [showPasswordInput, setShowPasswordInput] = useState(false);
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authenticating, setAuthenticating] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const now = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const [statsRes, settingsRes, lockdownRes] = await Promise.all([
        chrome.runtime.sendMessage({ type: 'GET_STATS', payload: { date: today } }),
        chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }),
        chrome.runtime.sendMessage({ type: 'LOCKDOWN_GET_STATUS' }),
      ]);
      setStats(statsRes);
      setSettings(settingsRes);
      setLockdownStatus(lockdownRes);
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  }

  async function toggleBlocking() {
    if (!settings) return;

    // If trying to disable blocking and a master password is set, require password
    // (unless we have a valid lockdown session)
    if (settings.blockingEnabled && lockdownStatus?.hasPassword && !lockdownStatus?.sessionValid) {
      setShowPasswordInput(true);
      setPassword('');
      setAuthError('');
      return;
    }

    await doToggleBlocking();
  }

  async function doToggleBlocking() {
    if (!settings) return;
    const newEnabled = !settings.blockingEnabled;
    const updated = await chrome.runtime.sendMessage({
      type: 'UPDATE_SETTINGS',
      payload: { blockingEnabled: newEnabled, trackingEnabled: newEnabled },
    });
    setSettings(updated);
    setShowPasswordInput(false);
    setPassword('');
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!password || authenticating) return;

    setAuthenticating(true);
    setAuthError('');

    try {
      const result = await chrome.runtime.sendMessage({
        type: 'LOCKDOWN_AUTHENTICATE',
        payload: { password },
      });

      if (result.success) {
        // Refresh lockdown status and toggle blocking
        const newStatus = await chrome.runtime.sendMessage({ type: 'LOCKDOWN_GET_STATUS' });
        setLockdownStatus(newStatus);
        await doToggleBlocking();
      } else {
        setAuthError(result.error || 'Invalid password');
      }
    } catch {
      setAuthError('Authentication failed');
    } finally {
      setAuthenticating(false);
    }
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

        {/* Inline Password Input */}
        {showPasswordInput && (
          <form onSubmit={handlePasswordSubmit} className="mt-3 space-y-2">
            <div className="flex items-center gap-2 text-xs text-white/80">
              <Lock className="w-3 h-3" />
              <span>Enter master password to continue</span>
            </div>
            <div className="flex gap-2">
              <input
                type="password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setAuthError(''); }}
                placeholder="Master password"
                className="flex-1 px-2 py-1.5 text-sm bg-white/10 border border-white/20 rounded text-white placeholder-white/50 focus:outline-none focus:ring-1 focus:ring-white/50"
                autoFocus
              />
              <button
                type="submit"
                disabled={authenticating || !password}
                className="px-3 py-1.5 text-sm bg-white/20 hover:bg-white/30 disabled:opacity-50 rounded transition-colors"
              >
                {authenticating ? '...' : 'OK'}
              </button>
              <button
                type="button"
                onClick={() => { setShowPasswordInput(false); setPassword(''); setAuthError(''); }}
                className="px-2 py-1.5 text-sm bg-white/10 hover:bg-white/20 rounded transition-colors"
              >
                X
              </button>
            </div>
            {authError && <p className="text-xs text-red-300">{authError}</p>}
          </form>
        )}
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
