import { useEffect, useState } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { Plus, Pencil, Trash2, GripVertical, X, ChevronRight, CheckSquare, Square } from 'lucide-react';
import { DailyStats, CustomCategory } from '../../shared/types';
import { CATEGORIES, getCategoryForDomain, getCategoryInfoWithOverrides, isBuiltInCategory, DEFAULT_DOMAIN_CATEGORIES, CATEGORY_COLOR_OPTIONS } from '../../shared/categories';

function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

interface SiteWithTime {
  domain: string;
  time: number;
  category: string;
}

// Category Modal Component
interface CategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string, color: string) => void;
  pendingDomain: string | null;
  editingCategory?: CustomCategory | null;
  editingBuiltInId?: string | null;
  builtInOverrides?: Record<string, string>;
}

function CategoryModal({ isOpen, onClose, onSave, pendingDomain, editingCategory, editingBuiltInId, builtInOverrides = {} }: CategoryModalProps) {
  const [name, setName] = useState('');
  const [color, setColor] = useState(CATEGORY_COLOR_OPTIONS[0]);

  // Determine if editing a built-in category (name only)
  const isEditingBuiltIn = !!editingBuiltInId;
  const builtInInfo = editingBuiltInId ? CATEGORIES.find(c => c.id === editingBuiltInId) : null;

  useEffect(() => {
    if (editingCategory) {
      setName(editingCategory.name);
      setColor(editingCategory.color);
    } else if (editingBuiltInId && builtInInfo) {
      // Use override name if exists, otherwise original name
      setName(builtInOverrides[editingBuiltInId] || builtInInfo.name);
      setColor(builtInInfo.color);
    } else {
      setName('');
      setColor(CATEGORY_COLOR_OPTIONS[Math.floor(Math.random() * CATEGORY_COLOR_OPTIONS.length)]);
    }
  }, [editingCategory, editingBuiltInId, builtInInfo, builtInOverrides, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onSave(name.trim(), color);
      onClose();
    }
  };

  const isEditing = editingCategory || editingBuiltInId;
  const modalTitle = isEditing ? 'Edit category' : 'New category';
  const submitLabel = isEditing ? 'Save changes' : 'Create category';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-md mx-4 shadow-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {modalTitle}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {pendingDomain && (
            <div className="bg-blue-50 dark:bg-blue-900/30 px-4 py-3 rounded-lg text-sm text-blue-700 dark:text-blue-300">
              Creating category for: <strong>{pendingDomain}</strong>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Category name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={isEditingBuiltIn && builtInInfo ? builtInInfo.name : "e.g., Work Tools, Gaming"}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
              autoFocus
            />
            {isEditingBuiltIn && builtInInfo && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Original name: {builtInInfo.name}
              </p>
            )}
          </div>

          {/* Only show color picker for custom categories */}
          {!isEditingBuiltIn && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Color
              </label>
              <div className="grid grid-cols-9 gap-2">
                {CATEGORY_COLOR_OPTIONS.map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={`w-7 h-7 rounded-full ${c} transition-transform ${
                      color === c ? 'ring-2 ring-offset-2 ring-blue-500 scale-110' : 'hover:scale-105'
                    }`}
                  />
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              {submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Categories() {
  const [allStats, setAllStats] = useState<Record<string, DailyStats>>({});
  const [domainCategories, setDomainCategories] = useState<Record<string, string>>({});
  const [customCategories, setCustomCategories] = useState<CustomCategory[]>([]);
  const [builtInOverrides, setBuiltInOverrides] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [pendingDomain, setPendingDomain] = useState<string | null>(null);
  const [editingCategory, setEditingCategory] = useState<CustomCategory | null>(null);
  const [editingBuiltInId, setEditingBuiltInId] = useState<string | null>(null);

  // Collapsed state for categories
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());

  // Category order (stores all category IDs in display order, except 'other' which is always last)
  const [categoryOrder, setCategoryOrder] = useState<string[]>([]);

  // Selection mode for bulk operations
  const [selectMode, setSelectMode] = useState(false);
  const [selectedSites, setSelectedSites] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadData();
  }, []);

  // Initialize category order when data loads
  useEffect(() => {
    if (!loading && categoryOrder.length === 0) {
      const builtInIds = CATEGORIES.filter(c => c.id !== 'other').map(c => c.id as string);
      const customIds = customCategories.sort((a, b) => a.order - b.order).map(c => c.id);
      setCategoryOrder([...builtInIds, ...customIds]);
    }
  }, [loading, customCategories, categoryOrder.length]);

  function toggleCollapse(categoryId: string) {
    setCollapsedCategories(prev => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  }

  function toggleExpandCollapseAll() {
    const allCategoryIds = [...categoryOrder, 'other'];
    const allCollapsed = allCategoryIds.every(id => collapsedCategories.has(id));
    if (allCollapsed) {
      // Expand all
      setCollapsedCategories(new Set());
    } else {
      // Collapse all
      setCollapsedCategories(new Set(allCategoryIds));
    }
  }

  function toggleSiteSelection(domain: string) {
    setSelectedSites(prev => {
      const next = new Set(prev);
      if (next.has(domain)) {
        next.delete(domain);
      } else {
        next.add(domain);
      }
      return next;
    });
  }

  function toggleSelectAll(sites: SiteWithTime[]) {
    const allSelected = sites.every(s => selectedSites.has(s.domain));
    if (allSelected) {
      // Deselect all
      setSelectedSites(prev => {
        const next = new Set(prev);
        sites.forEach(s => next.delete(s.domain));
        return next;
      });
    } else {
      // Select all
      setSelectedSites(prev => {
        const next = new Set(prev);
        sites.forEach(s => next.add(s.domain));
        return next;
      });
    }
  }

  function exitSelectMode() {
    setSelectMode(false);
    setSelectedSites(new Set());
  }

  async function moveSelectedToCategory(targetCategoryId: string) {
    const domains = Array.from(selectedSites);
    if (domains.length === 0) return;

    for (const domain of domains) {
      const normalizedDomain = domain.replace(/^www\./, '');
      const defaultCategory = DEFAULT_DOMAIN_CATEGORIES[normalizedDomain] || DEFAULT_DOMAIN_CATEGORIES[domain] || 'other';
      const categoryToSet = targetCategoryId === defaultCategory ? null : targetCategoryId;

      await chrome.runtime.sendMessage({
        type: 'SET_DOMAIN_CATEGORY',
        payload: { domain, category: categoryToSet },
      });

      setDomainCategories(prev => {
        if (categoryToSet === null) {
          const { [domain]: _, [normalizedDomain]: __, ...rest } = prev;
          return rest;
        }
        return { ...prev, [domain]: categoryToSet };
      });
    }

    exitSelectMode();
  }

  async function loadData() {
    try {
      const [stats, categories, custom, overrides] = await Promise.all([
        chrome.runtime.sendMessage({ type: 'GET_STATS' }),
        chrome.runtime.sendMessage({ type: 'GET_DOMAIN_CATEGORIES' }),
        chrome.runtime.sendMessage({ type: 'GET_CUSTOM_CATEGORIES' }),
        chrome.runtime.sendMessage({ type: 'GET_BUILTIN_CATEGORY_OVERRIDES' }),
      ]);
      setAllStats(stats || {});
      setDomainCategories(categories || {});
      setCustomCategories(custom || []);
      setBuiltInOverrides(overrides || {});
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  }

  // Handle creating a new category
  async function handleCreateCategory(name: string, color: string) {
    const newCategory = await chrome.runtime.sendMessage({
      type: 'ADD_CUSTOM_CATEGORY',
      payload: { name, color, order: customCategories.length },
    });

    setCustomCategories(prev => [...prev, newCategory]);
    setCategoryOrder(prev => [...prev, newCategory.id]);

    // If there's a pending domain, assign it to the new category
    if (pendingDomain) {
      await chrome.runtime.sendMessage({
        type: 'SET_DOMAIN_CATEGORY',
        payload: { domain: pendingDomain, category: newCategory.id },
      });
      setDomainCategories(prev => ({ ...prev, [pendingDomain]: newCategory.id }));
      setPendingDomain(null);
    }
  }

  // Handle updating an existing custom category
  async function handleUpdateCategory(name: string, color: string) {
    if (!editingCategory) return;

    const updated: CustomCategory = { ...editingCategory, name, color };
    await chrome.runtime.sendMessage({
      type: 'UPDATE_CUSTOM_CATEGORY',
      payload: updated,
    });

    setCustomCategories(prev => prev.map(c => c.id === updated.id ? updated : c));
    setEditingCategory(null);
  }

  // Handle updating a built-in category name
  async function handleUpdateBuiltInName(name: string) {
    if (!editingBuiltInId) return;

    // If name is empty or matches original, clear the override
    const original = CATEGORIES.find(c => c.id === editingBuiltInId);
    const nameToSet = name.trim() === '' || name.trim() === original?.name ? null : name.trim();

    await chrome.runtime.sendMessage({
      type: 'UPDATE_BUILTIN_CATEGORY_NAME',
      payload: { id: editingBuiltInId, name: nameToSet },
    });

    setBuiltInOverrides(prev => {
      if (nameToSet === null) {
        const { [editingBuiltInId]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [editingBuiltInId]: nameToSet };
    });
    setEditingBuiltInId(null);
  }

  // Handle save from modal (routes to create or update)
  function handleModalSave(name: string, color: string) {
    if (editingCategory) {
      handleUpdateCategory(name, color);
    } else if (editingBuiltInId) {
      handleUpdateBuiltInName(name);
    } else {
      handleCreateCategory(name, color);
    }
  }

  // Handle deleting a custom category
  async function handleDeleteCategory(categoryId: string) {
    await chrome.runtime.sendMessage({
      type: 'DELETE_CUSTOM_CATEGORY',
      payload: { id: categoryId },
    });

    setCustomCategories(prev => prev.filter(c => c.id !== categoryId));
    setCategoryOrder(prev => prev.filter(id => id !== categoryId));

    // Clear domain overrides that point to this category
    setDomainCategories(prev => {
      const updated: Record<string, string> = {};
      for (const [domain, cat] of Object.entries(prev)) {
        if (cat !== categoryId) {
          updated[domain] = cat;
        }
      }
      return updated;
    });
  }

  // Handle drag end
  async function handleDragEnd(result: DropResult) {
    const { source, destination, draggableId, type } = result;

    // Dropped outside a valid droppable
    if (!destination) return;

    // Handle category reordering
    if (type === 'category') {
      if (source.index === destination.index) return;

      const reordered = Array.from(categoryOrder);
      const [moved] = reordered.splice(source.index, 1);
      reordered.splice(destination.index, 0, moved);
      setCategoryOrder(reordered);
      return;
    }

    // Handle site moving between categories
    // Dropped in the same place
    if (source.droppableId === destination.droppableId) return;

    const domain = draggableId;
    const targetCategory = destination.droppableId;

    // Handle drop on "new-category" zone
    if (targetCategory === 'new-category') {
      setPendingDomain(domain);
      setShowModal(true);
      return;
    }

    // Get the default category for this domain
    const normalizedDomain = domain.replace(/^www\./, '');
    const defaultCategory = DEFAULT_DOMAIN_CATEGORIES[normalizedDomain] || DEFAULT_DOMAIN_CATEGORIES[domain] || 'other';

    // If moving to the default category, clear the override
    // Otherwise, set the override
    const categoryToSet = targetCategory === defaultCategory ? null : targetCategory;

    // Update backend
    await chrome.runtime.sendMessage({
      type: 'SET_DOMAIN_CATEGORY',
      payload: { domain, category: categoryToSet },
    });

    // Update local state
    setDomainCategories(prev => {
      if (categoryToSet === null) {
        const { [domain]: _, [normalizedDomain]: __, ...rest } = prev;
        return rest;
      }
      return { ...prev, [domain]: categoryToSet };
    });
  }

  // Aggregate site times across all stats
  const siteTotals: Record<string, number> = {};
  for (const stats of Object.values(allStats)) {
    for (const [domain, time] of Object.entries(stats.sites || {})) {
      siteTotals[domain] = (siteTotals[domain] || 0) + time;
    }
  }

  // Create sites with time and category
  const sitesWithTime: SiteWithTime[] = Object.entries(siteTotals).map(([domain, time]) => ({
    domain,
    time,
    category: getCategoryForDomain(domain, domainCategories),
  }));

  // Group sites by category
  const sitesByCategory = new Map<string, SiteWithTime[]>();

  // Initialize with built-in categories (except 'other')
  for (const cat of CATEGORIES) {
    if (cat.id !== 'other') {
      sitesByCategory.set(cat.id as string, []);
    }
  }

  // Add custom categories
  for (const cat of customCategories.sort((a, b) => a.order - b.order)) {
    sitesByCategory.set(cat.id, []);
  }

  // 'other' category always last
  sitesByCategory.set('other', []);

  // Populate sites into categories
  for (const site of sitesWithTime) {
    const existing = sitesByCategory.get(site.category);
    if (existing) {
      existing.push(site);
    } else {
      // Unknown category (e.g., deleted custom category) - put in 'other'
      sitesByCategory.get('other')!.push(site);
    }
  }

  // Sort sites within each category by time (descending)
  for (const sites of sitesByCategory.values()) {
    sites.sort((a, b) => b.time - a.time);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Full display order: reorderable categories + 'other' at the end
  const displayOrder = [...categoryOrder, 'other'];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Categories</h1>
        <div className="flex items-center gap-2">
          {(() => {
            const allCollapsed = categoryOrder.length > 0 && [...categoryOrder, 'other'].every(id => collapsedCategories.has(id));
            return (
              <button
                onClick={toggleExpandCollapseAll}
                className="flex items-center gap-1.5 px-3 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors text-sm"
              >
                <ChevronRight className={`w-4 h-4 transition-transform duration-200 ${allCollapsed ? '' : 'rotate-90'}`} />
                <span className="w-[85px]">{allCollapsed ? 'Expand all' : 'Collapse all'}</span>
              </button>
            );
          })()}
          {selectMode ? (
            <>
              <button
                onClick={exitSelectMode}
                className="flex items-center gap-2 px-3 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              {selectedSites.size > 0 && (
                <div className="relative">
                  <select
                    onChange={(e) => {
                      if (e.target.value) {
                        moveSelectedToCategory(e.target.value);
                      }
                    }}
                    value=""
                    className="appearance-none pl-3 pr-8 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors cursor-pointer text-sm font-medium"
                  >
                    <option value="" disabled>Move {selectedSites.size} site{selectedSites.size !== 1 ? 's' : ''} to...</option>
                    {displayOrder.map(catId => {
                      const info = getCategoryInfoWithOverrides(catId, customCategories, builtInOverrides);
                      return (
                        <option key={catId} value={catId} className="text-gray-900">
                          {info.name}
                        </option>
                      );
                    })}
                  </select>
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
                    <ChevronRight className="w-4 h-4 rotate-90" />
                  </div>
                </div>
              )}
            </>
          ) : (
            <button
              onClick={() => setSelectMode(true)}
              className="flex items-center gap-2 px-3 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              title="Select sites to move"
            >
              <CheckSquare className="w-4 h-4" />
              Select
            </button>
          )}
          <button
            onClick={() => {
              setPendingDomain(null);
              setEditingCategory(null);
              setEditingBuiltInId(null);
              setShowModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add category
          </button>
        </div>
      </div>

      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
        {selectMode
          ? "Click sites to select them, then choose a category to move them to."
          : "Drag categories to reorder. Click to expand/collapse. Drag sites between categories."
        }
      </p>

      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="categories" type="category">
          {(provided) => (
            <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-4">
              {displayOrder.map((categoryId, index) => {
                const sites = sitesByCategory.get(categoryId) || [];
                const info = getCategoryInfoWithOverrides(categoryId, customCategories, builtInOverrides);
                const isCustom = !isBuiltInCategory(categoryId);
                const isOther = categoryId === 'other';
                const totalTime = sites.reduce((sum, s) => sum + s.time, 0);
                const isCollapsed = collapsedCategories.has(categoryId);

                const categoryContent = (dragHandleProps?: React.HTMLAttributes<HTMLDivElement>, isDraggingOver?: boolean) => (
                  <div className={`bg-white dark:bg-gray-800 rounded-xl border overflow-hidden transition-colors ${
                    isDraggingOver && isCollapsed
                      ? 'border-blue-500 ring-2 ring-blue-500/50'
                      : 'border-gray-200 dark:border-gray-700'
                  }`}>
                    {/* Category Header */}
                    <div className={`flex items-center gap-2 px-4 py-3 transition-colors ${
                      isDraggingOver && isCollapsed
                        ? 'bg-blue-50 dark:bg-blue-900/30'
                        : 'bg-gray-50 dark:bg-gray-700/50'
                    } ${isCollapsed ? '' : 'border-b border-gray-200 dark:border-gray-700'}`}>
                      {!isOther && (
                        <div {...dragHandleProps} className="text-gray-300 dark:text-gray-600 hover:text-gray-500 dark:hover:text-gray-400 cursor-grab">
                          <GripVertical className="w-4 h-4" />
                        </div>
                      )}
                      <div
                        className="flex items-center gap-3 flex-1 cursor-pointer"
                        onClick={() => toggleCollapse(categoryId)}
                      >
                        <span className="text-gray-500 dark:text-gray-400">
                          <ChevronRight className={`w-5 h-5 transition-transform duration-200 ${isCollapsed ? '' : 'rotate-90'}`} />
                        </span>
                        <div className={`w-3 h-3 rounded-full ${info.color}`} />
                        <span className="font-medium text-gray-900 dark:text-gray-100">{info.name}</span>
                        {!isCustom && (
                          <span className="text-xs text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-600 px-1.5 py-0.5 rounded">
                            default
                          </span>
                        )}
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          {sites.length} site{sites.length !== 1 ? 's' : ''} · {formatTime(totalTime)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        {selectMode && sites.length > 0 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleSelectAll(sites);
                            }}
                            className="p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition-colors"
                            title={sites.every(s => selectedSites.has(s.domain)) ? "Deselect all in category" : "Select all in category"}
                          >
                            {sites.every(s => selectedSites.has(s.domain)) ? (
                              <CheckSquare className="w-4 h-4" />
                            ) : sites.some(s => selectedSites.has(s.domain)) ? (
                              <div className="w-4 h-4 border-2 border-current rounded flex items-center justify-center">
                                <div className="w-2 h-0.5 bg-current" />
                              </div>
                            ) : (
                              <Square className="w-4 h-4" />
                            )}
                          </button>
                        )}
                        {!selectMode && (
                          <>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (isCustom) {
                                  const customCat = customCategories.find(c => c.id === categoryId);
                                  if (customCat) {
                                    setEditingCategory(customCat);
                                    setEditingBuiltInId(null);
                                    setPendingDomain(null);
                                    setShowModal(true);
                                  }
                                } else {
                                  setEditingBuiltInId(categoryId);
                                  setEditingCategory(null);
                                  setPendingDomain(null);
                                  setShowModal(true);
                                }
                              }}
                              className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                              title={isCustom ? "Edit category" : "Rename category"}
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            {isCustom && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteCategory(categoryId);
                                }}
                                className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                                title="Delete category"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>

                    {/* Collapsible Sites List */}
                    <div
                      className="grid transition-all duration-200 ease-in-out"
                      style={{ gridTemplateRows: isCollapsed ? '0fr' : '1fr' }}
                    >
                      <div className="overflow-hidden">
                        <div className={`p-2 min-h-[48px] transition-colors ${
                          isDraggingOver && !isCollapsed ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                        }`}>
                          {sites.length === 0 ? (
                            <div className="text-center py-4 text-sm text-gray-400 dark:text-gray-500">
                              {categoryId === 'other'
                                ? 'No uncategorized sites'
                                : 'Drag sites here to add them to this category'}
                            </div>
                          ) : (
                            <div className="space-y-1">
                              {sites.map((site, siteIndex) => (
                                <Draggable key={site.domain} draggableId={site.domain} index={siteIndex} isDragDisabled={selectMode}>
                                  {(provided, snapshot) => {
                                    const isSelected = selectedSites.has(site.domain);
                                    return (
                                      <div
                                        ref={provided.innerRef}
                                        {...provided.draggableProps}
                                        {...(selectMode ? {} : provided.dragHandleProps)}
                                        onClick={selectMode ? () => toggleSiteSelection(site.domain) : undefined}
                                        className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors group ${
                                          selectMode ? 'cursor-pointer' : 'cursor-grab'
                                        } ${
                                          snapshot.isDragging
                                            ? 'bg-white dark:bg-gray-700 shadow-lg ring-2 ring-blue-500'
                                            : isSelected
                                            ? 'bg-blue-50 dark:bg-blue-900/30 ring-1 ring-blue-500'
                                            : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                                        }`}
                                      >
                                        {selectMode ? (
                                          <div className="text-blue-600 dark:text-blue-400">
                                            {isSelected ? (
                                              <CheckSquare className="w-4 h-4" />
                                            ) : (
                                              <Square className="w-4 h-4" />
                                            )}
                                          </div>
                                        ) : (
                                          <div
                                            className={`text-gray-300 dark:text-gray-600 ${
                                              snapshot.isDragging ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                                            } transition-opacity`}
                                          >
                                            <GripVertical className="w-4 h-4" />
                                          </div>
                                        )}
                                        <span className="flex-1 text-sm text-gray-700 dark:text-gray-300 truncate">
                                          {site.domain}
                                        </span>
                                        <span className="text-sm text-gray-500 dark:text-gray-400">
                                          {formatTime(site.time)}
                                        </span>
                                      </div>
                                    );
                                  }}
                                </Draggable>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );

                // Wrap with Droppable for sites - wraps entire category so drops work when collapsed
                const wrappedContent = (categoryDragHandleProps?: React.HTMLAttributes<HTMLDivElement>) => (
                  <Droppable droppableId={categoryId} type="site">
                    {(provided, snapshot) => (
                      <div ref={provided.innerRef} {...provided.droppableProps}>
                        {categoryContent(categoryDragHandleProps, snapshot.isDraggingOver)}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                );

                // 'other' category is not draggable for reordering
                if (isOther) {
                  return <div key={categoryId}>{wrappedContent()}</div>;
                }

                return (
                  <Draggable key={categoryId} draggableId={`category-${categoryId}`} index={index}>
                    {(provided) => (
                      <div ref={provided.innerRef} {...provided.draggableProps}>
                        {wrappedContent(provided.dragHandleProps || undefined)}
                      </div>
                    )}
                  </Draggable>
                );
              })}
              {provided.placeholder}
            </div>
          )}
        </Droppable>

        {/* New Category Drop Zone */}
        <Droppable droppableId="new-category" type="site">
          {(provided, snapshot) => (
            <div
              ref={provided.innerRef}
              {...provided.droppableProps}
              className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors mt-4 ${
                snapshot.isDraggingOver
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-300 dark:border-gray-600'
              }`}
            >
              <Plus className={`w-8 h-8 mx-auto mb-2 ${
                snapshot.isDraggingOver ? 'text-blue-500' : 'text-gray-400'
              }`} />
              <p className={`text-sm font-medium ${
                snapshot.isDraggingOver ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'
              }`}>
                Drop here to create new category
              </p>
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>

      {/* Category Modal */}
      <CategoryModal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setPendingDomain(null);
          setEditingCategory(null);
          setEditingBuiltInId(null);
        }}
        onSave={handleModalSave}
        pendingDomain={pendingDomain}
        editingCategory={editingCategory}
        editingBuiltInId={editingBuiltInId}
        builtInOverrides={builtInOverrides}
      />
    </div>
  );
}
