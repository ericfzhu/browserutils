import { useEffect, useState } from 'react';
import { Plus, Trash2, Edit2, X, Shield, Clock, Calendar, Lock, FolderPlus, ChevronRight, GripVertical } from 'lucide-react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { BlockedSite, BlockedSiteFolder } from '../../shared/types';
import { hashPassword } from '../../shared/storage';
import { useLockdown } from '../hooks/useLockdown';

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
  const { withLockdownCheck } = useLockdown();

  useEffect(() => {
    loadData();
  }, []);

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

  function openAddFolderModal() {
    setEditingFolder(null);
    setFolderName('');
    setShowFolderModal(true);
  }

  function openEditFolderModal(folder: BlockedSiteFolder) {
    setEditingFolder(folder);
    setFolderName(folder.name);
    setShowFolderModal(true);
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
      await loadData();
      setShowModal(false);
    } catch (err) {
      console.error('Failed to save site:', err);
    }
  }

  async function handleFolderSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!folderName.trim()) return;

    try {
      if (editingFolder) {
        await chrome.runtime.sendMessage({
          type: 'UPDATE_BLOCKED_SITE_FOLDER',
          payload: { ...editingFolder, name: folderName.trim() },
        });
      } else {
        await chrome.runtime.sendMessage({
          type: 'ADD_BLOCKED_SITE_FOLDER',
          payload: { name: folderName.trim(), order: folders.length },
        });
      }
      await loadData();
      setShowFolderModal(false);
    } catch (err) {
      console.error('Failed to save folder:', err);
    }
  }

  async function deleteFolder(id: string) {
    await withLockdownCheck(async () => {
      if (!confirm('Delete this folder? Sites in this folder will be moved to Uncategorized.')) return;

      try {
        await chrome.runtime.sendMessage({
          type: 'REMOVE_BLOCKED_SITE_FOLDER',
          payload: { id },
        });
        await loadData();
      } catch (err) {
        console.error('Failed to delete folder:', err);
      }
    });
  }

  async function toggleFolderCollapse(folder: BlockedSiteFolder) {
    const updated = { ...folder, collapsed: !folder.collapsed };
    setFolders(folders.map(f => f.id === folder.id ? updated : f));
    await chrome.runtime.sendMessage({
      type: 'UPDATE_BLOCKED_SITE_FOLDER',
      payload: updated,
    });
  }

  async function toggleFolderSitesEnabled(folderId: string | undefined, enabled: boolean) {
    const doToggle = async () => {
      const sitesToUpdate = sites.filter(s => s.folderId === folderId).map(s => ({ ...s, enabled }));
      const otherSites = sites.filter(s => s.folderId !== folderId);
      const newSites = [...otherSites, ...sitesToUpdate];
      setSites(newSites);
      await chrome.runtime.sendMessage({
        type: 'UPDATE_BLOCKED_SITES',
        payload: newSites,
      });
    };

    // If disabling sites, require lockdown check
    if (!enabled) {
      await withLockdownCheck(doToggle);
    } else {
      await doToggle();
    }
  }

  async function toggleSite(site: BlockedSite) {
    const doToggle = async () => {
      try {
        await chrome.runtime.sendMessage({
          type: 'UPDATE_BLOCKED_SITE',
          payload: { ...site, enabled: !site.enabled },
        });
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
        await chrome.runtime.sendMessage({
          type: 'REMOVE_BLOCKED_SITE',
          payload: { id },
        });
        await loadData();
      } catch (err) {
        console.error('Failed to delete site:', err);
      }
    });
  }

  async function handleDragEnd(result: DropResult) {
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

      setFolders(updatedFolders);
      await chrome.runtime.sendMessage({
        type: 'UPDATE_BLOCKED_SITE_FOLDERS',
        payload: updatedFolders,
      });
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

      setSites(updatedSites);
      await chrome.runtime.sendMessage({
        type: 'UPDATE_BLOCKED_SITES',
        payload: updatedSites,
      });
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

      setSites(updatedSites);
      await chrome.runtime.sendMessage({
        type: 'UPDATE_BLOCKED_SITES',
        payload: updatedSites,
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

  const renderSiteRow = (site: BlockedSite, index: number) => (
    <Draggable key={site.id} draggableId={site.id} index={index}>
      {(provided) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          className="flex items-center gap-3 px-4 py-3 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 last:border-b-0 hover:bg-gray-50 dark:hover:bg-gray-700/50"
        >
          <div {...provided.dragHandleProps} className="text-gray-300 dark:text-gray-600 hover:text-gray-500 dark:hover:text-gray-400 cursor-grab">
            <GripVertical className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <span className="font-medium text-gray-900 dark:text-gray-100">{site.pattern}</span>
          </div>
          <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-sm">
            {getUnlockIcon(site.unlockType)}
            <span className="hidden sm:inline">{getUnlockLabel(site)}</span>
          </div>
          <button
            onClick={() => toggleSite(site)}
            className={`text-xs px-2 py-1 rounded-full transition-colors ${
              site.enabled
                ? 'bg-red-100 dark:bg-red-700/80 text-red-700 dark:text-red-200 hover:bg-red-200 dark:hover:bg-red-700'
                : 'bg-gray-100 dark:bg-gray-600/80 text-gray-500 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            {site.enabled ? 'Blocking' : 'Disabled'}
          </button>
          <button onClick={() => openEditModal(site)} className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
            <Edit2 className="w-4 h-4" />
          </button>
          <button onClick={() => deleteSite(site.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )}
    </Draggable>
  );

  const renderFolderSection = (folder: BlockedSiteFolder | null, folderSites: BlockedSite[], index: number) => {
    const folderId = folder?.id;
    const isCollapsed = folder?.collapsed;
    const allEnabled = folderSites.length > 0 && folderSites.every(s => s.enabled);
    const someEnabled = folderSites.some(s => s.enabled);

    const content = (dragHandleProps?: React.HTMLAttributes<HTMLDivElement>) => (
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className={`flex items-center gap-2 px-4 py-3 bg-gray-100 dark:bg-gray-700 ${isCollapsed ? '' : 'border-b border-gray-200 dark:border-gray-600'}`}>
          {folder && (
            <div {...dragHandleProps} className="text-gray-300 dark:text-gray-600 hover:text-gray-500 dark:hover:text-gray-400 cursor-grab">
              <GripVertical className="w-4 h-4" />
            </div>
          )}
          <div
            className={`flex items-center gap-2 flex-1 ${folder ? 'cursor-pointer' : ''}`}
            onClick={() => folder && toggleFolderCollapse(folder)}
          >
            {folder && (
              <span className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-transform duration-200">
                <ChevronRight className={`w-5 h-5 transition-transform duration-200 ${isCollapsed ? '' : 'rotate-90'}`} />
              </span>
            )}
            <span className="font-semibold text-gray-900 dark:text-gray-100">
              {folder?.name || 'Uncategorized'} ({folderSites.length})
            </span>
          </div>
          {folderSites.length > 0 && (
            <button
              onClick={() => toggleFolderSitesEnabled(folderId, !allEnabled)}
              className={`text-xs px-2 py-1 rounded transition-colors ${
                allEnabled ? 'bg-red-100 dark:bg-red-700/80 text-red-700 dark:text-red-200 hover:bg-red-200 dark:hover:bg-red-700' :
                someEnabled ? 'bg-yellow-100 dark:bg-yellow-600/80 text-yellow-700 dark:text-yellow-200 hover:bg-yellow-200 dark:hover:bg-yellow-600' :
                'bg-gray-100 dark:bg-gray-600/80 text-gray-500 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {allEnabled ? 'Disable All' : 'Enable All'}
            </button>
          )}
          {folder && (
            <>
              <button onClick={() => openEditFolderModal(folder)} className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
                <Edit2 className="w-4 h-4" />
              </button>
              <button onClick={() => deleteFolder(folder.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded">
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
        <div
          className="grid transition-all duration-200 ease-in-out"
          style={{ gridTemplateRows: (!folder || !isCollapsed) ? '1fr' : '0fr' }}
        >
          <div className="overflow-hidden">
            <Droppable droppableId={folderId || 'uncategorized'} type="site" isDropDisabled={!!isCollapsed}>
              {(provided) => (
                <div ref={provided.innerRef} {...provided.droppableProps} className="min-h-[48px]">
                  {folderSites.length > 0 ? (
                    folderSites.map((site, idx) => renderSiteRow(site, idx))
                  ) : (
                    <div className="px-4 py-6 text-center text-gray-400 dark:text-gray-500 text-sm">
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
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Blocked Sites</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={openAddFolderModal}
            className="flex items-center gap-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 px-4 py-2 rounded-lg transition-colors"
          >
            <FolderPlus className="w-5 h-5" />
            Add Folder
          </button>
          <button
            onClick={openAddModal}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
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
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-12 text-center mt-4">
          <Shield className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">No blocked sites</h3>
          <p className="text-gray-500 dark:text-gray-400 mb-4">Add sites you want to block to help stay focused.</p>
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
          <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-lg mx-4 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b dark:border-gray-700">
              <h2 className="text-lg font-semibold">
                {editingSite ? 'Edit Blocked Site' : 'Add Blocked Site'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* Pattern Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Site Pattern
                </label>
                <input
                  type="text"
                  value={formData.pattern}
                  onChange={(e) => setFormData({ ...formData, pattern: e.target.value })}
                  placeholder="e.g., twitter.com or *.reddit.com"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Use *.domain.com to block all subdomains
                </p>
              </div>

              {/* Unlock Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
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
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                          : 'border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
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
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Unlock Password
                  </label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder={editingSite ? 'Leave blank to keep current' : 'Enter password'}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required={!editingSite}
                  />
                </div>
              )}

              {/* Timer Duration */}
              {formData.unlockType === 'timer' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
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
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Site will be blocked again after this time
                  </p>
                </div>
              )}

              {/* Schedule */}
              {formData.unlockType === 'schedule' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
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
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                          }`}
                        >
                          {day}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Start Time
                      </label>
                      <input
                        type="time"
                        value={formData.scheduleStart}
                        onChange={(e) =>
                          setFormData({ ...formData, scheduleStart: e.target.value })
                        }
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        End Time
                      </label>
                      <input
                        type="time"
                        value={formData.scheduleEnd}
                        onChange={(e) =>
                          setFormData({ ...formData, scheduleEnd: e.target.value })
                        }
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Folder */}
              {folders.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Folder
                  </label>
                  <select
                    value={formData.folderId || ''}
                    onChange={(e) => setFormData({ ...formData, folderId: e.target.value || undefined })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
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

      {/* Add/Edit Folder Modal */}
      {showFolderModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-md mx-4 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b dark:border-gray-700">
              <h2 className="text-lg font-semibold">
                {editingFolder ? 'Edit Folder' : 'Add Folder'}
              </h2>
              <button
                onClick={() => setShowFolderModal(false)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleFolderSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Folder Name
                </label>
                <input
                  type="text"
                  value={folderName}
                  onChange={(e) => setFolderName(e.target.value)}
                  placeholder="e.g., Social Media, Adult Content"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                  autoFocus
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowFolderModal(false)}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                  {editingFolder ? 'Save Changes' : 'Add Folder'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
