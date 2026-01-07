import { useEffect, useState } from 'react';
import { Shield, Lock, Clock, ArrowLeft, Timer } from 'lucide-react';
import { BlockedSite, DailyLimit, DailyStats } from '../shared/types';

function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

function getTimeUntilMidnight(): string {
  const now = new Date();
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0);
  const diff = midnight.getTime() - now.getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours}h ${minutes}m`;
}

function getDateString(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

type BlockType = 'site' | 'limit';

interface LimitInfo {
  limit: DailyLimit;
  timeSpent: number;
}

export default function App() {
  const [blockType, setBlockType] = useState<BlockType>('site');
  const [site, setSite] = useState<BlockedSite | null>(null);
  const [limitInfo, setLimitInfo] = useState<LimitInfo | null>(null);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [unlocking, setUnlocking] = useState(false);
  const [timerStarted, setTimerStarted] = useState(false);
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else if (timerStarted && countdown === 0) {
      // Timer finished, unlock the site
      if (blockType === 'site') {
        handleTimerComplete();
      } else {
        handleLimitBypass();
      }
    }
  }, [countdown, timerStarted, blockType]);

  async function loadData() {
    const params = new URLSearchParams(window.location.search);
    const type = params.get('type');
    const siteId = params.get('site');
    const limitId = params.get('limitId');

    if (type === 'limit' && limitId) {
      setBlockType('limit');
      await loadLimit(limitId);
    } else if (siteId) {
      setBlockType('site');
      await loadSite(siteId);
    }
  }

  async function loadLimit(limitId: string) {
    try {
      const [limits, stats]: [DailyLimit[], DailyStats] = await Promise.all([
        chrome.runtime.sendMessage({ type: 'GET_DAILY_LIMITS' }),
        chrome.runtime.sendMessage({ type: 'GET_STATS', payload: { date: getDateString(new Date()) } }),
      ]);

      const limit = limits.find((l: DailyLimit) => l.id === limitId);
      if (limit) {
        const domain = limit.pattern.replace(/^www\./, '');
        const timeSpent = stats?.sites?.[domain] || stats?.sites?.['www.' + domain] || stats?.sites?.[limit.pattern] || 0;
        setLimitInfo({ limit, timeSpent });

        // Increment blocked attempt counter
        await chrome.runtime.sendMessage({
          type: 'INCREMENT_BLOCKED_ATTEMPT',
          payload: { domain: limit.pattern },
        });
      }
    } catch (err) {
      console.error('Failed to load limit:', err);
    }
  }

  async function loadSite(siteId: string) {
    try {
      const sites = await chrome.runtime.sendMessage({ type: 'GET_BLOCKED_SITES' });
      const found = sites.find((s: BlockedSite) => s.id === siteId);
      setSite(found || null);

      // Increment blocked attempt counter
      if (found) {
        await chrome.runtime.sendMessage({
          type: 'INCREMENT_BLOCKED_ATTEMPT',
          payload: { domain: found.pattern },
        });
      }
    } catch (err) {
      console.error('Failed to load site:', err);
    }
  }

  async function handlePasswordUnlock(e: React.FormEvent) {
    e.preventDefault();
    if (!site || !password) return;

    setUnlocking(true);
    setError('');

    try {
      const result = await chrome.runtime.sendMessage({
        type: 'UNLOCK_SITE',
        payload: { id: site.id, password },
      });

      if (result.success) {
        // Redirect back
        window.history.back();
      } else {
        setError(result.error || 'Failed to unlock');
      }
    } catch (err) {
      console.error('Failed to unlock:', err);
      setError('Failed to unlock site');
    } finally {
      setUnlocking(false);
    }
  }

  function startTimer() {
    if (!site?.timerDuration) return;
    // Wait for 5 seconds before unlocking (anti-impulse delay)
    setCountdown(5);
    setTimerStarted(true);
  }

  async function handleTimerComplete() {
    if (!site) return;

    try {
      const result = await chrome.runtime.sendMessage({
        type: 'UNLOCK_SITE',
        payload: { id: site.id },
      });

      if (result.success) {
        window.history.back();
      }
    } catch (err) {
      console.error('Failed to unlock:', err);
    }
  }

  function goBack() {
    window.history.back();
  }

  function startLimitCooldown() {
    if (!limitInfo) return;
    const cooldownSeconds = limitInfo.limit.cooldownSeconds || 30;
    setCountdown(cooldownSeconds);
    setTimerStarted(true);
  }

  async function handleLimitBypass() {
    if (!limitInfo) return;

    try {
      const result = await chrome.runtime.sendMessage({
        type: 'BYPASS_DAILY_LIMIT',
        payload: { id: limitInfo.limit.id },
      });

      if (result.success) {
        window.history.back();
      } else {
        setError(result.error || 'Failed to bypass limit');
      }
    } catch (err) {
      console.error('Failed to bypass limit:', err);
      setError('Failed to bypass limit');
    }
  }

  async function handleLimitPasswordBypass(e: React.FormEvent) {
    e.preventDefault();
    if (!limitInfo || !password) return;

    setUnlocking(true);
    setError('');

    try {
      const result = await chrome.runtime.sendMessage({
        type: 'BYPASS_DAILY_LIMIT',
        payload: { id: limitInfo.limit.id, password },
      });

      if (result.success) {
        window.history.back();
      } else {
        setError(result.error || 'Failed to bypass limit');
      }
    } catch (err) {
      console.error('Failed to bypass limit:', err);
      setError('Failed to bypass limit');
    } finally {
      setUnlocking(false);
    }
  }

  // Show limit exceeded UI
  if (blockType === 'limit' && limitInfo) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Timer className="w-8 h-8 text-amber-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Daily Limit Reached</h1>
            <p className="text-gray-500">
              <span className="font-medium text-gray-700">{limitInfo.limit.pattern}</span>
            </p>
          </div>

          {/* Time Info */}
          <div className="bg-amber-50 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-amber-800">Time spent today</span>
              <span className="font-medium text-amber-900">{formatTime(limitInfo.timeSpent)}</span>
            </div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-amber-800">Daily limit</span>
              <span className="font-medium text-amber-900">{formatTime(limitInfo.limit.limitSeconds)}</span>
            </div>
            <div className="h-2 bg-amber-200 rounded-full overflow-hidden mt-3">
              <div className="h-full bg-amber-500 rounded-full" style={{ width: '100%' }} />
            </div>
          </div>

          <p className="text-sm text-gray-500 text-center mb-6">
            Limit resets in {getTimeUntilMidnight()}
          </p>

          {/* Cooldown Bypass */}
          {limitInfo.limit.bypassType === 'cooldown' && (
            <div className="space-y-4">
              {!timerStarted ? (
                <button
                  onClick={startLimitCooldown}
                  className="w-full bg-amber-600 hover:bg-amber-700 text-white py-3 rounded-lg transition-colors"
                >
                  Wait {limitInfo.limit.cooldownSeconds || 30}s to continue
                </button>
              ) : countdown > 0 ? (
                <div className="text-center py-4">
                  <div className="text-4xl font-bold text-amber-600 mb-2">{countdown}</div>
                  <p className="text-sm text-gray-500">Taking a moment to reconsider...</p>
                </div>
              ) : (
                <div className="text-center py-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600 mx-auto"></div>
                  <p className="text-sm text-gray-500 mt-2">Granting access...</p>
                </div>
              )}
            </div>
          )}

          {/* Password Bypass */}
          {limitInfo.limit.bypassType === 'password' && (
            <form onSubmit={handleLimitPasswordBypass} className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-gray-600 mb-4">
                <Lock className="w-4 h-4" />
                <span>Enter password to continue for 15 minutes</span>
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError('');
                }}
                placeholder="Enter password"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                autoFocus
              />
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button
                type="submit"
                disabled={unlocking || !password}
                className="w-full bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white py-3 rounded-lg transition-colors"
              >
                {unlocking ? 'Verifying...' : 'Continue for 15 minutes'}
              </button>
            </form>
          )}

          {/* No Bypass */}
          {limitInfo.limit.bypassType === 'none' && (
            <div className="text-center py-4">
              <p className="text-gray-600">
                This limit cannot be bypassed. Check back after midnight.
              </p>
            </div>
          )}

          {/* Back Button */}
          <button
            onClick={goBack}
            className="w-full mt-4 flex items-center justify-center gap-2 text-gray-600 hover:text-gray-900 py-2 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Go Back
          </button>

          {/* Dashboard Link */}
          <div className="mt-6 pt-6 border-t text-center">
            <a
              href={chrome.runtime.getURL('dashboard.html#/limits')}
              className="text-sm text-amber-600 hover:text-amber-700"
            >
              Manage daily limits in dashboard
            </a>
          </div>
        </div>
      </div>
    );
  }

  // Show blocked site UI (original behavior)
  if (!site) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center p-4">
        <div className="text-center">
          <Shield className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Site Blocked</h1>
          <p className="text-gray-600">This site has been blocked by BrowserUtils.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Shield className="w-8 h-8 text-red-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Site Blocked</h1>
          <p className="text-gray-500">
            <span className="font-medium text-gray-700">{site.pattern}</span> is blocked
          </p>
        </div>

        {/* Password Unlock */}
        {site.unlockType === 'password' && (
          <form onSubmit={handlePasswordUnlock} className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-gray-600 mb-4">
              <Lock className="w-4 h-4" />
              <span>Enter password to unlock temporarily</span>
            </div>
            <input
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError('');
              }}
              placeholder="Enter password"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              autoFocus
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={unlocking || !password}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-3 rounded-lg transition-colors"
            >
              {unlocking ? 'Unlocking...' : 'Unlock Site'}
            </button>
          </form>
        )}

        {/* Timer Unlock */}
        {site.unlockType === 'timer' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-gray-600 mb-4">
              <Clock className="w-4 h-4" />
              <span>Wait {site.timerDuration} minutes to unlock</span>
            </div>

            {!timerStarted ? (
              <button
                onClick={startTimer}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg transition-colors"
              >
                Start Timer ({site.timerDuration} min access)
              </button>
            ) : countdown > 0 ? (
              <div className="text-center py-4">
                <div className="text-4xl font-bold text-blue-600 mb-2">{countdown}</div>
                <p className="text-sm text-gray-500">Taking a moment to reconsider...</p>
              </div>
            ) : (
              <div className="text-center py-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="text-sm text-gray-500 mt-2">Unlocking...</p>
              </div>
            )}
          </div>
        )}

        {/* Always Blocked */}
        {site.unlockType === 'none' && (
          <div className="text-center py-4">
            <p className="text-gray-600">
              This site is permanently blocked. Go to the dashboard to change settings.
            </p>
          </div>
        )}

        {/* Schedule Info */}
        {site.unlockType === 'schedule' && site.schedule && (
          <div className="text-center py-4">
            <p className="text-gray-600 mb-2">
              This site is blocked during scheduled hours.
            </p>
            <p className="text-sm text-gray-500">
              Blocked: {site.schedule.startTime} - {site.schedule.endTime}
            </p>
          </div>
        )}

        {/* Back Button */}
        <button
          onClick={goBack}
          className="w-full mt-4 flex items-center justify-center gap-2 text-gray-600 hover:text-gray-900 py-2 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Go Back
        </button>

        {/* Dashboard Link */}
        <div className="mt-6 pt-6 border-t text-center">
          <a
            href={chrome.runtime.getURL('dashboard.html#/blocked')}
            className="text-sm text-blue-600 hover:text-blue-700"
          >
            Manage blocked sites in dashboard
          </a>
        </div>
      </div>
    </div>
  );
}
