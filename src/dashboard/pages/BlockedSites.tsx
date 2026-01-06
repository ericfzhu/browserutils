import { useEffect, useState } from 'react';
import { Plus, Trash2, Edit2, X, Shield, Clock, Calendar, Lock } from 'lucide-react';
import { BlockedSite } from '../../shared/types';
import { hashPassword } from '../../shared/storage';

type UnlockType = BlockedSite['unlockType'];

interface FormData {
  pattern: string;
  unlockType: UnlockType;
  password: string;
  timerDuration: number;
  scheduleDays: number[];
  scheduleStart: string;
  scheduleEnd: string;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const defaultFormData: FormData = {
  pattern: '',
  unlockType: 'none',
  password: '',
  timerDuration: 30,
  scheduleDays: [1, 2, 3, 4, 5], // Weekdays
  scheduleStart: '09:00',
  scheduleEnd: '17:00',
};

export default function BlockedSites() {
  const [sites, setSites] = useState<BlockedSite[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingSite, setEditingSite] = useState<BlockedSite | null>(null);
  const [formData, setFormData] = useState<FormData>(defaultFormData);

  useEffect(() => {
    loadSites();
  }, []);

  async function loadSites() {
    try {
      const result = await chrome.runtime.sendMessage({ type: 'GET_BLOCKED_SITES' });
      setSites(result);
    } catch (err) {
      console.error('Failed to load sites:', err);
    } finally {
      setLoading(false);
    }
  }

  function openAddModal() {
    setEditingSite(null);
    setFormData(defaultFormData);
    setShowModal(true);
  }

  function openEditModal(site: BlockedSite) {
    setEditingSite(site);
    setFormData({
      pattern: site.pattern,
      unlockType: site.unlockType,
      password: '',
      timerDuration: site.timerDuration || 30,
      scheduleDays: site.schedule?.days || [1, 2, 3, 4, 5],
      scheduleStart: site.schedule?.startTime || '09:00',
      scheduleEnd: site.schedule?.endTime || '17:00',
    });
    setShowModal(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const payload: Omit<BlockedSite, 'id' | 'createdAt'> = {
      pattern: formData.pattern.toLowerCase().trim(),
      enabled: true,
      unlockType: formData.unlockType,
    };

    if (formData.unlockType === 'password' && formData.password) {
      payload.passwordHash = await hashPassword(formData.password);
    }

    if (formData.unlockType === 'timer') {
      payload.timerDuration = formData.timerDuration;
    }

    if (formData.unlockType === 'schedule') {
      payload.schedule = {
        days: formData.scheduleDays,
        startTime: formData.scheduleStart,
        endTime: formData.scheduleEnd,
      };
    }

    try {
      if (editingSite) {
        await chrome.runtime.sendMessage({
          type: 'UPDATE_BLOCKED_SITE',
          payload: { ...editingSite, ...payload },
        });
      } else {
        await chrome.runtime.sendMessage({
          type: 'ADD_BLOCKED_SITE',
          payload,
        });
      }
      await loadSites();
      setShowModal(false);
    } catch (err) {
      console.error('Failed to save site:', err);
    }
  }

  async function toggleSite(site: BlockedSite) {
    try {
      await chrome.runtime.sendMessage({
        type: 'UPDATE_BLOCKED_SITE',
        payload: { ...site, enabled: !site.enabled },
      });
      await loadSites();
    } catch (err) {
      console.error('Failed to toggle site:', err);
    }
  }

  async function deleteSite(id: string) {
    if (!confirm('Are you sure you want to remove this blocked site?')) return;

    try {
      await chrome.runtime.sendMessage({
        type: 'REMOVE_BLOCKED_SITE',
        payload: { id },
      });
      await loadSites();
    } catch (err) {
      console.error('Failed to delete site:', err);
    }
  }

  function getUnlockIcon(type: UnlockType) {
    switch (type) {
      case 'password':
        return <Lock className="w-4 h-4" />;
      case 'timer':
        return <Clock className="w-4 h-4" />;
      case 'schedule':
        return <Calendar className="w-4 h-4" />;
      default:
        return <Shield className="w-4 h-4" />;
    }
  }

  function getUnlockLabel(site: BlockedSite): string {
    switch (site.unlockType) {
      case 'password':
        return 'Password protected';
      case 'timer':
        return `${site.timerDuration}min timer`;
      case 'schedule':
        return `Scheduled`;
      default:
        return 'Always blocked';
    }
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
        <h1 className="text-2xl font-bold text-gray-900">Blocked Sites</h1>
        <button
          onClick={openAddModal}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
        >
          <Plus className="w-5 h-5" />
          Add Site
        </button>
      </div>

      {/* Sites List */}
      {sites.length > 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left text-sm font-medium text-gray-500 px-6 py-3">Pattern</th>
                <th className="text-left text-sm font-medium text-gray-500 px-6 py-3">Unlock Method</th>
                <th className="text-left text-sm font-medium text-gray-500 px-6 py-3">Status</th>
                <th className="text-right text-sm font-medium text-gray-500 px-6 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {sites.map((site) => (
                <tr key={site.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <span className="font-medium">{site.pattern}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-gray-600">
                      {getUnlockIcon(site.unlockType)}
                      <span className="text-sm">{getUnlockLabel(site)}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => toggleSite(site)}
                      className={`text-sm px-3 py-1 rounded-full transition-colors ${
                        site.enabled
                          ? 'bg-red-100 text-red-700 hover:bg-red-200'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {site.enabled ? 'Blocking' : 'Disabled'}
                    </button>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openEditModal(site)}
                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => deleteSite(site.id)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <Shield className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No blocked sites</h3>
          <p className="text-gray-500 mb-4">Add sites you want to block to help stay focused.</p>
          <button
            onClick={openAddModal}
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
          >
            <Plus className="w-5 h-5" />
            Add Your First Site
          </button>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-lg mx-4 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-semibold">
                {editingSite ? 'Edit Blocked Site' : 'Add Blocked Site'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* Pattern Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Site Pattern
                </label>
                <input
                  type="text"
                  value={formData.pattern}
                  onChange={(e) => setFormData({ ...formData, pattern: e.target.value })}
                  placeholder="e.g., twitter.com or *.reddit.com"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  Use *.domain.com to block all subdomains
                </p>
              </div>

              {/* Unlock Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Unlock Method
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: 'none', label: 'Always Blocked', icon: Shield },
                    { value: 'password', label: 'Password', icon: Lock },
                    { value: 'timer', label: 'Timer', icon: Clock },
                    { value: 'schedule', label: 'Schedule', icon: Calendar },
                  ].map(({ value, label, icon: Icon }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setFormData({ ...formData, unlockType: value as UnlockType })}
                      className={`flex items-center gap-2 p-3 border rounded-lg transition-colors ${
                        formData.unlockType === value
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                      <span className="text-sm font-medium">{label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Password Input */}
              {formData.unlockType === 'password' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Unlock Password
                  </label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder={editingSite ? 'Leave blank to keep current' : 'Enter password'}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required={!editingSite}
                  />
                </div>
              )}

              {/* Timer Duration */}
              {formData.unlockType === 'timer' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Timer Duration (minutes)
                  </label>
                  <input
                    type="number"
                    value={formData.timerDuration}
                    onChange={(e) =>
                      setFormData({ ...formData, timerDuration: parseInt(e.target.value) || 30 })
                    }
                    min={1}
                    max={480}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Site will be blocked again after this time
                  </p>
                </div>
              )}

              {/* Schedule */}
              {formData.unlockType === 'schedule' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Block on these days
                    </label>
                    <div className="flex gap-1">
                      {DAYS.map((day, index) => (
                        <button
                          key={day}
                          type="button"
                          onClick={() => {
                            const days = formData.scheduleDays.includes(index)
                              ? formData.scheduleDays.filter((d) => d !== index)
                              : [...formData.scheduleDays, index];
                            setFormData({ ...formData, scheduleDays: days });
                          }}
                          className={`flex-1 py-2 text-xs font-medium rounded transition-colors ${
                            formData.scheduleDays.includes(index)
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          {day}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Start Time
                      </label>
                      <input
                        type="time"
                        value={formData.scheduleStart}
                        onChange={(e) =>
                          setFormData({ ...formData, scheduleStart: e.target.value })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        End Time
                      </label>
                      <input
                        type="time"
                        value={formData.scheduleEnd}
                        onChange={(e) =>
                          setFormData({ ...formData, scheduleEnd: e.target.value })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                  {editingSite ? 'Save Changes' : 'Add Site'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
