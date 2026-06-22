import { useEffect, useState } from 'react';
import { Clock, Shield, ShieldOff, BarChart3, Settings, Lock, Focus, X } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { BlockedSite, BlockedSiteFolder, DailyStats, Settings as SettingsType, LockdownStatus } from '../shared/types';

function formatTime(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`;
  }
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
  const [now, setNow] = useState(Date.now());
  const [activeFocusTargets, setActiveFocusTargets] = useState<Array<{
    id: string;
    label: string;
    typeLabel: 'All' | 'Folder' | 'Website';
    focusUntil: number;
  }>>([]);

  // Lockdown state
  const [lockdownStatus, setLockdownStatus] = useState<LockdownStatus | null>(null);
  const [showPasswordInput, setShowPasswordInput] = useState(false);
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authenticating, setAuthenticating] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  function getActiveFocusTargets(nextSettings: SettingsType, folders: BlockedSiteFolder[], sites: BlockedSite[]) {
    const currentTime = Date.now();
    const targets: Array<{
      id: string;
      label: string;
      typeLabel: 'All' | 'Folder' | 'Website';
      focusUntil: number;
    }> = [];

    if (nextSettings.globalFocusUntil && nextSettings.globalFocusUntil > currentTime) {
      targets.push({
        id: 'global',
        label: 'All blocked sites',
        typeLabel: 'All',
        focusUntil: nextSettings.globalFocusUntil,
      });
    }

    for (const folder of folders) {
      if (!folder.focusUntil || folder.focusUntil <= currentTime) continue;

      const folderSites = sites.filter((site) => site.folderId === folder.id);
      const singleSite = folderSites.length === 1 ? folderSites[0] : null;

      targets.push({
        id: folder.id,
        label: singleSite ? singleSite.pattern : folder.name,
        typeLabel: singleSite ? 'Website' : 'Folder',
        focusUntil: folder.focusUntil,
      });
    }

    return targets.sort((a, b) => a.focusUntil - b.focusUntil);
  }

  async function loadData() {
    try {
      const now = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const [statsRes, settingsRes, lockdownRes, foldersRes, sitesRes] = await Promise.all([
        chrome.runtime.sendMessage({ type: 'GET_STATS', payload: { date: today } }),
        chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }),
        chrome.runtime.sendMessage({ type: 'LOCKDOWN_GET_STATUS' }),
        chrome.runtime.sendMessage({ type: 'GET_BLOCKED_SITE_FOLDERS' }),
        chrome.runtime.sendMessage({ type: 'GET_BLOCKED_SITES' }),
      ]);
      setStats(statsRes);
      setSettings(settingsRes);
      setLockdownStatus(lockdownRes);
      setActiveFocusTargets(getActiveFocusTargets(settingsRes, foldersRes, sitesRes));
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
      <div className="flex w-80 items-center justify-center bg-background p-4">
        <div className="size-8 animate-spin rounded-full border-b-2 border-primary"></div>
      </div>
    );
  }

  const topSites = stats
    ? Object.entries(stats.sites)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
    : [];
  const visibleFocusTargets = activeFocusTargets.filter((target) => target.focusUntil > now);

  return (
      <div className="w-80 bg-background text-foreground">
      {/* Header */}
      <div className="bg-primary p-4 text-primary-foreground shadow-[var(--shadow-border)]">
        <div className="flex items-center justify-between">
          <h1
            className="text-lg font-semibold cursor-default relative overflow-hidden"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
          >
            <span
              className={`inline-block transition-[transform,opacity] duration-300 ease-out ${
                isHovered ? 'opacity-0 -translate-y-full' : 'opacity-100 translate-y-0'
              }`}
            >
              BrowserUtils
            </span>
            <span
              className={`absolute left-0 transition-[transform,opacity] duration-300 ease-out ${
                isHovered ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-full'
              }`}
            >
              Boyoung😘Utils
            </span>
          </h1>
          <Button
            onClick={toggleBlocking}
            variant={settings?.blockingEnabled ? 'secondary' : 'destructive'}
            size="icon"
            title={settings?.blockingEnabled ? 'Blocking enabled' : 'Blocking disabled'}
          >
            <span className="relative grid size-4 place-items-center">
              <Shield
                className={`absolute inset-0 transition-[opacity,filter,transform] duration-300 ease-[cubic-bezier(0.2,0,0,1)] ${
                  settings?.blockingEnabled
                    ? 'scale-100 opacity-100 blur-none'
                    : 'scale-[0.25] opacity-0 blur-[4px]'
                }`}
              />
              <ShieldOff
                className={`absolute inset-0 transition-[opacity,filter,transform] duration-300 ease-[cubic-bezier(0.2,0,0,1)] ${
                  settings?.blockingEnabled
                    ? 'scale-[0.25] opacity-0 blur-[4px]'
                    : 'scale-100 opacity-100 blur-none'
                }`}
              />
            </span>
          </Button>
        </div>

        {/* Inline Password Input */}
        {showPasswordInput && (
          <form onSubmit={handlePasswordSubmit} className="mt-3 flex flex-col gap-2">
            <div className="flex items-center gap-2 text-xs text-white/80">
              <Lock className="size-3" />
              <span>Enter master password to continue</span>
            </div>
            <div className="flex gap-2">
              <Input
                type="password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setAuthError(''); }}
                placeholder="Master password"
                className="h-9 flex-1 border-white/20 bg-white/10 text-primary-foreground placeholder:text-white/50"
                aria-invalid={!!authError}
                autoFocus
              />
              <Button
                type="submit"
                disabled={authenticating || !password}
                variant="secondary"
                size="sm"
              >
                {authenticating ? '...' : 'OK'}
              </Button>
              <Button
                type="button"
                onClick={() => { setShowPasswordInput(false); setPassword(''); setAuthError(''); }}
                variant="ghost"
                size="sm"
                title="Cancel"
              >
                <X />
              </Button>
            </div>
            {authError && (
              <Alert variant="destructive">
                <AlertDescription>{authError}</AlertDescription>
              </Alert>
            )}
          </form>
        )}
      </div>

      {visibleFocusTargets.length > 0 && (
        <div className="bg-muted/50 p-4 shadow-[var(--shadow-border)]">
          <div className="flex items-center gap-2 mb-3">
            <Focus className="size-4 text-primary" />
            <h2 className="text-sm font-medium">Focus Mode</h2>
          </div>
          <div className="flex flex-col gap-2">
            {visibleFocusTargets.map((target) => (
              <Card key={target.id} size="sm">
                <CardContent className="flex items-center justify-between gap-3 p-3">
                <div className="min-w-0">
                  <Badge variant="secondary" className="mb-1 text-[10px] uppercase tracking-wide">
                    {target.typeLabel}
                  </Badge>
                  <div className="truncate text-sm font-medium">
                    {target.label}
                  </div>
                </div>
                <div className="whitespace-nowrap text-sm font-semibold text-primary tabular-nums">
                  {formatTime(Math.max(0, Math.ceil((target.focusUntil - now) / 1000)))}
                </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Today's Stats */}
      <div className="p-4 shadow-[var(--shadow-border)]">
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">Today</h2>
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center">
            <div className="flex items-center justify-center mb-1">
              <Clock className="size-4 text-primary" />
            </div>
            <div className="text-lg font-semibold tabular-nums">
              {formatTime(stats?.totalTime || 0)}
            </div>
            <div className="text-xs text-muted-foreground">Time</div>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center mb-1">
              <BarChart3 className="size-4 text-primary" />
            </div>
            <div className="text-lg font-semibold tabular-nums">{stats?.visits || 0}</div>
            <div className="text-xs text-muted-foreground">Visits</div>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center mb-1">
              <Shield className="size-4 text-destructive" />
            </div>
            <div className="text-lg font-semibold tabular-nums">{stats?.blockedAttempts || 0}</div>
            <div className="text-xs text-muted-foreground">Blocked</div>
          </div>
        </div>
      </div>

      {/* Top Sites */}
      {topSites.length > 0 && (
        <div className="p-4 shadow-[var(--shadow-border)]">
          <h2 className="mb-2 text-sm font-medium text-muted-foreground">Top Sites</h2>
          <div className="flex flex-col gap-2">
            {topSites.map(([domain, time]) => (
              <div key={domain} className="flex items-center justify-between">
                <span className="text-sm truncate flex-1">{domain}</span>
                <span className="ml-2 text-sm text-muted-foreground tabular-nums">{formatTime(time)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="p-4">
        <Button
          onClick={openDashboard}
          variant="secondary"
          className="w-full"
        >
          <Settings data-icon="inline-start" />
          Open Dashboard
        </Button>
      </div>
    </div>
  );
}
