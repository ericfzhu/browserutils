import { useEffect, useRef, useState } from 'react';
import { Plus, Trash2, Edit2, X, Shield, Clock, Calendar, Lock, FolderPlus, ChevronRight, GripVertical, Focus } from 'lucide-react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { BlockedSite, BlockedSiteFolder } from '../../shared/types';
import { hashPassword } from '../../shared/storage';
import { assertRuntimeMutationSucceeded } from '../../shared/runtimeMessages';
import { useLockdown } from '../hooks/useLockdown';
import {
  applyBlockedSiteRuleSettings,
  BlockedSiteRuleSettings,
} from '../blockedSiteRules';

type UnlockType = BlockedSite['unlockType'];

interface FormData {
  pattern: string;
  unlockType: UnlockType;
  password: string;
  timerDuration: number;
  scheduleDays: number[];
  scheduleStart: string;
  scheduleEnd: string;
  folderId?: string;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function normalizeUrlPattern(input: string): string {
  let pattern = input.trim().toLowerCase();

  // Remove protocol (http:// or https://)
  pattern = pattern.replace(/^https?:\/\//, '');

  // Check if there's a path after the domain
  const slashIndex = pattern.indexOf('/');
  if (slashIndex !== -1) {
    const path = pattern.slice(slashIndex + 1);
    // If path is empty or just whitespace, remove trailing slash
    if (!path || !path.trim()) {
      pattern = pattern.slice(0, slashIndex);
    } else {
      // There's actual path content - remove trailing slash and add wildcard
      pattern = pattern.replace(/\/+$/, '');
      if (!pattern.endsWith('/*')) {
        pattern = pattern + '/*';
      }
    }
  }

  return pattern;
}

const defaultFormData: FormData = {
  pattern: '',
  unlockType: 'none',
  password: '',
  timerDuration: 30,
  scheduleDays: [1, 2, 3, 4, 5], // Weekdays
  scheduleStart: '09:00',
  scheduleEnd: '17:00',
  folderId: undefined,
};

// Timer status for a site
interface TimerStatus {
  isActive: boolean;
  blockedUntil?: number;
  remainingMs: number;
}

// Focus session status for a folder
interface FocusStatus {
  isActive: boolean;
  focusUntil?: number;
  remainingMs: number;
  focusDuration?: number;
}

type FocusTarget = { type: 'folder'; folderId: string } | { type: 'global' } | null;
type FocusModalMode = 'start' | 'edit';

export default function BlockedSites() {
  const [sites, setSites] = useState<BlockedSite[]>([]);
  const [folders, setFolders] = useState<BlockedSiteFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [editingSite, setEditingSite] = useState<BlockedSite | null>(null);
  const [editingFolder, setEditingFolder] = useState<BlockedSiteFolder | null>(null);
  const [formData, setFormData] = useState<FormData>(defaultFormData);
  const [folderName, setFolderName] = useState('');
  const [applyFolderRules, setApplyFolderRules] = useState(false);
  const [folderRuleData, setFolderRuleData] = useState<FormData>(defaultFormData);
  const [folderRuleError, setFolderRuleError] = useState('');
  const [timerStatuses, setTimerStatuses] = useState<Record<string, TimerStatus>>({});
  const [focusStatuses, setFocusStatuses] = useState<Record<string, FocusStatus>>({});
  const [globalFocusStatus, setGlobalFocusStatus] = useState<FocusStatus | null>(null);
  const [showFocusModal, setShowFocusModal] = useState(false);
  const [focusTarget, setFocusTarget] = useState<FocusTarget>(null);
  const [focusModalMode, setFocusModalMode] = useState<FocusModalMode>('start');
  const [focusDuration, setFocusDuration] = useState(30);
  const [minimumFocusDuration, setMinimumFocusDuration] = useState(1);
  const siteFormRef = useRef<HTMLFormElement>(null);
  const folderFormRef = useRef<HTMLFormElement>(null);
  const { withLockdownCheck } = useLockdown();

  useEffect(() => {
    loadData();
  }, []);

  // Update timer statuses periodically
  useEffect(() => {
    const timerSites = sites.filter(s => s.unlockType === 'timer');
    if (timerSites.length === 0) return;

    const updateTimerStatuses = async () => {
      const statuses: Record<string, TimerStatus> = {};
      for (const site of timerSites) {
        try {
          const status = await chrome.runtime.sendMessage({
            type: 'GET_TIMER_STATUS',
            payload: { id: site.id },
          });
          if (status?.found) {
            statuses[site.id] = {
              isActive: status.isActive,
              blockedUntil: status.blockedUntil,
              remainingMs: status.remainingMs,
            };
          }
        } catch {
          // Ignore errors
        }
      }
      setTimerStatuses(statuses);
    };

    updateTimerStatuses();
    const interval = setInterval(updateTimerStatuses, 1000);
    return () => clearInterval(interval);
  }, [sites]);

  // Update focus session statuses periodically
  useEffect(() => {
    const updateFocusStatuses = async () => {
      const statuses: Record<string, FocusStatus> = {};
      for (const folder of folders) {
        try {
          const status = await chrome.runtime.sendMessage({
            type: 'GET_FOCUS_STATUS',
            payload: { folderId: folder.id },
          });
          if (status?.found) {
            statuses[folder.id] = {
              isActive: status.isActive,
              focusUntil: status.focusUntil,
              remainingMs: status.remainingMs,
              focusDuration: status.focusDuration,
            };
          }
        } catch {
          // Ignore errors
        }
      }
      setFocusStatuses(statuses);

      try {
        const globalStatus = await chrome.runtime.sendMessage({
          type: 'GET_GLOBAL_FOCUS_STATUS',
        });
        setGlobalFocusStatus({
          isActive: !!globalStatus?.isActive,
          focusUntil: globalStatus?.focusUntil,
          remainingMs: globalStatus?.remainingMs || 0,
          focusDuration: globalStatus?.focusDuration,
        });
      } catch {
        setGlobalFocusStatus(null);
      }
    };

    updateFocusStatuses();
    const interval = setInterval(updateFocusStatuses, 1000);
    return () => clearInterval(interval);
  }, [folders]);

  async function loadData() {
    try {
      const [sitesResult, foldersResult] = await Promise.all([
        chrome.runtime.sendMessage({ type: 'GET_BLOCKED_SITES' }),
        chrome.runtime.sendMessage({ type: 'GET_BLOCKED_SITE_FOLDERS' }),
      ]);
      setSites(sitesResult);
      setFolders(foldersResult);
    } catch (err) {
      console.error('Failed to load data:', err);
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
      folderId: site.folderId,
    });
    setShowModal(true);
  }

  function closeSiteModal() {
    setShowModal(false);
  }

  function handleSiteModalKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      closeSiteModal();
      return;
    }

    if (e.key === 'Enter' && !e.repeat) {
      e.preventDefault();
      siteFormRef.current?.requestSubmit();
    }
  }

  function openAddFolderModal() {
    setEditingFolder(null);
    setFolderName('');
    setApplyFolderRules(false);
    setFolderRuleData(defaultFormData);
    setFolderRuleError('');
    setShowFolderModal(true);
  }

  function openEditFolderModal(folder: BlockedSiteFolder) {
    setEditingFolder(folder);
    setFolderName(folder.name);
    setApplyFolderRules(false);
    setFolderRuleData(defaultFormData);
    setFolderRuleError('');
    setShowFolderModal(true);
  }

  function closeFolderModal() {
    setShowFolderModal(false);
    setFolderRuleError('');
  }

  function handleFolderModalKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      closeFolderModal();
      return;
    }

    if (e.key === 'Enter' && !e.repeat) {
      const target = e.target as HTMLElement;
      if (target.tagName === 'BUTTON') return;
      e.preventDefault();
      folderFormRef.current?.requestSubmit();
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const payload: Omit<BlockedSite, 'id' | 'createdAt'> = {
      pattern: normalizeUrlPattern(formData.pattern),
      enabled: true,
      unlockType: formData.unlockType,
      folderId: formData.folderId,
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
      const saveSite = async () => {
        if (editingSite) {
          const result = await chrome.runtime.sendMessage({
            type: 'UPDATE_BLOCKED_SITE',
            payload: { ...editingSite, ...payload, unlockedUntil: undefined },
          });
          assertRuntimeMutationSucceeded(result, 'Failed to update blocked site');
        } else {
          const result = await chrome.runtime.sendMessage({
            type: 'ADD_BLOCKED_SITE',
            payload,
          });
          assertRuntimeMutationSucceeded(result, 'Failed to add blocked site');
        }
        await loadData();
        setShowModal(false);
      };

      if (editingSite) {
        await withLockdownCheck(saveSite);
      } else {
        await saveSite();
      }
    } catch (err) {
      console.error('Failed to save site:', err);
    }
  }

  async function handleFolderSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!folderName.trim()) return;

    if (applyFolderRules && folderRuleData.unlockType === 'password' && !folderRuleData.password) {
      setFolderRuleError('Enter the password to apply to this folder.');
      return;
    }

    if (applyFolderRules && folderRuleData.unlockType === 'schedule' && folderRuleData.scheduleDays.length === 0) {
      setFolderRuleError('Select at least one blocked day.');
      return;
    }

    setFolderRuleError('');

    try {
      const saveFolder = async () => {
        if (editingFolder) {
          if (applyFolderRules) {
            let ruleSettings: BlockedSiteRuleSettings;

            if (folderRuleData.unlockType === 'password') {
              ruleSettings = {
                unlockType: 'password',
                passwordHash: await hashPassword(folderRuleData.password),
              };
            } else if (folderRuleData.unlockType === 'timer') {
              ruleSettings = {
                unlockType: 'timer',
                timerDuration: folderRuleData.timerDuration,
              };
            } else if (folderRuleData.unlockType === 'schedule') {
              ruleSettings = {
                unlockType: 'schedule',
                schedule: {
                  days: folderRuleData.scheduleDays,
                  startTime: folderRuleData.scheduleStart,
                  endTime: folderRuleData.scheduleEnd,
                },
              };
            } else {
              ruleSettings = { unlockType: 'none' };
            }

            const updatedSites = sites.map(site =>
              site.folderId === editingFolder.id
                ? applyBlockedSiteRuleSettings(site, ruleSettings)
                : site
            );
            const sitesResult = await chrome.runtime.sendMessage({
              type: 'UPDATE_BLOCKED_SITES',
              payload: updatedSites,
            });
            assertRuntimeMutationSucceeded(sitesResult, 'Failed to apply folder settings');
          }

          const result = await chrome.runtime.sendMessage({
            type: 'UPDATE_BLOCKED_SITE_FOLDER',
            payload: { ...editingFolder, name: folderName.trim() },
          });
          assertRuntimeMutationSucceeded(result, 'Failed to update folder');
        } else {
          const result = await chrome.runtime.sendMessage({
            type: 'ADD_BLOCKED_SITE_FOLDER',
            payload: { name: folderName.trim(), order: folders.length },
          });
          assertRuntimeMutationSucceeded(result, 'Failed to add folder');
        }
        await loadData();
        closeFolderModal();
      };

      if (editingFolder && applyFolderRules) {
        await withLockdownCheck(saveFolder);
      } else {
        await saveFolder();
      }
    } catch (err) {
      console.error('Failed to save folder:', err);
      setFolderRuleError('The folder could not be saved. Try again.');
    }
  }

  async function deleteFolder(id: string) {
    await withLockdownCheck(async () => {
      if (!confirm('Delete this folder? Sites in this folder will be moved to Uncategorized.')) return;

      try {
        const result = await chrome.runtime.sendMessage({
          type: 'REMOVE_BLOCKED_SITE_FOLDER',
          payload: { id },
        });
        assertRuntimeMutationSucceeded(result, 'Failed to remove folder');
        await loadData();
      } catch (err) {
        console.error('Failed to delete folder:', err);
      }
    });
  }

  async function toggleFolderCollapse(folder: BlockedSiteFolder) {
    const updated = { ...folder, collapsed: !folder.collapsed };
    setFolders(folders.map(f => f.id === folder.id ? updated : f));
    try {
      const result = await chrome.runtime.sendMessage({
        type: 'UPDATE_BLOCKED_SITE_FOLDER',
        payload: updated,
      });
      assertRuntimeMutationSucceeded(result, 'Failed to update folder');
    } catch (err) {
      console.error('Failed to update folder:', err);
      await loadData();
    }
  }

  async function toggleFolderSitesEnabled(folderId: string | undefined, enabled: boolean) {
    const doToggle = async () => {
      const folderSites = sites.filter(s => s.folderId === folderId);

      // For non-timer sites, update the enabled flag
      const nonTimerSites = folderSites.filter(s => s.unlockType !== 'timer');
      if (nonTimerSites.length > 0) {
        const newSites = sites.map(site =>
          site.folderId === folderId && site.unlockType !== 'timer'
            ? { ...site, enabled }
            : site
        );
        const result = await chrome.runtime.sendMessage({
          type: 'UPDATE_BLOCKED_SITES',
          payload: newSites,
        });
        assertRuntimeMutationSucceeded(result, 'Failed to update blocked sites');
        setSites(newSites);
      }

      // For timer sites, start/clear timer blocks
      const timerSites = folderSites.filter(s => s.unlockType === 'timer');
      if (timerSites.length > 0) {
        if (enabled) {
          // Start timer blocks for sites that aren't already active
          const sitesToStart = timerSites.filter(s => !timerStatuses[s.id]?.isActive);
          const results = await Promise.all(
            sitesToStart.map(site =>
              chrome.runtime.sendMessage({
                type: 'START_TIMER_BLOCK',
                payload: { id: site.id },
              }).then(result => ({ site, result }))
            )
          );
          // Immediately update local state for responsive UI
          const newStatuses: Record<string, TimerStatus> = {};
          for (const { site, result } of results) {
            assertRuntimeMutationSucceeded(result, `Failed to start timer for ${site.pattern}`);
            if (result?.success && result.blockedUntil) {
              newStatuses[site.id] = {
                isActive: true,
                blockedUntil: result.blockedUntil,
                remainingMs: result.blockedUntil - Date.now(),
              };
            }
          }
          if (Object.keys(newStatuses).length > 0) {
            setTimerStatuses(prev => ({ ...prev, ...newStatuses }));
          }
        } else {
          // Clear timer blocks when disabling - run in parallel
          const results = await Promise.all(
            timerSites.map(site =>
              chrome.runtime.sendMessage({
                type: 'CLEAR_TIMER_BLOCK',
                payload: { id: site.id },
              }).then(result => ({ site, result }))
            )
          );
          for (const { site, result } of results) {
            assertRuntimeMutationSucceeded(result, `Failed to clear timer for ${site.pattern}`);
          }
          // Immediately update local state
          const clearedStatuses: Record<string, TimerStatus> = {};
          for (const site of timerSites) {
            clearedStatuses[site.id] = {
              isActive: false,
              blockedUntil: undefined,
              remainingMs: 0,
            };
          }
          setTimerStatuses(prev => ({ ...prev, ...clearedStatuses }));
        }
      }
    };

    try {
      // If disabling sites, require lockdown check
      if (!enabled) {
        await withLockdownCheck(doToggle);
      } else {
        await doToggle();
      }
    } catch (err) {
      console.error('Failed to toggle folder sites:', err);
      await loadData();
    }
  }

  async function toggleSite(site: BlockedSite) {
    const doToggle = async () => {
      try {
        const result = await chrome.runtime.sendMessage({
          type: 'UPDATE_BLOCKED_SITE',
          payload: { ...site, enabled: !site.enabled },
        });
        assertRuntimeMutationSucceeded(result, 'Failed to update blocked site');
        await loadData();
      } catch (err) {
        console.error('Failed to toggle site:', err);
      }
    };

    // If disabling a site, require lockdown check
    if (site.enabled) {
      await withLockdownCheck(doToggle);
    } else {
      await doToggle();
    }
  }

  async function deleteSite(id: string) {
    await withLockdownCheck(async () => {
      if (!confirm('Are you sure you want to remove this blocked site?')) return;

      try {
        const result = await chrome.runtime.sendMessage({
          type: 'REMOVE_BLOCKED_SITE',
          payload: { id },
        });
        assertRuntimeMutationSucceeded(result, 'Failed to remove blocked site');
        await loadData();
      } catch (err) {
        console.error('Failed to delete site:', err);
      }
    });
  }

  async function startTimerBlock(id: string) {
    try {
      const result = await chrome.runtime.sendMessage({
        type: 'START_TIMER_BLOCK',
        payload: { id },
      });
      assertRuntimeMutationSucceeded(result, 'Failed to start timer');
      // Immediately update local state for responsive UI
      if (result?.success && result.blockedUntil) {
        setTimerStatuses(prev => ({
          ...prev,
          [id]: {
            isActive: true,
            blockedUntil: result.blockedUntil,
            remainingMs: result.blockedUntil - Date.now(),
          },
        }));
      }
    } catch (err) {
      console.error('Failed to start timer:', err);
    }
  }

  async function clearTimerBlock(id: string) {
    await withLockdownCheck(async () => {
      try {
        const result = await chrome.runtime.sendMessage({
          type: 'CLEAR_TIMER_BLOCK',
          payload: { id },
        });
        assertRuntimeMutationSucceeded(result, 'Failed to clear timer');
        // Immediately update local state for responsive UI
        setTimerStatuses(prev => ({
          ...prev,
          [id]: {
            isActive: false,
            blockedUntil: undefined,
            remainingMs: 0,
          },
        }));
      } catch (err) {
        console.error('Failed to clear timer:', err);
      }
    });
  }

  function formatTimerRemaining(ms: number): string {
    const totalSeconds = Math.ceil(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
  }

  function openFocusModal(folderId: string) {
    const folder = folders.find(f => f.id === folderId);
    setFocusModalMode('start');
    setFocusTarget({ type: 'folder', folderId });
    setMinimumFocusDuration(1);
    setFocusDuration(folder?.focusDuration || 30);
    setShowFocusModal(true);
  }

  function openGlobalFocusModal() {
    setFocusModalMode('start');
    setFocusTarget({ type: 'global' });
    setMinimumFocusDuration(1);
    setFocusDuration(globalFocusStatus?.focusDuration || 30);
    setShowFocusModal(true);
  }

  function openEditFocusModal(folderId: string, remainingMs: number) {
    const minimumMinutes = Math.max(1, Math.ceil(remainingMs / 60000));
    setFocusModalMode('edit');
    setFocusTarget({ type: 'folder', folderId });
    setMinimumFocusDuration(minimumMinutes);
    setFocusDuration(minimumMinutes);
    setShowFocusModal(true);
  }

  function openEditGlobalFocusModal(remainingMs: number) {
    const minimumMinutes = Math.max(1, Math.ceil(remainingMs / 60000));
    setFocusModalMode('edit');
    setFocusTarget({ type: 'global' });
    setMinimumFocusDuration(minimumMinutes);
    setFocusDuration(minimumMinutes);
    setShowFocusModal(true);
  }

  async function startFocusSession() {
    if (!focusTarget || focusDuration < minimumFocusDuration) return;

    try {
      const result = focusTarget.type === 'global'
        ? await chrome.runtime.sendMessage({
            type: 'START_GLOBAL_FOCUS_SESSION',
            payload: { durationMinutes: focusDuration },
          })
        : await chrome.runtime.sendMessage({
            type: 'START_FOCUS_SESSION',
            payload: { folderId: focusTarget.folderId, durationMinutes: focusDuration },
          });
      assertRuntimeMutationSucceeded(result, 'Failed to start focus session');
      // Immediately update local state for responsive UI
      if (result?.success && result.focusUntil) {
        if (focusTarget.type === 'global') {
          setGlobalFocusStatus({
            isActive: true,
            focusUntil: result.focusUntil,
            remainingMs: result.focusUntil - Date.now(),
            focusDuration,
          });
        } else {
          setFocusStatuses(prev => ({
            ...prev,
            [focusTarget.folderId]: {
              isActive: true,
              focusUntil: result.focusUntil,
              remainingMs: result.focusUntil - Date.now(),
              focusDuration: focusDuration,
            },
          }));
        }
      }
      setShowFocusModal(false);
      setFocusTarget(null);
      setFocusModalMode('start');
      setMinimumFocusDuration(1);
    } catch (err) {
      console.error('Failed to start focus session:', err);
    }
  }

  async function stopFocusSession(folderId: string) {
    await withLockdownCheck(async () => {
      try {
        const result = await chrome.runtime.sendMessage({
          type: 'STOP_FOCUS_SESSION',
          payload: { folderId },
        });
        assertRuntimeMutationSucceeded(result, 'Failed to stop focus session');
        // Immediately update local state
        setFocusStatuses(prev => ({
          ...prev,
          [folderId]: {
            isActive: false,
            focusUntil: undefined,
            remainingMs: 0,
          },
        }));
      } catch (err) {
        console.error('Failed to stop focus session:', err);
      }
    });
  }

  async function stopGlobalFocusSession() {
    await withLockdownCheck(async () => {
      try {
        const result = await chrome.runtime.sendMessage({
          type: 'STOP_GLOBAL_FOCUS_SESSION',
        });
        assertRuntimeMutationSucceeded(result, 'Failed to stop global focus session');
        setGlobalFocusStatus({
          isActive: false,
          focusUntil: undefined,
          remainingMs: 0,
          focusDuration: globalFocusStatus?.focusDuration,
        });
      } catch (err) {
        console.error('Failed to stop global focus session:', err);
      }
    });
  }

  async function handleDragEnd(result: DropResult) {
    try {
      await persistDragEnd(result);
    } catch (err) {
      console.error('Failed to reorder blocked sites:', err);
      await loadData();
    }
  }

  async function persistDragEnd(result: DropResult) {
    if (!result.destination) return;

    const { source, destination, type } = result;

    // Reordering folders
    if (type === 'folder') {
      if (source.index === destination.index) return;

      const reorderedFolders = Array.from(folders);
      const [movedFolder] = reorderedFolders.splice(source.index, 1);
      reorderedFolders.splice(destination.index, 0, movedFolder);

      // Update order property
      const updatedFolders = reorderedFolders.map((folder, index) => ({
        ...folder,
        order: index,
      }));

      const response = await chrome.runtime.sendMessage({
        type: 'UPDATE_BLOCKED_SITE_FOLDERS',
        payload: updatedFolders,
      });
      assertRuntimeMutationSucceeded(response, 'Failed to reorder folders');
      setFolders(updatedFolders);
      return;
    }

    // Handle site drag (reordering or moving between folders)
    const sourceFolderId = source.droppableId === 'uncategorized' ? undefined : source.droppableId;
    const destFolderId = destination.droppableId === 'uncategorized' ? undefined : destination.droppableId;

    // Get sites in the source folder
    const sourceFolderSites = sites
      .filter(s => s.folderId === sourceFolderId)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    // Find the dragged site
    const draggedSite = sourceFolderSites[source.index];
    if (!draggedSite) return;

    if (source.droppableId === destination.droppableId) {
      // Reordering within the same folder
      if (source.index === destination.index) return;

      const reordered = Array.from(sourceFolderSites);
      const [removed] = reordered.splice(source.index, 1);
      reordered.splice(destination.index, 0, removed);

      // Update order for all sites in this folder
      const updatedSites = sites.map(site => {
        if (site.folderId !== sourceFolderId) return site;
        const newIndex = reordered.findIndex(s => s.id === site.id);
        return { ...site, order: newIndex };
      });

      const response = await chrome.runtime.sendMessage({
        type: 'UPDATE_BLOCKED_SITES',
        payload: updatedSites,
      });
      assertRuntimeMutationSucceeded(response, 'Failed to reorder sites');
      setSites(updatedSites);
    } else {
      // Moving site to a different folder
      const destFolderSites = sites
        .filter(s => s.folderId === destFolderId)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

      // Remove from source, add to destination at the right position
      const updatedSites = sites.map(site => {
        if (site.id === draggedSite.id) {
          // Move to new folder with new order
          return { ...site, folderId: destFolderId, order: destination.index };
        }
        // Update order for sites in source folder (after removed item)
        if (site.folderId === sourceFolderId) {
          const currentIndex = sourceFolderSites.findIndex(s => s.id === site.id);
          if (currentIndex > source.index) {
            return { ...site, order: currentIndex - 1 };
          }
        }
        // Update order for sites in destination folder (at and after insertion point)
        if (site.folderId === destFolderId) {
          const currentIndex = destFolderSites.findIndex(s => s.id === site.id);
          if (currentIndex >= destination.index) {
            return { ...site, order: currentIndex + 1 };
          }
        }
        return site;
      });

      await withLockdownCheck(async () => {
        const response = await chrome.runtime.sendMessage({
          type: 'UPDATE_BLOCKED_SITES',
          payload: updatedSites,
        });
        assertRuntimeMutationSucceeded(response, 'Failed to move site');
        setSites(updatedSites);
      });
    }
  }

  // Group sites by folder and sort by order
  const sitesByFolder = new Map<string | undefined, BlockedSite[]>();
  folders.forEach(f => sitesByFolder.set(f.id, []));
  sitesByFolder.set(undefined, []); // Uncategorized
  sites.forEach(site => {
    const folderId = site.folderId;
    const existing = sitesByFolder.get(folderId) || [];
    existing.push(site);
    sitesByFolder.set(folderId, existing);
  });
  // Sort sites within each folder by order
  for (const [, folderSites] of sitesByFolder) {
    folderSites.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
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
        return `${site.timerDuration}min block`;
      case 'schedule':
        return `Scheduled`;
      default:
        return 'Always blocked';
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const renderSiteRow = (site: BlockedSite, index: number) => {
    const timerStatus = timerStatuses[site.id];
    const isTimerActive = site.unlockType === 'timer' && timerStatus?.isActive;

    return (
      <Draggable key={site.id} draggableId={site.id} index={index}>
        {(provided) => (
          <div
            ref={provided.innerRef}
            {...provided.draggableProps}
            className="flex items-center gap-3 px-4 py-3 bg-card border-b border-border last:border-b-0 hover:bg-muted "
          >
            <div {...provided.dragHandleProps} className="text-muted-foreground hover:text-muted-foreground cursor-grab">
              <GripVertical className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="font-medium text-foreground ">{site.pattern}</span>
            </div>
            {/* Show time remaining before the label when timer is active */}
            {isTimerActive && timerStatus && (
              <span className="text-xs text-danger font-medium">
                {formatTimerRemaining(timerStatus.remainingMs)}
              </span>
            )}
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              {getUnlockIcon(site.unlockType)}
              <span className="hidden sm:inline">{getUnlockLabel(site)}</span>
            </div>
            {/* Timer controls for timer-type sites */}
            {site.unlockType === 'timer' ? (
              isTimerActive ? (
                <button
                  onClick={() => clearTimerBlock(site.id)}
                  className="w-[72px] border border-danger/30 bg-danger-subtle py-1 text-xs text-danger transition-colors hover:bg-danger-subtle "
                >
                  Stop
                </button>
              ) : (
                <button
                  onClick={() => startTimerBlock(site.id)}
                  className="w-[72px] border bg-muted py-1 text-xs text-muted-foreground transition-colors hover:bg-accent"
                >
                  Disabled
                </button>
              )
            ) : (
              /* Standard toggle for non-timer sites */
              <button
                onClick={() => toggleSite(site)}
                className={`w-[72px] border py-1 text-xs transition-colors ${
                  site.enabled
                    ? 'bg-danger-subtle text-danger hover:bg-danger-subtle '
                    : 'bg-muted text-muted-foreground hover:bg-accent '
                }`}
              >
                {site.enabled ? 'Blocking' : 'Disabled'}
              </button>
            )}
            <button onClick={() => openEditModal(site)} className="p-1.5 text-muted-foreground hover:bg-muted hover:text-muted-foreground ">
              <Edit2 className="w-4 h-4" />
            </button>
            <button onClick={() => deleteSite(site.id)} className="p-1.5 text-muted-foreground hover:bg-danger-subtle hover:text-danger ">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </Draggable>
    );
  };

  const renderFolderSection = (folder: BlockedSiteFolder | null, folderSites: BlockedSite[], index: number) => {
    const folderId = folder?.id;
    const isCollapsed = folder?.collapsed;
    // For timer sites, "enabled" means timer is active; for others, use site.enabled
    const isSiteBlocking = (s: BlockedSite) =>
      s.unlockType === 'timer' ? timerStatuses[s.id]?.isActive : s.enabled;
    const allEnabled = folderSites.length > 0 && folderSites.every(isSiteBlocking);
    const someEnabled = folderSites.some(isSiteBlocking);
    const focusStatus = folderId ? focusStatuses[folderId] : null;
    const isFocusActive = focusStatus?.isActive;

    const content = (dragHandleProps?: React.HTMLAttributes<HTMLDivElement>) => (
      <div className="overflow-hidden border border-border bg-card shadow-[var(--shadow-card)]">
        <div className={`flex items-center gap-2 px-4 py-3 bg-muted  ${isCollapsed ? '' : 'border-b border-border '}`}>
          {folder && (
            <div {...dragHandleProps} className="text-muted-foreground hover:text-muted-foreground cursor-grab">
              <GripVertical className="w-4 h-4" />
            </div>
          )}
          <div
            className={`flex items-center gap-2 flex-1 ${folder ? 'cursor-pointer' : ''}`}
            onClick={() => folder && toggleFolderCollapse(folder)}
          >
            {folder && (
              <span className="text-muted-foreground hover:text-foreground transition-transform duration-200">
                <ChevronRight className={`w-5 h-5 transition-transform duration-200 ${isCollapsed ? '' : 'rotate-90'}`} />
              </span>
            )}
            <span className="font-semibold text-foreground ">
              {folder?.name || 'Uncategorized'} ({folderSites.length})
            </span>
          </div>
          {/* Focus button - only for folders */}
          {folder && folderSites.length > 0 && (
            isFocusActive && focusStatus ? (
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-foreground tabular-nums">
                  {formatTimerRemaining(focusStatus.remainingMs)}
                </span>
                <button
                  onClick={() => openEditFocusModal(folder.id, focusStatus.remainingMs)}
                  className="flex w-[72px] items-center justify-center gap-1 border bg-card py-1 text-xs text-foreground transition-colors hover:bg-muted"
                >
                  <Focus className="w-3 h-3" />
                  Extend
                </button>
                <button
                  onClick={() => stopFocusSession(folder.id)}
                  className="flex w-[72px] items-center justify-center gap-1 border border-foreground bg-foreground py-1 text-xs text-background transition-opacity hover:opacity-80"
                >
                  <Focus className="w-3 h-3" />
                  Stop
                </button>
              </div>
            ) : (
              <button
                onClick={() => openFocusModal(folder.id)}
                className="flex w-[72px] items-center justify-center gap-1 border bg-card py-1 text-xs text-foreground transition-colors hover:bg-muted"
              >
                <Focus className="w-3 h-3" />
                Focus
              </button>
            )
          )}
          {folderSites.length > 0 && (
            <button
              onClick={() => toggleFolderSitesEnabled(folderId, !allEnabled)}
              className={`w-[82px] border py-1 text-xs transition-colors ${
                allEnabled ? 'bg-danger-subtle text-danger hover:bg-danger-subtle ' :
                someEnabled ? 'bg-warning-subtle text-warning hover:bg-warning-subtle ' :
                'bg-muted text-muted-foreground hover:bg-accent '
              }`}
            >
              {allEnabled ? 'Disable All' : 'Enable All'}
            </button>
          )}
          {folder && (
            <>
              <button onClick={() => openEditFolderModal(folder)} className="p-1.5 text-muted-foreground hover:bg-muted hover:text-muted-foreground ">
                <Edit2 className="w-4 h-4" />
              </button>
              <button onClick={() => deleteFolder(folder.id)} className="p-1.5 text-muted-foreground hover:bg-danger-subtle hover:text-danger ">
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
        <div
          className="grid transition-[grid-template-rows] duration-200 ease-in-out"
          style={{ gridTemplateRows: (!folder || !isCollapsed) ? '1fr' : '0fr' }}
        >
          <div className="overflow-hidden">
            <Droppable droppableId={folderId || 'uncategorized'} type="site" isDropDisabled={!!isCollapsed}>
              {(provided) => (
                <div ref={provided.innerRef} {...provided.droppableProps} className="min-h-[48px]">
                  {folderSites.length > 0 ? (
                    folderSites.map((site, idx) => renderSiteRow(site, idx))
                  ) : (
                    <div className="px-4 py-6 text-center text-muted-foreground text-sm">
                      Drag sites here or add new ones
                    </div>
                  )}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </div>
        </div>
      </div>
    );

    // Folders are draggable, Uncategorized is not
    if (folder) {
      return (
        <Draggable key={folder.id} draggableId={`folder-${folder.id}`} index={index}>
          {(provided) => (
            <div ref={provided.innerRef} {...provided.draggableProps}>
              {content(provided.dragHandleProps || undefined)}
            </div>
          )}
        </Draggable>
      );
    }

    return <div key="uncategorized">{content()}</div>;
  };

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 border-b border-foreground pb-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="mb-1 font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">Controls</p>
          <h1 className="text-2xl font-bold text-foreground">Blocked Sites</h1>
        </div>
        <div className="flex items-center gap-2">
          {sites.length > 0 && (
            globalFocusStatus?.isActive ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-info font-medium">
                  {formatTimerRemaining(globalFocusStatus.remainingMs)}
                </span>
                <button
                  onClick={() => openEditGlobalFocusModal(globalFocusStatus.remainingMs)}
                  className="flex min-h-10 items-center gap-2 border bg-card px-4 text-foreground transition-colors hover:bg-muted"
                >
                  <Focus className="w-5 h-5" />
                  Extend Focus
                </button>
                <button
                  onClick={stopGlobalFocusSession}
                  className="flex min-h-10 items-center gap-2 border border-foreground bg-foreground px-4 text-background transition-opacity hover:opacity-80"
                >
                  <Focus className="w-5 h-5" />
                  Stop Focus
                </button>
              </div>
            ) : (
              <button
                onClick={openGlobalFocusModal}
                className="flex min-h-10 items-center gap-2 border bg-card px-4 text-foreground transition-colors hover:bg-muted"
              >
                <Focus className="w-5 h-5" />
                Focus All
              </button>
            )
          )}
          <button
            onClick={openAddFolderModal}
            className="flex min-h-10 items-center gap-2 border bg-card px-4 text-foreground transition-colors hover:bg-muted"
          >
            <FolderPlus className="w-5 h-5" />
            Add Folder
          </button>
          <button
            onClick={openAddModal}
            className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-primary-foreground transition-colors hover:bg-primary/85"
          >
            <Plus className="w-5 h-5" />
            Add Site
          </button>
        </div>
      </div>

      {/* Grouped Sites */}
      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="folders" type="folder">
          {(provided) => (
            <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-4">
              {folders.map((folder, index) => renderFolderSection(folder, sitesByFolder.get(folder.id) || [], index))}
              {provided.placeholder}
              {renderFolderSection(null, sitesByFolder.get(undefined) || [], folders.length)}
            </div>
          )}
        </Droppable>
      </DragDropContext>

      {sites.length === 0 && folders.length === 0 && (
        <div className="mt-4 border border-border bg-card p-12 text-center shadow-[var(--shadow-card)]">
          <Shield className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">No blocked sites</h3>
          <p className="text-muted-foreground mb-4">Add sites you want to block to help stay focused.</p>
          <button
            onClick={openAddModal}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-primary-foreground transition-colors hover:bg-primary/85"
          >
            <Plus className="w-5 h-5" />
            Add Your First Site
          </button>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div
          className="fixed inset-0 bg-overlay flex items-center justify-center z-50"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeSiteModal();
          }}
          onKeyDown={handleSiteModalKeyDown}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="blocked-site-dialog-title"
            className="bg-card rounded-lg border border-border shadow-[var(--shadow-card)] w-full max-w-lg mx-4 overflow-hidden"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b ">
              <h2 id="blocked-site-dialog-title" className="text-lg font-semibold">
                {editingSite ? 'Edit Blocked Site' : 'Add Blocked Site'}
              </h2>
              <button
                type="button"
                onClick={closeSiteModal}
                aria-label="Close"
                className="p-2 hover:bg-muted rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form ref={siteFormRef} onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* Pattern Input */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Site Pattern
                </label>
                <input
                  type="text"
                  value={formData.pattern}
                  onChange={(e) => setFormData({ ...formData, pattern: e.target.value })}
                  placeholder="e.g., twitter.com or *.reddit.com"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 focus:border-ring focus:ring-2 focus:ring-ring/45"
                  required
                  autoFocus
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Use *.domain.com to block all subdomains
                </p>
              </div>

              {/* Unlock Type */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
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
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border hover:bg-muted '
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
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Unlock Password
                  </label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder={editingSite ? 'Leave blank to keep current' : 'Enter password'}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 focus:border-ring focus:ring-2 focus:ring-ring/45"
                    required={!editingSite}
                  />
                </div>
              )}

              {/* Timer Duration */}
              {formData.unlockType === 'timer' && (
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Block Duration (minutes)
                  </label>
                  <input
                    type="number"
                    value={formData.timerDuration || ''}
                    onChange={(e) => {
                      const value = e.target.value;
                      // Allow empty input, otherwise parse the number
                      setFormData({
                        ...formData,
                        timerDuration: value === '' ? 0 : parseInt(value) || 0,
                      });
                    }}
                    onBlur={(e) => {
                      // On blur, if empty or 0, set to default 30
                      const value = parseInt(e.target.value);
                      if (!value || value < 1) {
                        setFormData({ ...formData, timerDuration: 30 });
                      }
                    }}
                    min={1}
                    max={480}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 focus:border-ring focus:ring-2 focus:ring-ring/45"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Enable timer to block site for this duration
                  </p>
                </div>
              )}

              {/* Schedule */}
              {formData.unlockType === 'schedule' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
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
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted text-muted-foreground hover:bg-accent '
                          }`}
                        >
                          {day}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1">
                        Start Time
                      </label>
                      <input
                        type="time"
                        value={formData.scheduleStart}
                        onChange={(e) =>
                          setFormData({ ...formData, scheduleStart: e.target.value })
                        }
                        className="w-full rounded-md border border-input bg-background px-3 py-2 focus:border-ring focus:ring-2 focus:ring-ring/45"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1">
                        End Time
                      </label>
                      <input
                        type="time"
                        value={formData.scheduleEnd}
                        onChange={(e) =>
                          setFormData({ ...formData, scheduleEnd: e.target.value })
                        }
                        className="w-full rounded-md border border-input bg-background px-3 py-2 focus:border-ring focus:ring-2 focus:ring-ring/45"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Folder */}
              {folders.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Folder
                  </label>
                  <select
                    value={formData.folderId || ''}
                    onChange={(e) => setFormData({ ...formData, folderId: e.target.value || undefined })}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 focus:border-ring focus:ring-2 focus:ring-ring/45"
                  >
                    <option value="">Uncategorized</option>
                    {folders.map(folder => (
                      <option key={folder.id} value={folder.id}>{folder.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={closeSiteModal}
                  className="px-4 py-2 text-foreground hover:bg-muted rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-md bg-primary px-4 py-2 text-primary-foreground transition-colors hover:bg-primary/85"
                >
                  {editingSite ? 'Save Changes' : 'Add Site'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add/Edit Folder Modal */}
      {showFolderModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-overlay"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeFolderModal();
          }}
          onKeyDown={handleFolderModalKeyDown}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="blocked-site-folder-dialog-title"
            className="mx-4 flex max-h-[calc(100vh-2rem)] w-full max-w-lg flex-col overflow-hidden border border-border bg-card shadow-[var(--shadow-card)] "
          >
            <div className="flex items-center justify-between px-6 py-4 border-b ">
              <h2 id="blocked-site-folder-dialog-title" className="text-lg font-semibold">
                {editingFolder ? 'Edit Folder' : 'Add Folder'}
              </h2>
              <button
                type="button"
                onClick={closeFolderModal}
                aria-label="Close"
                className="p-2 transition-colors hover:bg-muted "
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form ref={folderFormRef} onSubmit={handleFolderSubmit} className="space-y-5 overflow-y-auto p-6">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Folder Name
                </label>
                <input
                  type="text"
                  value={folderName}
                  onChange={(e) => setFolderName(e.target.value)}
                  placeholder="e.g., Social Media, Shopping"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 focus:border-ring focus:ring-2 focus:ring-ring/45"
                  required
                  autoFocus
                />
              </div>

              {editingFolder && (
                <div className="border border-border bg-muted/30">
                  <label className="flex cursor-pointer items-start gap-3 p-4">
                    <input
                      type="checkbox"
                      checked={applyFolderRules}
                      onChange={(e) => {
                        setApplyFolderRules(e.target.checked);
                        setFolderRuleError('');
                      }}
                      className="mt-0.5 size-4 accent-primary"
                    />
                    <span>
                      <span className="block text-sm font-medium text-foreground">
                        Apply blocking settings to every site
                      </span>
                      <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                        Leave this off to keep each site's current unlock method and schedule.
                      </span>
                    </span>
                  </label>

                  {applyFolderRules && (
                    <div className="space-y-4 border-t border-border bg-background p-4">
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-xs font-medium uppercase text-muted-foreground">
                          One-time bulk update
                        </span>
                        <span className="text-xs tabular-nums text-muted-foreground">
                          {sites.filter(site => site.folderId === editingFolder.id).length} sites
                        </span>
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-medium text-foreground ">
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
                              onClick={() => {
                                setFolderRuleData({ ...folderRuleData, unlockType: value as UnlockType });
                                setFolderRuleError('');
                              }}
                              className={`flex min-h-11 items-center gap-2 border p-3 text-left transition-colors ${
                                folderRuleData.unlockType === value
                                  ? 'border-primary bg-primary/10 text-primary'
                                  : 'border-border hover:bg-muted'
                              }`}
                            >
                              <Icon className="size-5 shrink-0" />
                              <span className="text-sm font-medium">{label}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      {folderRuleData.unlockType === 'password' && (
                        <div>
                          <label className="mb-1 block text-sm font-medium text-foreground ">
                            Shared Unlock Password
                          </label>
                          <input
                            type="password"
                            value={folderRuleData.password}
                            onChange={(e) => {
                              setFolderRuleData({ ...folderRuleData, password: e.target.value });
                              setFolderRuleError('');
                            }}
                            placeholder="Enter password"
                            className="w-full rounded-md border border-input bg-background px-3 py-2 focus:border-ring focus:ring-2 focus:ring-ring/45"
                            required
                          />
                        </div>
                      )}

                      {folderRuleData.unlockType === 'timer' && (
                        <div>
                          <label className="mb-1 block text-sm font-medium text-foreground ">
                            Block Duration (minutes)
                          </label>
                          <input
                            type="number"
                            value={folderRuleData.timerDuration || ''}
                            onChange={(e) => {
                              const value = e.target.value;
                              setFolderRuleData({
                                ...folderRuleData,
                                timerDuration: value === '' ? 0 : parseInt(value) || 0,
                              });
                            }}
                            onBlur={(e) => {
                              const value = parseInt(e.target.value);
                              if (!value || value < 1) {
                                setFolderRuleData({ ...folderRuleData, timerDuration: 30 });
                              }
                            }}
                            min={1}
                            max={480}
                            required
                            className="w-full rounded-md border border-input bg-background px-3 py-2 focus:border-ring focus:ring-2 focus:ring-ring/45"
                          />
                        </div>
                      )}

                      {folderRuleData.unlockType === 'schedule' && (
                        <div className="space-y-3">
                          <div>
                            <label className="mb-2 block text-sm font-medium text-foreground ">
                              Block on these days
                            </label>
                            <div className="grid grid-cols-7 gap-1">
                              {DAYS.map((day, index) => (
                                <button
                                  key={day}
                                  type="button"
                                  onClick={() => {
                                    const days = folderRuleData.scheduleDays.includes(index)
                                      ? folderRuleData.scheduleDays.filter(dayIndex => dayIndex !== index)
                                      : [...folderRuleData.scheduleDays, index];
                                    setFolderRuleData({ ...folderRuleData, scheduleDays: days });
                                    setFolderRuleError('');
                                  }}
                                  className={`min-h-9 border py-2 text-xs font-medium transition-colors ${
                                    folderRuleData.scheduleDays.includes(index)
                                      ? 'border-primary bg-primary text-primary-foreground'
                                      : 'border-border bg-muted text-muted-foreground hover:bg-muted/70'
                                  }`}
                                >
                                  {day}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="mb-1 block text-sm font-medium text-foreground ">
                                Start Time
                              </label>
                              <input
                                type="time"
                                value={folderRuleData.scheduleStart}
                                onChange={(e) => setFolderRuleData({ ...folderRuleData, scheduleStart: e.target.value })}
                                className="w-full rounded-md border border-input bg-background px-3 py-2 focus:border-ring focus:ring-2 focus:ring-ring/45"
                                required
                              />
                            </div>
                            <div>
                              <label className="mb-1 block text-sm font-medium text-foreground ">
                                End Time
                              </label>
                              <input
                                type="time"
                                value={folderRuleData.scheduleEnd}
                                onChange={(e) => setFolderRuleData({ ...folderRuleData, scheduleEnd: e.target.value })}
                                className="w-full rounded-md border border-input bg-background px-3 py-2 focus:border-ring focus:ring-2 focus:ring-ring/45"
                                required
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      <p className="border-l-2 border-primary pl-3 text-xs leading-5 text-muted-foreground">
                        Saving replaces these settings on every site currently in this folder. Sites can still be edited individually afterward.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {folderRuleError && (
                <p role="alert" className="border-l-2 border-destructive pl-3 text-sm text-destructive">
                  {folderRuleError}
                </p>
              )}

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={closeFolderModal}
                  className="px-4 py-2 text-foreground transition-colors hover:bg-muted "
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-md bg-primary px-4 py-2 text-primary-foreground transition-colors hover:bg-primary/85"
                >
                  {editingFolder ? 'Save Changes' : 'Add Folder'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Focus Session Modal */}
      {showFocusModal && focusTarget && (
        <div className="fixed inset-0 bg-overlay flex items-center justify-center z-50">
          <div className="mx-4 w-full max-w-sm overflow-hidden border border-border bg-card shadow-[var(--shadow-card)]">
            <div className="flex items-center justify-between px-6 py-4 border-b ">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Focus className="size-5 text-foreground" />
                {focusModalMode === 'edit' ? 'Extend Focus Session' : 'Start Focus Session'}
              </h2>
              <button
                onClick={() => {
                  setShowFocusModal(false);
                  setFocusTarget(null);
                  setFocusModalMode('start');
                  setMinimumFocusDuration(1);
                }}
                className="p-2 hover:bg-muted rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-sm text-muted-foreground ">
                {focusTarget.type === 'global'
                  ? (focusModalMode === 'edit' ? 'Set the new total remaining time for all blocked sites:' : 'Block all blocked sites for:')
                  : (focusModalMode === 'edit'
                    ? `Set the new total remaining time for "${folders.find(f => f.id === focusTarget.folderId)?.name}":`
                    : `Block all sites in "${folders.find(f => f.id === focusTarget.folderId)?.name}" for:`)}
              </p>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Duration (minutes)
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setFocusDuration(Math.max(minimumFocusDuration, (focusDuration || 30) - 30))}
                    disabled={(focusDuration || 0) - 30 < minimumFocusDuration}
                    className="px-3 py-2 rounded-lg border border-border bg-muted text-foreground hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    -30m
                  </button>
                  <input
                    type="number"
                    value={focusDuration || ''}
                    onChange={(e) => {
                      const value = e.target.value;
                      setFocusDuration(value === '' ? 0 : parseInt(value) || 0);
                    }}
                    onBlur={() => {
                      if (!focusDuration || focusDuration < minimumFocusDuration) {
                        setFocusDuration(focusModalMode === 'edit' ? minimumFocusDuration : 30);
                      }
                    }}
                    min={minimumFocusDuration}
                    className="flex-1 border border-input bg-background px-3 py-2 focus:border-ring focus:ring-2 focus:ring-ring/45"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setFocusDuration((focusDuration || 0) + 30)}
                    className="px-3 py-2 rounded-lg border border-border bg-muted text-foreground hover:bg-accent transition-colors"
                  >
                    +30m
                  </button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Use 30-minute steps or enter any positive number for a custom duration.
                </p>
                {focusModalMode === 'edit' && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Minimum allowed: {minimumFocusDuration} minutes remaining.
                  </p>
                )}
              </div>

              <div className="flex gap-2">
                {[30, 60, 90].map(mins => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => setFocusDuration(mins)}
                    disabled={mins < minimumFocusDuration}
                    className={`flex-1 border py-1.5 text-sm transition-colors ${
                      focusDuration === mins
                        ? 'border-foreground bg-foreground text-background'
                        : 'bg-muted text-foreground hover:bg-accent '
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {mins === 90 ? '1.5h' : mins >= 60 ? `${mins / 60}h` : `${mins}m`}
                  </button>
                ))}
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowFocusModal(false);
                    setFocusTarget(null);
                    setFocusModalMode('start');
                    setMinimumFocusDuration(1);
                  }}
                  className="px-4 py-2 text-foreground hover:bg-muted rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={startFocusSession}
                  disabled={focusDuration < minimumFocusDuration}
                  className="border border-foreground bg-foreground px-4 py-2 text-background transition-opacity hover:opacity-80"
                >
                  {focusModalMode === 'edit' ? 'Update Focus' : 'Start Focus'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
