import { useEffect, useState } from 'react';
import { Plus, Trash2, Edit2, Check } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { DailyLimit, DailyStats } from '../../shared/types';
import { hashPassword } from '../../shared/storage';
import { assertRuntimeMutationSucceeded } from '../../shared/runtimeMessages';
import { useLockdown } from '../hooks/useLockdown';
import DashboardPageHeader from '../components/DashboardPageHeader';

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

function normalizeLimitDomain(input: string): string {
  let value = input.trim().toLowerCase();
  value = value.replace(/^https?:\/\//, '');
  value = value.split(/[/?#]/, 1)[0] || '';
  value = value.replace(/\/+$/, '');
  value = value.replace(/^www\./, '');
  return value;
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
  const { withLockdownCheck } = useLockdown();

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
    const normalizedPattern = normalizeLimitDomain(formData.pattern);

    if (!normalizedPattern) {
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

      const saveLimit = async () => {
        if (editingLimit) {
          const result = await chrome.runtime.sendMessage({
            type: 'UPDATE_DAILY_LIMIT',
            payload: {
              ...editingLimit,
              pattern: normalizedPattern,
              limitSeconds: totalSeconds,
              bypassType: formData.bypassType,
              passwordHash,
              cooldownSeconds: formData.bypassType === 'cooldown' ? formData.cooldownSeconds : undefined,
            },
          });
          assertRuntimeMutationSucceeded(result, 'Failed to update daily limit');
        } else {
          const result = await chrome.runtime.sendMessage({
            type: 'ADD_DAILY_LIMIT',
            payload: {
              pattern: normalizedPattern,
              limitSeconds: totalSeconds,
              enabled: true,
              bypassType: formData.bypassType,
              passwordHash,
              cooldownSeconds: formData.bypassType === 'cooldown' ? formData.cooldownSeconds : undefined,
            },
          });
          assertRuntimeMutationSucceeded(result, 'Failed to add daily limit');
        }

        setShowModal(false);
        await loadData();
      };

      if (editingLimit) {
        await withLockdownCheck(saveLimit);
      } else {
        await saveLimit();
      }
    } catch (err) {
      setError('Failed to save limit');
    }
  }

  async function handleDelete(id: string) {
    await withLockdownCheck(async () => {
      if (!confirm('Are you sure you want to delete this limit?')) return;

      try {
        const result = await chrome.runtime.sendMessage({ type: 'REMOVE_DAILY_LIMIT', payload: { id } });
        assertRuntimeMutationSucceeded(result, 'Failed to remove daily limit');
        await loadData();
      } catch (err) {
        console.error('Failed to delete limit:', err);
      }
    });
  }

  async function toggleEnabled(limit: DailyLimit) {
    const doToggle = async () => {
      try {
        const result = await chrome.runtime.sendMessage({
          type: 'UPDATE_DAILY_LIMIT',
          payload: { ...limit, enabled: !limit.enabled },
        });
        assertRuntimeMutationSucceeded(result, 'Failed to update daily limit');
        await loadData();
      } catch (err) {
        console.error('Failed to toggle limit:', err);
      }
    };

    // If disabling a limit, require lockdown check
    if (limit.enabled) {
      await withLockdownCheck(doToggle);
    } else {
      await doToggle();
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
        <div className="size-12 animate-spin rounded-full border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div>
      <DashboardPageHeader
        title="Daily Limits"
        meta="Maximum daily time by site"
        actions={(
          <Button onClick={openAddModal}>
            <Plus data-icon="inline-start" />
            Add Limit
          </Button>
        )}
      />

      {limits.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="mx-auto mb-4 flex size-16 items-center justify-center border bg-muted">
            <Plus className="size-8 text-muted-foreground" />
          </div>
          <h3 className="mb-2 text-lg font-medium">No limits configured</h3>
          <p className="mb-4 text-muted-foreground">
            Set daily time limits to control how much time you spend on specific sites
          </p>
          <Button onClick={openAddModal}>
            Add Your First Limit
          </Button>
        </Card>
      ) : (
        <Card className="divide-y overflow-hidden">
          {limits.map((limit) => {
            const timeSpent = getTimeSpent(limit.pattern);
            const percent = (timeSpent / limit.limitSeconds) * 100;
            const exceeded = percent >= 100;
            const approaching = percent >= 70 && percent < 100;

            return (
              <div key={limit.id} className="p-4">
                <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 basis-full sm:basis-0">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <span className="break-all font-medium">{limit.pattern}</span>
                      {exceeded && limit.enabled && (
                        <Badge variant="destructive">Exceeded</Badge>
                      )}
                      {approaching && limit.enabled && !exceeded && (
                        <Badge variant="outline">Approaching</Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 text-sm text-muted-foreground">
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
                      type="button"
                      onClick={() => toggleEnabled(limit)}
                      aria-label={limit.enabled ? `Disable limit for ${limit.pattern}` : `Enable limit for ${limit.pattern}`}
                      className={`w-[72px] border py-1 text-xs transition-colors ${
                        limit.enabled
                          ? 'bg-danger-subtle text-danger hover:bg-danger-subtle '
                          : 'bg-muted text-muted-foreground hover:bg-accent '
                      }`}
                    >
                      {limit.enabled ? 'Limiting' : 'Disabled'}
                    </button>
                    <Button
                      aria-label={`Edit limit for ${limit.pattern}`}
                      onClick={() => openEditModal(limit)}
                      variant="ghost"
                      size="icon"
                    >
                      <Edit2 />
                    </Button>
                    <Button
                      aria-label={`Delete limit for ${limit.pattern}`}
                      onClick={() => handleDelete(limit.id)}
                      variant="ghost"
                      size="icon"
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="flex items-center gap-3">
                  <Progress value={Math.min(100, percent)} className="min-w-0 flex-1 basis-full sm:basis-0" />
                  <span className="w-24 text-right text-sm text-muted-foreground">
                    {formatTime(timeSpent)} / {formatTime(limit.limitSeconds)}
                  </span>
                </div>
              </div>
            );
          })}
        </Card>
      )}

      {/* Add/Edit Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingLimit ? 'Edit Limit' : 'Add Daily Limit'}</DialogTitle>
            <DialogDescription>Choose a website, its daily allowance, and what happens when time runs out.</DialogDescription>
          </DialogHeader>

            <div className="flex flex-col gap-4">
              {/* Domain */}
              <div className="flex flex-col gap-1">
                <Label htmlFor="limit-domain">Domain</Label>
                <Input
                  id="limit-domain"
                  type="text"
                  value={formData.pattern}
                  onChange={(e) => setFormData({ ...formData, pattern: e.target.value })}
                  onBlur={(e) => setFormData({ ...formData, pattern: normalizeLimitDomain(e.target.value) })}
                  placeholder="e.g., youtube.com"
                />
                <p className="text-xs text-muted-foreground">
                  Enter a domain such as youtube.com. You can also paste a full website address.
                </p>
              </div>

              {/* Time Limit */}
              <div className="flex flex-col gap-1">
                <Label>Daily Limit</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min="0"
                    value={formData.limitHours}
                    onChange={(e) =>
                      setFormData({ ...formData, limitHours: parseInt(e.target.value) || 0 })
                    }
                    className="w-20"
                  />
                  <span className="text-muted-foreground">hours</span>
                  <Input
                    type="number"
                    min="0"
                    max="59"
                    value={formData.limitMinutes}
                    onChange={(e) =>
                      setFormData({ ...formData, limitMinutes: parseInt(e.target.value) || 0 })
                    }
                    className="w-20"
                  />
                  <span className="text-muted-foreground">minutes</span>
                </div>
              </div>

              {/* Bypass Type */}
              <div className="flex flex-col gap-2">
                <Label>Bypass Method</Label>
                <p className="text-xs text-muted-foreground">
                  How can you continue after reaching the limit?
                </p>
                <div className="flex flex-col gap-2">
                  <label className="flex items-center gap-3 p-3 border border-border rounded-lg cursor-pointer hover:bg-muted ">
                    <input
                      type="radio"
                      name="bypassType"
                      checked={formData.bypassType === 'cooldown'}
                      onChange={() => setFormData({ ...formData, bypassType: 'cooldown' })}
                      className="w-4 h-4 text-primary"
                    />
                    <div>
                      <span className="text-sm font-medium">Wait to continue</span>
                      <p className="text-xs text-muted-foreground">Must wait before bypassing</p>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 p-3 border border-border rounded-lg cursor-pointer hover:bg-muted ">
                    <input
                      type="radio"
                      name="bypassType"
                      checked={formData.bypassType === 'password'}
                      onChange={() => setFormData({ ...formData, bypassType: 'password' })}
                      className="w-4 h-4 text-primary"
                    />
                    <div>
                      <span className="text-sm font-medium">Password required</span>
                      <p className="text-xs text-muted-foreground">Enter password to continue</p>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 p-3 border border-border rounded-lg cursor-pointer hover:bg-muted ">
                    <input
                      type="radio"
                      name="bypassType"
                      checked={formData.bypassType === 'none'}
                      onChange={() => setFormData({ ...formData, bypassType: 'none' })}
                      className="w-4 h-4 text-primary"
                    />
                    <div>
                      <span className="text-sm font-medium">No bypass</span>
                      <p className="text-xs text-muted-foreground">Blocked until midnight</p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Cooldown Duration */}
              {formData.bypassType === 'cooldown' && (
                <div className="flex flex-col gap-1">
                  <Label>
                    Wait Time (seconds)
                  </Label>
                  <Input
                    type="number"
                    min="10"
                    max="300"
                    value={formData.cooldownSeconds}
                    onChange={(e) =>
                      setFormData({ ...formData, cooldownSeconds: parseInt(e.target.value) || 30 })
                    }
                    className="w-24"
                  />
                </div>
              )}

              {/* Password */}
              {formData.bypassType === 'password' && (
                <div className="flex flex-col gap-1">
                  <Label>
                    {editingLimit ? 'New Password (leave empty to keep current)' : 'Password'}
                  </Label>
                  <Input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="Enter password"
                  />
                </div>
              )}

              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <DialogFooter>
                <Button
                  onClick={() => setShowModal(false)}
                  variant="outline"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSubmit}
                >
                  <Check data-icon="inline-start" />
                  {editingLimit ? 'Save Changes' : 'Add Limit'}
                </Button>
              </DialogFooter>
            </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
