import { useEffect, useState } from 'react';
import { Plus, Trash2, Edit2, Check } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { DailyLimit, DailyStats } from '../../shared/types';
import { hashPassword } from '../../shared/storage';
import { useLockdown } from '../hooks/useLockdown';

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

      if (editingLimit) {
        await chrome.runtime.sendMessage({
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
      } else {
        await chrome.runtime.sendMessage({
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
      }

      setShowModal(false);
      loadData();
    } catch (err) {
      setError('Failed to save limit');
    }
  }

  async function handleDelete(id: string) {
    await withLockdownCheck(async () => {
      if (!confirm('Are you sure you want to delete this limit?')) return;

      try {
        await chrome.runtime.sendMessage({ type: 'REMOVE_DAILY_LIMIT', payload: { id } });
        loadData();
      } catch (err) {
        console.error('Failed to delete limit:', err);
      }
    });
  }

  async function toggleEnabled(limit: DailyLimit) {
    const doToggle = async () => {
      try {
        await chrome.runtime.sendMessage({
          type: 'UPDATE_DAILY_LIMIT',
          payload: { ...limit, enabled: !limit.enabled },
        });
        loadData();
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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Daily Limits</h1>
          <p className="text-sm text-muted-foreground">Set maximum daily time for specific sites</p>
        </div>
        <Button
          onClick={openAddModal}
        >
          <Plus data-icon="inline-start" />
          Add Limit
        </Button>
      </div>

      {limits.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-muted">
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
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">{limit.pattern}</span>
                      {!limit.enabled && (
                        <Badge variant="secondary">Disabled</Badge>
                      )}
                      {exceeded && limit.enabled && (
                        <Badge variant="destructive">Exceeded</Badge>
                      )}
                      {approaching && limit.enabled && !exceeded && (
                        <Badge variant="outline">Approaching</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
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
                    <Switch checked={limit.enabled} onCheckedChange={() => toggleEnabled(limit)} />
                    <Button
                      onClick={() => openEditModal(limit)}
                      variant="ghost"
                      size="icon"
                    >
                      <Edit2 />
                    </Button>
                    <Button
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
                  <Progress value={Math.min(100, percent)} className="flex-1" />
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
          </DialogHeader>

            <div className="flex flex-col gap-4">
              {/* Domain */}
              <div className="flex flex-col gap-1">
                <Label>Domain</Label>
                <Input
                  type="text"
                  value={formData.pattern}
                  onChange={(e) => setFormData({ ...formData, pattern: e.target.value })}
                  onBlur={(e) => setFormData({ ...formData, pattern: normalizeLimitDomain(e.target.value) })}
                  placeholder="e.g., youtube.com"
                />
                <p className="text-xs text-muted-foreground">
                  Full URLs are reduced to a domain, for example `https://www.youtube.com/watch?v=123` becomes `youtube.com`.
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
                      <p className="text-xs text-muted-foreground">Must wait before bypassing</p>
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
                      <p className="text-xs text-muted-foreground">Enter password to continue</p>
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
