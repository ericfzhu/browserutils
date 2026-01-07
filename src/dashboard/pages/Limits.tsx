import { useEffect, useState } from 'react';
import { Plus, Trash2, Edit2, X, Check } from 'lucide-react';
import { DailyLimit, DailyStats } from '../../shared/types';
import { hashPassword } from '../../shared/storage';

function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

function getDateString(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

interface LimitFormData {
  pattern: string;
  limitHours: number;
  limitMinutes: number;
  bypassType: 'password' | 'cooldown' | 'none';
  password: string;
  cooldownSeconds: number;
}

const DEFAULT_FORM: LimitFormData = {
  pattern: '',
  limitHours: 0,
  limitMinutes: 30,
  bypassType: 'cooldown',
  password: '',
  cooldownSeconds: 30,
};

export default function Limits() {
  const [limits, setLimits] = useState<DailyLimit[]>([]);
  const [todayStats, setTodayStats] = useState<DailyStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingLimit, setEditingLimit] = useState<DailyLimit | null>(null);
  const [formData, setFormData] = useState<LimitFormData>(DEFAULT_FORM);
  const [error, setError] = useState<string | null>(null);

  const today = getDateString(new Date());

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [limitsData, stats] = await Promise.all([
        chrome.runtime.sendMessage({ type: 'GET_DAILY_LIMITS' }),
        chrome.runtime.sendMessage({ type: 'GET_STATS', payload: { date: today } }),
      ]);
      setLimits(limitsData || []);
      setTodayStats(stats);
    } catch (err) {
      console.error('Failed to load limits:', err);
    } finally {
      setLoading(false);
    }
  }

  function openAddModal() {
    setEditingLimit(null);
    setFormData(DEFAULT_FORM);
    setError(null);
    setShowModal(true);
  }

  function openEditModal(limit: DailyLimit) {
    setEditingLimit(limit);
    setFormData({
      pattern: limit.pattern,
      limitHours: Math.floor(limit.limitSeconds / 3600),
      limitMinutes: Math.floor((limit.limitSeconds % 3600) / 60),
      bypassType: limit.bypassType,
      password: '',
      cooldownSeconds: limit.cooldownSeconds || 30,
    });
    setError(null);
    setShowModal(true);
  }

  async function handleSubmit() {
    if (!formData.pattern.trim()) {
      setError('Domain is required');
      return;
    }

    const totalSeconds = formData.limitHours * 3600 + formData.limitMinutes * 60;
    if (totalSeconds < 60) {
      setError('Limit must be at least 1 minute');
      return;
    }

    if (formData.bypassType === 'password' && !formData.password && !editingLimit) {
      setError('Password is required for password bypass');
      return;
    }

    try {
      let passwordHash: string | undefined;
      if (formData.bypassType === 'password' && formData.password) {
        passwordHash = await hashPassword(formData.password);
      } else if (editingLimit?.passwordHash && formData.bypassType === 'password') {
        passwordHash = editingLimit.passwordHash;
      }

      if (editingLimit) {
        await chrome.runtime.sendMessage({
          type: 'UPDATE_DAILY_LIMIT',
          payload: {
            ...editingLimit,
            pattern: formData.pattern.trim().toLowerCase(),
            limitSeconds: totalSeconds,
            bypassType: formData.bypassType,
            passwordHash,
            cooldownSeconds: formData.bypassType === 'cooldown' ? formData.cooldownSeconds : undefined,
          },
        });
      } else {
        await chrome.runtime.sendMessage({
          type: 'ADD_DAILY_LIMIT',
          payload: {
            pattern: formData.pattern.trim().toLowerCase(),
            limitSeconds: totalSeconds,
            enabled: true,
            bypassType: formData.bypassType,
            passwordHash,
            cooldownSeconds: formData.bypassType === 'cooldown' ? formData.cooldownSeconds : undefined,
          },
        });
      }

      setShowModal(false);
      loadData();
    } catch (err) {
      setError('Failed to save limit');
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this limit?')) return;

    try {
      await chrome.runtime.sendMessage({ type: 'REMOVE_DAILY_LIMIT', payload: { id } });
      loadData();
    } catch (err) {
      console.error('Failed to delete limit:', err);
    }
  }

  async function toggleEnabled(limit: DailyLimit) {
    try {
      await chrome.runtime.sendMessage({
        type: 'UPDATE_DAILY_LIMIT',
        payload: { ...limit, enabled: !limit.enabled },
      });
      loadData();
    } catch (err) {
      console.error('Failed to toggle limit:', err);
    }
  }

  function getTimeSpent(pattern: string): number {
    if (!todayStats?.sites) return 0;
    const domain = pattern.replace(/^www\./, '');
    return todayStats.sites[domain] || todayStats.sites['www.' + domain] || todayStats.sites[pattern] || 0;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Daily Limits</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Set maximum daily time for specific sites</p>
        </div>
        <button
          onClick={openAddModal}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Add Limit
        </button>
      </div>

      {limits.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-12 text-center">
          <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
            <Plus className="w-8 h-8 text-gray-400 dark:text-gray-500" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">No limits configured</h3>
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            Set daily time limits to control how much time you spend on specific sites
          </p>
          <button
            onClick={openAddModal}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Add Your First Limit
          </button>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 divide-y divide-gray-200 dark:divide-gray-700">
          {limits.map((limit) => {
            const timeSpent = getTimeSpent(limit.pattern);
            const percent = (timeSpent / limit.limitSeconds) * 100;
            const exceeded = percent >= 100;
            const approaching = percent >= 70 && percent < 100;

            return (
              <div key={limit.id} className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-gray-900 dark:text-gray-100">{limit.pattern}</span>
                      {!limit.enabled && (
                        <span className="text-xs px-2 py-0.5 bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-full">
                          Disabled
                        </span>
                      )}
                      {exceeded && limit.enabled && (
                        <span className="text-xs px-2 py-0.5 bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 rounded-full">
                          Exceeded
                        </span>
                      )}
                      {approaching && limit.enabled && !exceeded && (
                        <span className="text-xs px-2 py-0.5 bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 rounded-full">
                          Approaching
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                      <span>Limit: {formatTime(limit.limitSeconds)}/day</span>
                      <span>
                        Bypass:{' '}
                        {limit.bypassType === 'password'
                          ? 'Password'
                          : limit.bypassType === 'cooldown'
                          ? `${limit.cooldownSeconds || 30}s wait`
                          : 'None'}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleEnabled(limit)}
                      className={`relative w-10 h-6 rounded-full transition-colors ${
                        limit.enabled ? 'bg-blue-600' : 'bg-gray-300'
                      }`}
                    >
                      <div
                        className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                          limit.enabled ? 'left-5' : 'left-1'
                        }`}
                      />
                    </button>
                    <button
                      onClick={() => openEditModal(limit)}
                      className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(limit.id)}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-3 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        exceeded
                          ? 'bg-red-500'
                          : approaching
                          ? 'bg-amber-500'
                          : 'bg-green-500'
                      }`}
                      style={{ width: `${Math.min(100, percent)}%` }}
                    />
                  </div>
                  <span className="text-sm text-gray-600 dark:text-gray-400 w-24 text-right">
                    {formatTime(timeSpent)} / {formatTime(limit.limitSeconds)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold">
                {editingLimit ? 'Edit Limit' : 'Add Daily Limit'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Domain */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Domain</label>
                <input
                  type="text"
                  value={formData.pattern}
                  onChange={(e) => setFormData({ ...formData, pattern: e.target.value })}
                  placeholder="e.g., twitter.com"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Time Limit */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Daily Limit</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    value={formData.limitHours}
                    onChange={(e) =>
                      setFormData({ ...formData, limitHours: parseInt(e.target.value) || 0 })
                    }
                    className="w-20 px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-gray-500 dark:text-gray-400">hours</span>
                  <input
                    type="number"
                    min="0"
                    max="59"
                    value={formData.limitMinutes}
                    onChange={(e) =>
                      setFormData({ ...formData, limitMinutes: parseInt(e.target.value) || 0 })
                    }
                    className="w-20 px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-gray-500 dark:text-gray-400">minutes</span>
                </div>
              </div>

              {/* Bypass Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Bypass Method
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                  How can you continue after reaching the limit?
                </p>
                <div className="space-y-2">
                  <label className="flex items-center gap-3 p-3 border border-gray-200 dark:border-gray-600 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700">
                    <input
                      type="radio"
                      name="bypassType"
                      checked={formData.bypassType === 'cooldown'}
                      onChange={() => setFormData({ ...formData, bypassType: 'cooldown' })}
                      className="w-4 h-4 text-blue-600"
                    />
                    <div>
                      <span className="text-sm font-medium">Wait to continue</span>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Must wait before bypassing</p>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 p-3 border border-gray-200 dark:border-gray-600 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700">
                    <input
                      type="radio"
                      name="bypassType"
                      checked={formData.bypassType === 'password'}
                      onChange={() => setFormData({ ...formData, bypassType: 'password' })}
                      className="w-4 h-4 text-blue-600"
                    />
                    <div>
                      <span className="text-sm font-medium">Password required</span>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Enter password to continue</p>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 p-3 border border-gray-200 dark:border-gray-600 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700">
                    <input
                      type="radio"
                      name="bypassType"
                      checked={formData.bypassType === 'none'}
                      onChange={() => setFormData({ ...formData, bypassType: 'none' })}
                      className="w-4 h-4 text-blue-600"
                    />
                    <div>
                      <span className="text-sm font-medium">No bypass</span>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Blocked until midnight</p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Cooldown Duration */}
              {formData.bypassType === 'cooldown' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Wait Time (seconds)
                  </label>
                  <input
                    type="number"
                    min="10"
                    max="300"
                    value={formData.cooldownSeconds}
                    onChange={(e) =>
                      setFormData({ ...formData, cooldownSeconds: parseInt(e.target.value) || 30 })
                    }
                    className="w-24 px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}

              {/* Password */}
              {formData.bypassType === 'password' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {editingLimit ? 'New Password (leave empty to keep current)' : 'Password'}
                  </label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="Enter password"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}

              {error && <p className="text-sm text-red-600">{error}</p>}

              <div className="flex justify-end gap-3 pt-4">
                <button
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Check className="w-4 h-4" />
                  {editingLimit ? 'Save Changes' : 'Add Limit'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
