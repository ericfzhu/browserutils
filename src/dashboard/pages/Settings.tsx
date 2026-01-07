import { useEffect, useState } from 'react';
import { Save, Trash2, AlertTriangle, Sun, Moon, Monitor } from 'lucide-react';
import { Settings as SettingsType } from '../../shared/types';
import { applyTheme } from '../../shared/theme';

export default function SettingsPage() {
  const [settings, setSettings] = useState<SettingsType | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    try {
      const result = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' });
      setSettings(result);
    } catch (err) {
      console.error('Failed to load settings:', err);
    } finally {
      setLoading(false);
    }
  }

  async function saveSettings() {
    if (!settings) return;
    setSaving(true);
    try {
      await chrome.runtime.sendMessage({
        type: 'UPDATE_SETTINGS',
        payload: settings,
      });
    } catch (err) {
      console.error('Failed to save settings:', err);
    } finally {
      setSaving(false);
    }
  }

  async function setMasterPassword() {
    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match');
      return;
    }
    if (newPassword.length < 4) {
      setPasswordError('Password must be at least 4 characters');
      return;
    }

    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(newPassword);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const passwordHash = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

      await chrome.runtime.sendMessage({
        type: 'UPDATE_SETTINGS',
        payload: { passwordHash },
      });

      setNewPassword('');
      setConfirmPassword('');
      setPasswordError('');
      alert('Master password set successfully!');
    } catch (err) {
      console.error('Failed to set password:', err);
      setPasswordError('Failed to set password');
    }
  }

  async function clearAllData() {
    if (!confirm('Are you sure you want to clear ALL data? This includes all tracking history and blocked sites. This cannot be undone!')) {
      return;
    }

    try {
      await chrome.storage.local.clear();
      alert('All data cleared. The extension will reload.');
      window.location.reload();
    } catch (err) {
      console.error('Failed to clear data:', err);
    }
  }

  async function exportData() {
    try {
      const data = await chrome.storage.local.get(null);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const now = new Date();
      const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      a.download = `browserutils-export-${dateStr}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export data:', err);
    }
  }

  async function importData(file: File) {
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      await chrome.storage.local.set(data);
      alert('Data imported successfully!');
      window.location.reload();
    } catch (err) {
      console.error('Failed to import data:', err);
      alert('Failed to import data. Make sure the file is valid.');
    }
  }

  if (loading || !settings) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">Settings</h1>

      {/* Appearance */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Appearance</h2>
        <div className="space-y-4">
          <div>
            <label className="block font-medium mb-2">Theme</label>
            <div className="flex gap-2">
              {[
                { value: 'light', label: 'Light', icon: Sun },
                { value: 'dark', label: 'Dark', icon: Moon },
                { value: 'system', label: 'System', icon: Monitor },
              ].map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  onClick={() => {
                    const newSettings = { ...settings!, theme: value as SettingsType['theme'] };
                    setSettings(newSettings);
                    applyTheme(value as SettingsType['theme']);
                    chrome.runtime.sendMessage({
                      type: 'UPDATE_SETTINGS',
                      payload: { theme: value },
                    });
                  }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
                    settings?.theme === value
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                      : 'border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* General Settings */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">General</h2>
        <div className="space-y-4">
          <label className="flex items-center justify-between">
            <div>
              <span className="font-medium">Enable Tracking</span>
              <p className="text-sm text-gray-500">Record time spent on websites</p>
            </div>
            <input
              type="checkbox"
              checked={settings.trackingEnabled}
              onChange={(e) => setSettings({ ...settings, trackingEnabled: e.target.checked })}
              className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
          </label>

          <label className="flex items-center justify-between">
            <div>
              <span className="font-medium">Enable Blocking</span>
              <p className="text-sm text-gray-500">Block access to configured sites</p>
            </div>
            <input
              type="checkbox"
              checked={settings.blockingEnabled}
              onChange={(e) => setSettings({ ...settings, blockingEnabled: e.target.checked })}
              className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
          </label>

          <label className="flex items-center justify-between">
            <div>
              <span className="font-medium">YouTube Channel Tracking</span>
              <p className="text-sm text-gray-500">Track which YouTube channels you watch</p>
            </div>
            <input
              type="checkbox"
              checked={settings.youtubeTrackingEnabled}
              onChange={(e) => setSettings({ ...settings, youtubeTrackingEnabled: e.target.checked })}
              className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
          </label>

          <div>
            <label className="block font-medium mb-1">Data Retention</label>
            <p className="text-sm text-gray-500 mb-2">How long to keep tracking history</p>
            <select
              value={settings.retentionDays}
              onChange={(e) => setSettings({ ...settings, retentionDays: parseInt(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value={7}>7 days</option>
              <option value={14}>14 days</option>
              <option value={30}>30 days</option>
              <option value={60}>60 days</option>
              <option value={90}>90 days</option>
            </select>
          </div>

          <div>
            <label className="block font-medium mb-1">Idle Timeout</label>
            <p className="text-sm text-gray-500 mb-2">
              Stop tracking after this many seconds of inactivity. Set to 0 to disable.
            </p>
            <div className="flex items-center gap-3">
              <input
                type="number"
                value={settings.idleThreshold}
                onChange={(e) => setSettings({ ...settings, idleThreshold: parseInt(e.target.value) || 0 })}
                min={0}
                max={3600}
                step={15}
                className="w-32 px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <span className="text-sm text-gray-500">seconds</span>
              <div className="flex gap-2 ml-auto">
                {[30, 60, 120, 300].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setSettings({ ...settings, idleThreshold: val })}
                    className={`px-2 py-1 text-xs rounded ${
                      settings.idleThreshold === val
                        ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    {val < 60 ? `${val}s` : `${val / 60}m`}
                  </button>
                ))}
              </div>
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              Minimum: 15 seconds (Chrome API limit). Tracking also pauses when windows are minimized.
            </p>
          </div>
        </div>

        <button
          onClick={saveSettings}
          disabled={saving}
          className="mt-6 flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg transition-colors"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>

      {/* New Tab Settings */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">New Tab</h2>
        <div className="space-y-4">
          <div>
            <label className="block font-medium mb-1">Display Name</label>
            <p className="text-sm text-gray-500 mb-2">
              Your name for the greeting on new tabs
            </p>
            <input
              type="text"
              value={settings.displayName}
              onChange={(e) => setSettings({ ...settings, displayName: e.target.value })}
              placeholder="Enter your name"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <p className="text-sm text-gray-500">
            Quick links can be added and removed directly on the new tab page.
          </p>
        </div>

        <button
          onClick={saveSettings}
          disabled={saving}
          className="mt-6 flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg transition-colors"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>

      {/* Master Password */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Master Password</h2>
        <p className="text-sm text-gray-500 mb-4">
          Set a master password for unlocking password-protected blocked sites.
          {settings.passwordHash && (
            <span className="ml-1 text-green-600">(Currently set)</span>
          )}
        </p>

        <div className="space-y-3">
          <input
            type="password"
            value={newPassword}
            onChange={(e) => {
              setNewPassword(e.target.value);
              setPasswordError('');
            }}
            placeholder="New password"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value);
              setPasswordError('');
            }}
            placeholder="Confirm password"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          {passwordError && (
            <p className="text-sm text-red-600">{passwordError}</p>
          )}
          <button
            onClick={setMasterPassword}
            className="bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 px-4 py-2 rounded-lg transition-colors"
          >
            {settings.passwordHash ? 'Update Password' : 'Set Password'}
          </button>
        </div>
      </div>

      {/* Data Management */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-lg font-semibold mb-4">Data Management</h2>

        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <button
              onClick={exportData}
              className="bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 px-4 py-2 rounded-lg transition-colors"
            >
              Export Data
            </button>
            <label className="bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 px-4 py-2 rounded-lg transition-colors cursor-pointer">
              Import Data
              <input
                type="file"
                accept=".json"
                onChange={(e) => e.target.files?.[0] && importData(e.target.files[0])}
                className="hidden"
              />
            </label>
          </div>

          <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-medium text-red-900 dark:text-red-300">Danger Zone</h3>
                <p className="text-sm text-red-700 dark:text-red-400 mb-3">
                  This will permanently delete all your data including tracking history, blocked sites, and settings.
                </p>
                <button
                  onClick={clearAllData}
                  className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Clear All Data
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
