import { useEffect, useState } from 'react';
import { Shield, Lock, Clock, ArrowLeft, Timer } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { BlockedSite, BlockedSiteFolder, DailyLimit, DailyStats } from '../shared/types';

function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

function formatTimeRemaining(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
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

function getReturnUrl(): string | null {
  const value = new URLSearchParams(window.location.search).get('returnUrl');
  if (!value) return null;

  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.href : null;
  } catch {
    return null;
  }
}

type BlockType = 'site' | 'limit';

interface LimitInfo {
  limit: DailyLimit;
  timeSpent: number;
}

interface FocusInfo {
  label: string;
  focusUntil: number;
}

export default function App() {
  const [loading, setLoading] = useState(true);
  const [blockType, setBlockType] = useState<BlockType>('site');
  const [site, setSite] = useState<BlockedSite | null>(null);
  const [limitInfo, setLimitInfo] = useState<LimitInfo | null>(null);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [unlocking, setUnlocking] = useState(false);
  const [timerStarted, setTimerStarted] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [timerRemainingMs, setTimerRemainingMs] = useState(0);
  const [timerBlockedUntil, setTimerBlockedUntil] = useState<number | null>(null);
  const [focusInfo, setFocusInfo] = useState<FocusInfo | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  function returnToBlockedUrl() {
    const returnUrl = getReturnUrl();
    if (returnUrl) {
      window.location.href = returnUrl;
      return;
    }
    window.history.back();
  }

  // Timer countdown effect for timer-blocked sites
  useEffect(() => {
    if (site?.unlockType === 'timer' && timerBlockedUntil) {
      const updateRemaining = () => {
        const remaining = timerBlockedUntil - Date.now();
        if (remaining <= 0) {
          // Timer expired, site is now unblocked
          returnToBlockedUrl();
        } else {
          setTimerRemainingMs(remaining);
        }
      };

      updateRemaining();
      const interval = setInterval(updateRemaining, 1000);
      return () => clearInterval(interval);
    }
  }, [site, timerBlockedUntil]);

  const focusRemainingMs = focusInfo ? Math.max(0, focusInfo.focusUntil - Date.now()) : 0;

  useEffect(() => {
    if (!focusInfo) return;

    const interval = setInterval(() => {
      setFocusInfo((current) => {
        if (!current) return null;
        if (current.focusUntil <= Date.now()) {
          return null;
        }
        return { ...current };
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [focusInfo]);

  // Countdown effect for daily limit cooldown bypass
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else if (timerStarted && countdown === 0 && blockType === 'limit') {
      handleLimitBypass();
    }
  }, [countdown, timerStarted, blockType]);

  async function loadData() {
    try {
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
    } finally {
      setLoading(false);
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
      const [sites, folders, globalFocusStatus]: [BlockedSite[], BlockedSiteFolder[], { isActive?: boolean; focusUntil?: number }] = await Promise.all([
        chrome.runtime.sendMessage({ type: 'GET_BLOCKED_SITES' }),
        chrome.runtime.sendMessage({ type: 'GET_BLOCKED_SITE_FOLDERS' }),
        chrome.runtime.sendMessage({ type: 'GET_GLOBAL_FOCUS_STATUS' }),
      ]);
      const found = sites.find((s: BlockedSite) => s.id === siteId);
      let nextFocusInfo: FocusInfo | null = null;

      if (globalFocusStatus?.isActive && globalFocusStatus.focusUntil) {
        nextFocusInfo = {
          label: 'All blocked sites',
          focusUntil: globalFocusStatus.focusUntil,
        };
      } else if (found?.folderId) {
        const folder = folders.find((f: BlockedSiteFolder) => f.id === found.folderId);
        const focusStatus = await chrome.runtime.sendMessage({
          type: 'GET_FOCUS_STATUS',
          payload: { folderId: found.folderId },
        });

        if (folder && focusStatus?.isActive) {
          nextFocusInfo = {
            label: folder.name,
            focusUntil: focusStatus.focusUntil,
          };
        }
      }

      // For timer sites, get the timer status
      if (found?.unlockType === 'timer') {
        const status = await chrome.runtime.sendMessage({
          type: 'GET_TIMER_STATUS',
          payload: { id: siteId },
        });
        if (status?.isActive && status.blockedUntil) {
          setTimerBlockedUntil(status.blockedUntil);
          setTimerRemainingMs(status.remainingMs);
        }
      }

      setFocusInfo(nextFocusInfo);
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
        returnToBlockedUrl();
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

  function goBack() {
    returnToBlockedUrl();
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
        returnToBlockedUrl();
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
        returnToBlockedUrl();
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

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="size-10 animate-spin rounded-full border-b-2 border-primary"></div>
      </div>
    );
  }

  // Show limit exceeded UI
  if (blockType === 'limit' && limitInfo) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md shadow-xl">
          <CardHeader className="items-center text-center">
            <div className="mb-2 flex size-16 items-center justify-center rounded-full bg-muted">
              <Timer className="size-8 text-primary" />
            </div>
            <CardTitle className="text-2xl">Daily Limit Reached</CardTitle>
            <CardDescription>
              <Badge variant="secondary">{limitInfo.limit.pattern}</Badge>
            </CardDescription>
          </CardHeader>

          <CardContent className="flex flex-col gap-6">
            <div className="rounded-lg border bg-muted/50 p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Time spent today</span>
                <span className="font-medium">{formatTime(limitInfo.timeSpent)}</span>
              </div>
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Daily limit</span>
                <span className="font-medium">{formatTime(limitInfo.limit.limitSeconds)}</span>
              </div>
              <Progress value={100} />
            </div>

            <p className="text-center text-sm text-muted-foreground">
              Limit resets in {getTimeUntilMidnight()}
            </p>

            {limitInfo.limit.bypassType === 'cooldown' && (
              <div className="flex flex-col gap-4">
                {!timerStarted ? (
                  <Button onClick={startLimitCooldown} className="w-full" size="lg">
                    Wait {limitInfo.limit.cooldownSeconds || 30}s to continue
                  </Button>
                ) : countdown > 0 ? (
                  <div className="py-4 text-center">
                    <div className="mb-2 text-4xl font-bold">{countdown}</div>
                    <p className="text-sm text-muted-foreground">Taking a moment to reconsider...</p>
                  </div>
                ) : (
                  <div className="py-4 text-center">
                    <div className="mx-auto size-8 animate-spin rounded-full border-b-2 border-primary"></div>
                    <p className="mt-2 text-sm text-muted-foreground">Granting access...</p>
                  </div>
                )}
              </div>
            )}

            {limitInfo.limit.bypassType === 'password' && (
              <form onSubmit={handleLimitPasswordBypass} className="flex flex-col gap-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Lock data-icon="inline-start" />
                  <span>Enter password to continue for 15 minutes</span>
                </div>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError('');
                  }}
                  placeholder="Enter password"
                  aria-invalid={!!error}
                  autoFocus
                />
                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
                <Button type="submit" disabled={unlocking || !password} className="w-full" size="lg">
                  {unlocking ? 'Verifying...' : 'Continue for 15 minutes'}
                </Button>
              </form>
            )}

            {limitInfo.limit.bypassType === 'none' && (
              <Alert>
                <AlertDescription>
                  This limit cannot be bypassed. Check back after midnight.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>

          <CardFooter className="flex flex-col gap-4">
            <Button onClick={goBack} variant="ghost" className="w-full">
              <ArrowLeft data-icon="inline-start" />
              Go Back
            </Button>
            <a
              href={chrome.runtime.getURL('dashboard.html#/limits')}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Manage daily limits in dashboard
            </a>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // Show blocked site UI (original behavior)
  if (!site) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md shadow-xl">
          <CardHeader className="items-center text-center">
            <div className="mb-2 flex size-16 items-center justify-center rounded-full bg-muted">
              <Shield className="size-8 text-destructive" />
            </div>
            <CardTitle className="text-2xl">Site Blocked</CardTitle>
            <CardDescription>This site has been blocked by BrowserUtils.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="items-center text-center">
          <div className="mb-2 flex size-16 items-center justify-center rounded-full bg-muted">
            <Shield className="size-8 text-destructive" />
          </div>
          <CardTitle className="text-2xl">
            {focusInfo ? 'Focus Mode Active' : 'Site Blocked'}
          </CardTitle>
          <CardDescription>
            <Badge variant="secondary">{site.pattern}</Badge>
            <span className="mt-2 block">
              {focusInfo ? 'Blocked by your current focus session' : 'Blocked'}
            </span>
          </CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col gap-4">
          {focusInfo && (
            <div className="flex flex-col gap-4">
              <div className="rounded-lg border bg-muted/50 p-4">
                <div className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="size-4" />
                  <span>Focus session active: {focusInfo.label}</span>
                </div>
                <div className="text-center">
                  <div className="mb-1 text-3xl font-bold">
                    {formatTimeRemaining(focusRemainingMs)}
                  </div>
                  <p className="text-sm text-muted-foreground">remaining</p>
                </div>
              </div>
              <p className="text-center text-sm text-muted-foreground">
                Focus mode takes priority over this site's normal block settings until the session ends.
              </p>
            </div>
          )}

          {!focusInfo && site.unlockType === 'password' && (
            <form onSubmit={handlePasswordUnlock} className="flex flex-col gap-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Lock data-icon="inline-start" />
                <span>Enter password to unlock temporarily</span>
              </div>
              <Input
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError('');
                }}
                placeholder="Enter password"
                aria-invalid={!!error}
                autoFocus
              />
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <Button type="submit" disabled={unlocking || !password} className="w-full" size="lg">
                {unlocking ? 'Unlocking...' : 'Unlock Site'}
              </Button>
            </form>
          )}

          {!focusInfo && site.unlockType === 'timer' && timerRemainingMs > 0 && (
            <div className="flex flex-col gap-4">
              <div className="rounded-lg border bg-muted/50 p-4">
                <div className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="size-4" />
                  <span>Temporary block active</span>
                </div>
                <div className="text-center">
                  <div className="mb-1 text-3xl font-bold">
                    {formatTimeRemaining(timerRemainingMs)}
                  </div>
                  <p className="text-sm text-muted-foreground">remaining</p>
                </div>
              </div>
              <p className="text-center text-sm text-muted-foreground">
                This site will automatically unblock when the timer ends.
              </p>
            </div>
          )}

          {!focusInfo && site.unlockType === 'none' && (
            <Alert>
              <AlertDescription>
                This site is permanently blocked. Go to the dashboard to change settings.
              </AlertDescription>
            </Alert>
          )}

          {!focusInfo && site.unlockType === 'schedule' && site.schedule && (
            <Alert>
              <AlertDescription>
                This site is blocked during scheduled hours.
                <span className="mt-1 block">
                  Blocked: {site.schedule.startTime} - {site.schedule.endTime}
                </span>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>

        <CardFooter className="flex flex-col gap-4">
          <Button onClick={goBack} variant="ghost" className="w-full">
            <ArrowLeft data-icon="inline-start" />
            Go Back
          </Button>
          <a
            href={chrome.runtime.getURL('dashboard.html#/blocked')}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Manage blocked sites in dashboard
          </a>
        </CardFooter>
      </Card>
    </div>
  );
}
