import TrackingPrivacySettings from '../components/TrackingPrivacySettings';
import { useEffect, useState } from 'react';
import { Trash2, AlertTriangle, Sun, Moon, Monitor, Lock, GitBranch, ShieldCheck, Download, Upload } from 'lucide-react';
import QRCode from 'react-qr-code';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Settings as SettingsType } from '../../shared/types';
import { hashPassword } from '../../shared/storage';
import { isEncryptedBackup } from '../../shared/backup';
import { applyTheme } from '../../shared/theme';
import { buildOtpAuthUri, generateTotpSecret, verifyTotpCode } from '../../shared/totp';
import { assertRuntimeMutationSucceeded } from '../../shared/runtimeMessages';
import DashboardPageHeader from '../components/DashboardPageHeader';
import { useLockdown } from '../hooks/useLockdown';

export default function SettingsPage() {
  const { refreshStatus, withLockdownCheck } = useLockdown();
  const [settings, setSettings] = useState<SettingsType | null>(null);
  const [loading, setLoading] = useState(true);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [totpSecretDraft, setTotpSecretDraft] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [totpError, setTotpError] = useState('');
  const [backupAction, setBackupAction] = useState<'export' | 'import' | null>(null);
  const [backupPassword, setBackupPassword] = useState('');
  const [confirmBackupPassword, setConfirmBackupPassword] = useState('');
  const [backupError, setBackupError] = useState('');
  const [backupBusy, setBackupBusy] = useState(false);
  const [pendingImport, setPendingImport] = useState<unknown>(null);
  const [storageUsage, setStorageUsage] = useState<{ bytesInUse: number; quotaBytes: number } | null>(null);

  useEffect(() => {
    loadSettings();
    void loadStorageUsage();
  }, []);

  async function loadStorageUsage() {
    try {
      const result = await chrome.runtime.sendMessage({ type: 'GET_STORAGE_USAGE' });
      if (typeof result?.bytesInUse === 'number' && typeof result?.quotaBytes === 'number') {
        setStorageUsage(result);
      }
    } catch (error) {
      console.error('Failed to load storage usage:', error);
    }
  }

  function formatStorageSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  async function loadSettings() {
    try {
      const result = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' });
      setSettings(result);
      applyTheme(result.theme, result.colorTheme || 'monochrome');
    } catch (err) {
      console.error('Failed to load settings:', err);
    } finally {
      setLoading(false);
    }
  }

  async function updateSettings(patch: Partial<SettingsType>) {
    setSettings((current) => current ? { ...current, ...patch } : current);

    try {
      const result = await chrome.runtime.sendMessage({
        type: 'UPDATE_SETTINGS',
        payload: patch,
      });
      assertRuntimeMutationSucceeded(result, 'Failed to save settings');
    } catch (err) {
      console.error('Failed to save settings:', err);
      await loadSettings();
      throw err;
    }
  }

  async function setMasterPassword() {
    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match');
      return;
    }
    if (!newPassword) {
      setPasswordError('Enter a password');
      return;
    }

    try {
      const passwordHash = await hashPassword(newPassword);

      await withLockdownCheck(async () => {
        await updateSettings({ passwordHash });
        await refreshStatus();

        setNewPassword('');
        setConfirmPassword('');
        setPasswordError('');
        alert('Master password set successfully!');
        await loadSettings();
      });
    } catch (err) {
      console.error('Failed to set password:', err);
      setPasswordError('Failed to set password');
    }
  }

  function beginTotpSetup() {
    setTotpSecretDraft(generateTotpSecret());
    setTotpCode('');
    setTotpError('');
  }

  async function confirmTotpSetup() {
    if (!totpSecretDraft) return;

    const valid = await verifyTotpCode(totpSecretDraft, totpCode);
    if (!valid) {
      setTotpError('Invalid code. Check the authenticator entry and try again.');
      return;
    }

    await withLockdownCheck(async () => {
      await updateSettings({ lockdownTotpSecret: totpSecretDraft });
      await refreshStatus();
      setTotpSecretDraft('');
      setTotpCode('');
      setTotpError('');
    });
  }

  async function clearTotpSetup() {
    await withLockdownCheck(async () => {
      await updateSettings({
        lockdownTotpSecret: undefined,
        lockdownAuthMethod: settings?.lockdownAuthMethod === 'totp' ? 'password' : settings?.lockdownAuthMethod,
      });
      await refreshStatus();
      await loadSettings();
      setTotpSecretDraft('');
      setTotpCode('');
      setTotpError('');
    });
  }

  async function clearAllData() {
    if (!confirm('Are you sure you want to clear ALL data? This includes all tracking history and blocked sites. This cannot be undone!')) {
      return;
    }

    try {
      await withLockdownCheck(async () => {
        const result = await chrome.runtime.sendMessage({ type: 'CLEAR_ALL_DATA' });
        if (!result?.success) throw new Error(result?.error || 'Failed to clear data');
        alert('All data cleared. The extension will reload.');
        window.location.reload();
      });
    } catch (err) {
      console.error('Failed to clear data:', err);
    }
  }

  function beginExport() {
    setBackupAction('export');
    setBackupPassword('');
    setConfirmBackupPassword('');
    setBackupError('');
  }

  async function exportData() {
    if (!backupPassword) {
      setBackupError('Enter a backup password');
      return;
    }
    if (backupPassword !== confirmBackupPassword) {
      setBackupError('Backup passwords do not match');
      return;
    }

    setBackupBusy(true);
    setBackupError('');
    try {
      const result = await chrome.runtime.sendMessage({
        type: 'EXPORT_DATA',
        payload: { password: backupPassword },
      });
      if (!result?.success || !result.backup) {
        throw new Error(result?.error || 'Failed to create backup');
      }
      const blob = new Blob([JSON.stringify(result.backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const now = new Date();
      const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      a.download = `browserutils-backup-${dateStr}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setBackupAction(null);
    } catch (err) {
      console.error('Failed to export data:', err);
      setBackupError(err instanceof Error ? err.message : 'Failed to create backup');
    } finally {
      setBackupBusy(false);
    }
  }

  async function prepareImport(file: File) {
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!data || Array.isArray(data) || typeof data !== 'object') {
        throw new Error('Invalid import data');
      }
      setPendingImport(data);
      setBackupPassword('');
      setConfirmBackupPassword('');
      setBackupError('');
      setBackupAction('import');
    } catch (err) {
      console.error('Failed to read backup:', err);
      alert('Failed to read backup. Make sure the file is valid JSON.');
    }
  }

  async function importData() {
    if (!pendingImport) return;
    if (isEncryptedBackup(pendingImport) && !backupPassword) {
      setBackupError('Enter the backup password');
      return;
    }

    setBackupBusy(true);
    setBackupError('');
    try {
      await withLockdownCheck(async () => {
        const result = await chrome.runtime.sendMessage({
          type: 'IMPORT_DATA',
          payload: { backup: pendingImport, password: backupPassword },
        });
        if (!result?.success) throw new Error(result?.error || 'Failed to import data');
        window.location.reload();
      });
    } catch (err) {
      console.error('Failed to import data:', err);
      setBackupError(err instanceof Error ? err.message : 'Failed to import backup');
    } finally {
      setBackupBusy(false);
    }
  }

  if (loading || !settings) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const hasLockdownMethod = !!settings.passwordHash || !!settings.lockdownTotpSecret;
  const otpauthUri = totpSecretDraft ? buildOtpAuthUri(totpSecretDraft, 'BrowserUtils', 'Lockdown') : '';

  return (
    <div>
      <DashboardPageHeader title="Settings" meta="BrowserUtils preferences" />

      {/* Appearance */}
      <div className="mb-6 border bg-card p-6 shadow-[var(--shadow-card)]">
        <h2 className="text-lg font-semibold mb-4">Appearance</h2>
        <div className="flex flex-col gap-4">
          <div>
            <label className="block font-medium mb-2">Theme</label>
            <div className="flex flex-wrap gap-2">
              {[
                { value: 'light', label: 'Light', icon: Sun },
                { value: 'dark', label: 'Dark', icon: Moon },
                { value: 'system', label: 'System', icon: Monitor },
              ].map(({ value, label, icon: Icon }) => (
                <Button
                  key={value}
                  onClick={() => {
                    const theme = value as SettingsType['theme'];
                    applyTheme(theme, settings.colorTheme || 'monochrome');
                    void updateSettings({ theme });
                  }}
                  variant={settings.theme === value ? 'default' : 'outline'}
                  aria-pressed={settings.theme === value}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </Button>
              ))}
            </div>
          </div>

          <div>
            <label className="block font-medium mb-2">Color Theme</label>
            <p className="mb-2 text-sm text-muted-foreground">
              Choose the extension accent palette.
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {[
                { value: 'monochrome', label: 'Monochrome', swatch: 'bg-zinc-900 dark:bg-zinc-100' },
                { value: 'blue', label: 'Classic Blue', swatch: 'bg-blue-600' },
              ].map(({ value, label, swatch }) => {
                const colorTheme = value as NonNullable<SettingsType['colorTheme']>;
                const selected = (settings.colorTheme || 'monochrome') === colorTheme;
                return (
                  <Button
                    key={value}
                    type="button"
                    variant={selected ? 'default' : 'outline'}
                    aria-pressed={selected}
                    onClick={() => {
                      applyTheme(settings.theme, colorTheme);
                      void updateSettings({ colorTheme });
                    }}
                    className="justify-start"
                  >
                    <span className={`size-3 ${swatch}`} />
                    {label}
                  </Button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* General Settings */}
      <div className="mb-6 border bg-card p-6 shadow-[var(--shadow-card)]">
        <h2 className="text-lg font-semibold mb-4">General</h2>
        <div className="flex flex-col gap-4">
          <label className="flex items-center justify-between gap-4">
            <div>
              <span className="font-medium">Enable Tracking</span>
              <p className="text-sm text-muted-foreground">Record time spent on websites</p>
            </div>
            <Input
              type="checkbox"
              checked={settings.trackingEnabled}
              onChange={(e) => void updateSettings({ trackingEnabled: e.target.checked })}
              className="size-5 border-border text-primary focus:ring-ring"
            />
          </label>

          <label className="flex items-center justify-between gap-4">
            <div>
              <span className="font-medium">Enable Blocking</span>
              <p className="text-sm text-muted-foreground">Block access to configured sites</p>
            </div>
            <Input
              type="checkbox"
              checked={settings.blockingEnabled}
              onChange={async (e) => {
                const enabled = e.target.checked;
                const applyChange = () => updateSettings({ blockingEnabled: enabled });
                if (enabled) {
                  await applyChange();
                } else {
                  await withLockdownCheck(applyChange);
                }
              }}
              className="size-5 border-border text-primary focus:ring-ring"
            />
          </label>

          <label className="flex items-center justify-between gap-4">
            <div>
              <span className="font-medium">YouTube Channel Tracking</span>
              <p className="text-sm text-muted-foreground">Track which YouTube channels you watch</p>
            </div>
            <Input
              type="checkbox"
              checked={settings.youtubeTrackingEnabled}
              onChange={(e) => void updateSettings({ youtubeTrackingEnabled: e.target.checked })}
              className="size-5 border-border text-primary focus:ring-ring"
            />
          </label>

          <div>
            <label className="block font-medium mb-1">Data Retention</label>
            <p className="text-sm text-muted-foreground mb-2">How long to keep tracking history</p>
            <select
              value={settings.retentionDays}
              onChange={(e) => void updateSettings({ retentionDays: parseInt(e.target.value) })}
              className="w-full rounded-md border border-input bg-background px-3 py-2 focus:border-ring focus:ring-2 focus:ring-ring/45"
            >
              <option value={7}>7 days</option>
              <option value={14}>14 days</option>
              <option value={30}>30 days</option>
              <option value={60}>60 days</option>
              <option value={90}>90 days</option>
            </select>
            {storageUsage && (
              <div className="mt-3">
                <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                  <span>Local storage</span>
                  <span className="tabular-nums">
                    {formatStorageSize(storageUsage.bytesInUse)} of {formatStorageSize(storageUsage.quotaBytes)}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-sm bg-muted">
                  <div
                    className="h-full bg-primary"
                    style={{ width: `${Math.min(100, (storageUsage.bytesInUse / storageUsage.quotaBytes) * 100)}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block font-medium mb-1">Idle Timeout</label>
            <p className="text-sm text-muted-foreground mb-2">
              Stop tracking after this many seconds of inactivity. Set to 0 to disable.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Input
                type="number"
                value={settings.idleThreshold}
                onChange={(e) => void updateSettings({ idleThreshold: parseInt(e.target.value) || 0 })}
                min={0}
                max={3600}
                step={15}
                className="w-32 rounded-md border border-input bg-background px-3 py-2 focus:border-ring focus:ring-2 focus:ring-ring/45"
              />
              <span className="text-sm text-muted-foreground">seconds</span>
              <div className="ml-auto flex flex-wrap gap-2">
                {[30, 60, 120, 300].map((val) => (
                  <Button
                    key={val}
                    type="button"
                    onClick={() => void updateSettings({ idleThreshold: val })}
                    className={`px-2 py-1 text-xs ${
                      settings.idleThreshold === val
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground hover:bg-accent '
                    }`}
                  >
                    {val < 60 ? `${val}s` : `${val / 60}m`}
                  </Button>
                ))}
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Minimum: 15 seconds (Chrome API limit). Tracking also pauses when windows are minimized.
            </p>
          </div>
        </div>

      </div>

      <TrackingPrivacySettings settings={settings} onSave={updateSettings} />

      {/* Browser Utilities */}
      <div className="mb-6 border bg-card p-6 shadow-[var(--shadow-card)]">
        <div className="flex flex-col gap-4">
          <label className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">Paste Anyway</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Allow pasting into text fields on sites that block paste events.
              </p>
            </div>
            <Input
              type="checkbox"
              checked={settings.forcePasteEnabled}
              onChange={(e) => void updateSettings({ forcePasteEnabled: e.target.checked })}
              className="size-5 shrink-0 border-border text-primary focus:ring-ring"
            />
          </label>

          <label className="flex items-center justify-between gap-4 border-t pt-4">
            <div>
              <h2 className="text-lg font-semibold">Video downloads</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Show a download button for downloadable Blob videos and Reddit videos. DRM video is ignored.
              </p>
            </div>
            <Input
              type="checkbox"
              checked={settings.blobVideoDownloaderEnabled}
              onChange={(e) => void updateSettings({ blobVideoDownloaderEnabled: e.target.checked })}
              className="size-5 shrink-0 border-border text-primary focus:ring-ring"
            />
          </label>
        </div>
      </div>

      {/* Master Password */}
      <div className="mb-6 border bg-card p-6 shadow-[var(--shadow-card)]">
        <h2 className="text-lg font-semibold mb-4">Master Password</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Set a master password for unlocking password-protected blocked sites.
          {settings.passwordHash && (
            <span className="ml-1 text-success">(Currently set)</span>
          )}
        </p>

        <div className="flex flex-col gap-3">
          <Input
            type="password"
            value={newPassword}
            onChange={(e) => {
              setNewPassword(e.target.value);
              setPasswordError('');
            }}
            placeholder="New password"
            className="w-full rounded-md border border-input bg-background px-3 py-2 focus:border-ring focus:ring-2 focus:ring-ring/45"
          />
          <Input
            type="password"
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value);
              setPasswordError('');
            }}
            placeholder="Confirm password"
            className="w-full rounded-md border border-input bg-background px-3 py-2 focus:border-ring focus:ring-2 focus:ring-ring/45"
          />
          {passwordError && (
            <p className="text-sm text-danger">{passwordError}</p>
          )}
          <Button
            onClick={setMasterPassword}
            className="bg-muted hover:bg-accent text-foreground px-4 py-2 rounded-lg transition-colors"
          >
            {settings.passwordHash ? 'Update Password' : 'Set Password'}
          </Button>
        </div>

        {/* Lockdown Mode */}
        <div className="mt-6 pt-6 border-t border-border ">
          <div className="mb-4">
            <span className="font-medium">Lockdown Authentication Method</span>
            <p className="text-sm text-muted-foreground mt-1">
              Choose the one method Lockdown Mode should require for protected actions.
            </p>
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Button
                type="button"
                disabled={!settings.passwordHash}
                onClick={async () => {
                  await withLockdownCheck(async () => {
                    await updateSettings({ lockdownAuthMethod: 'password' });
                    await refreshStatus();
                  });
                }}
                className={`flex items-center gap-2 p-3 border rounded-lg transition-colors ${
                  settings.lockdownAuthMethod === 'password'
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border '
                } ${!settings.passwordHash ? 'opacity-50 cursor-not-allowed' : 'hover:bg-muted '}`}
              >
                <Lock className="w-4 h-4" />
                Master password
              </Button>
              <Button
                type="button"
                disabled={!settings.lockdownTotpSecret}
                onClick={async () => {
                  await withLockdownCheck(async () => {
                    await updateSettings({ lockdownAuthMethod: 'totp' });
                    await refreshStatus();
                  });
                }}
                className={`flex items-center gap-2 p-3 border rounded-lg transition-colors ${
                  settings.lockdownAuthMethod === 'totp'
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border '
                } ${!settings.lockdownTotpSecret ? 'opacity-50 cursor-not-allowed' : 'hover:bg-muted '}`}
              >
                <ShieldCheck className="w-4 h-4" />
                Authenticator app
              </Button>
            </div>
          </div>

          <label className={`flex items-center justify-between ${!hasLockdownMethod ? 'opacity-50' : ''}`}>
            <div className="flex items-start gap-3">
              <Lock className="w-5 h-5 text-primary mt-0.5" />
              <div>
                <span className="font-medium">Lockdown Mode</span>
                <p className="text-sm text-muted-foreground">
                  Require the selected Lockdown authentication method to disable blocking, remove sites, or disable limits.
                  {!hasLockdownMethod && (
                    <span className="block text-warning mt-1">
                      Set up a master password or authenticator app first to enable this feature.
                    </span>
                  )}
                </p>
              </div>
            </div>
            <Input
              type="checkbox"
              checked={settings.lockdownEnabled ?? false}
              onChange={async (e) => {
                const newValue = e.target.checked;
                const applyChange = async () => {
                  await updateSettings({ lockdownEnabled: newValue });
                  await refreshStatus();
                };
                if (newValue) {
                  await applyChange();
                } else {
                  await withLockdownCheck(applyChange);
                }
              }}
              disabled={!hasLockdownMethod}
              className="size-5 border-border text-primary focus:ring-ring disabled:cursor-not-allowed"
            />
          </label>
        </div>
      </div>

      <div className="mb-6 border bg-card p-6 shadow-[var(--shadow-card)]">
        <h2 className="text-lg font-semibold mb-4">Authenticator App</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Set up a TOTP authenticator app as an alternative Lockdown authentication method.
          {settings.lockdownTotpSecret && (
            <span className="ml-1 text-success">(Currently set)</span>
          )}
        </p>

        {!totpSecretDraft ? (
          <div className="flex flex-wrap items-center gap-3">
            <Button
              onClick={beginTotpSetup}
              className="bg-muted hover:bg-accent text-foreground px-4 py-2 rounded-lg transition-colors"
            >
              {settings.lockdownTotpSecret ? 'Replace Authenticator Setup' : 'Set Up Authenticator'}
            </Button>
            {settings.lockdownTotpSecret && (
              <Button
                onClick={clearTotpSetup}
                className="px-4 py-2 text-danger hover:bg-danger-subtle rounded-lg transition-colors"
              >
                Remove Authenticator
              </Button>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="rounded-lg bg-muted p-4">
              <p className="text-sm text-muted-foreground mb-4">
                Scan this QR code with your authenticator app, then enter the 6-digit code to confirm setup.
              </p>
              <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
                <div className="rounded-lg bg-white p-4 shadow-sm">
                  <QRCode
                    value={otpauthUri}
                    size={160}
                    bgColor="#ffffff"
                    fgColor="#111827"
                    level="M"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">
                    Backup setup key
                  </p>
                  <div className="font-mono text-sm break-all text-foreground">
                    {totpSecretDraft}
                  </div>
                  <p className="text-xs text-muted-foreground mt-3">
                    Use the setup key only if your authenticator app cannot scan QR codes.
                  </p>
                </div>
              </div>
            </div>

            <Input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={totpCode}
              onChange={(e) => {
                setTotpCode(e.target.value.replace(/\D+/g, '').slice(0, 6));
                setTotpError('');
              }}
              placeholder="Enter 6-digit code to confirm"
              className="w-full rounded-md border border-input bg-background px-3 py-2 focus:border-ring focus:ring-2 focus:ring-ring/45"
            />
            {totpError && (
              <p className="text-sm text-danger">{totpError}</p>
            )}

            <div className="flex flex-wrap gap-3">
              <Button
                onClick={confirmTotpSetup}
                className="rounded-md bg-primary px-4 py-2 text-primary-foreground transition-colors hover:bg-primary/85"
              >
                Confirm Authenticator
              </Button>
              <Button
                onClick={() => {
                  setTotpSecretDraft('');
                  setTotpCode('');
                  setTotpError('');
                }}
                className="px-4 py-2 text-foreground hover:bg-muted rounded-lg transition-colors"
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Data Management */}
      <div className="mb-6 border bg-card p-6 shadow-[var(--shadow-card)]">
        <h2 className="text-lg font-semibold mb-4">Data Management</h2>

        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <Button
              onClick={beginExport}
              variant="secondary"
            >
              <Download data-icon="inline-start" />
              Export Data
            </Button>
            <Button asChild variant="secondary">
              <label className="cursor-pointer">
                <Upload data-icon="inline-start" />
                Import Data
                <Input
                  type="file"
                  accept=".json"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void prepareImport(file);
                    e.target.value = '';
                  }}
                  className="hidden"
                />
              </label>
            </Button>
          </div>

          <div className="pt-4 border-t border-border ">
            <div className="flex items-start gap-3 p-4 bg-danger-subtle rounded-lg">
              <AlertTriangle className="w-5 h-5 text-danger flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-medium text-danger ">Danger Zone</h3>
                <p className="text-sm text-danger mb-3">
                  This will permanently delete all your data including tracking history, blocked sites, and settings.
                </p>
                <Button
                  onClick={clearAllData}
                  variant="destructive"
                >
                  <Trash2 data-icon="inline-start" />
                  Clear All Data
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* About */}
      <div className="border bg-card p-6 shadow-[var(--shadow-card)]">
        <h2 className="text-lg font-semibold mb-4">About</h2>
        <a
          href="https://github.com/ericfzhu/browserutils"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-muted-foreground transition-colors hover:text-primary"
        >
          <GitBranch className="w-5 h-5" />
          View on GitHub
        </a>
      </div>

      <Dialog open={backupAction !== null} onOpenChange={(open) => !open && setBackupAction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{backupAction === 'export' ? 'Create encrypted backup' : 'Restore backup'}</DialogTitle>
            <DialogDescription>
              {backupAction === 'export'
                ? 'This password encrypts your complete backup, including protected rules and authenticator settings.'
                : isEncryptedBackup(pendingImport)
                  ? 'Enter the password used when this backup was created.'
                  : 'This is a legacy unencrypted export. Review the file source before restoring it.'}
            </DialogDescription>
          </DialogHeader>

          {(backupAction === 'export' || isEncryptedBackup(pendingImport)) && (
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="backup-password">Backup password</Label>
                <Input
                  id="backup-password"
                  type="password"
                  autoFocus
                  value={backupPassword}
                  onChange={(event) => setBackupPassword(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && backupAction === 'import') void importData();
                  }}
                />
              </div>
              {backupAction === 'export' && (
                <div className="grid gap-2">
                  <Label htmlFor="backup-password-confirm">Confirm backup password</Label>
                  <Input
                    id="backup-password-confirm"
                    type="password"
                    value={confirmBackupPassword}
                    onChange={(event) => setConfirmBackupPassword(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') void exportData();
                    }}
                  />
                </div>
              )}
            </div>
          )}

          {backupError && <p className="text-sm text-destructive">{backupError}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setBackupAction(null)} disabled={backupBusy}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void (backupAction === 'export' ? exportData() : importData())}
              disabled={backupBusy}
            >
              {backupBusy ? 'Working...' : backupAction === 'export' ? 'Download Backup' : 'Restore Backup'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
