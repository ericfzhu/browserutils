import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Calendar, Clock, TrendingDown, TrendingUp, ChevronLeft, ChevronRight, ChevronDown, Layers, Youtube } from 'lucide-react';
import { DailyStats, SiteSession, Settings, ActiveYouTubeSession } from '../../shared/types';
import { CATEGORIES, getCategoryForDomain, getCategoryInfo } from '../../shared/categories';
import { computeYouTubeStatsWithUrls } from '../../shared/storage';

function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatTimeOfDay(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function getDateString(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function formatDateLabel(dateStr: string): string {
  const today = getDateString(new Date());
  const yesterday = getDateString(new Date(Date.now() - 86400000));

  if (dateStr === today) return 'Today';
  if (dateStr === yesterday) return 'Yesterday';

  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

// Generate a consistent color based on domain name
function getDomainColor(domain: string): string {
  const colors = [
    'bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-orange-500',
    'bg-pink-500', 'bg-teal-500', 'bg-indigo-500', 'bg-red-500',
    'bg-cyan-500', 'bg-amber-500', 'bg-lime-500', 'bg-emerald-500',
  ];
  let hash = 0;
  for (let i = 0; i < domain.length; i++) {
    hash = domain.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

// Colors for domain breakdown chart
const DOMAIN_COLORS = [
  'bg-blue-500',
  'bg-indigo-500',
  'bg-purple-500',
  'bg-pink-500',
  'bg-red-500',
  'bg-orange-500',
  'bg-yellow-500',
  'bg-green-500',
  'bg-teal-500',
  'bg-cyan-500',
];

// Date Range Picker Component
interface DateRangePickerProps {
  startDate: string | null;
  endDate: string | null;
  onSelectRange: (start: string, end: string) => void;
  onClose: () => void;
}

function DateRangePicker({ startDate, endDate, onSelectRange, onClose }: DateRangePickerProps) {
  const [localStartDate, setLocalStartDate] = useState(startDate || getDateString(new Date()));
  const [localEndDate, setLocalEndDate] = useState(endDate || getDateString(new Date()));
  const [selectingStart, setSelectingStart] = useState(true);
  const [viewDate, setViewDate] = useState(() => {
    const d = new Date((startDate || getDateString(new Date())) + 'T00:00:00');
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  const today = getDateString(new Date());

  const daysInMonth = new Date(viewDate.year, viewDate.month + 1, 0).getDate();
  const firstDayOfMonth = new Date(viewDate.year, viewDate.month, 1).getDay();

  const days: (number | null)[] = [];
  for (let i = 0; i < firstDayOfMonth; i++) days.push(null);
  for (let i = 1; i <= daysInMonth; i++) days.push(i);

  const prevMonth = () => {
    setViewDate(v => {
      if (v.month === 0) return { year: v.year - 1, month: 11 };
      return { ...v, month: v.month - 1 };
    });
  };

  const nextMonth = () => {
    setViewDate(v => {
      if (v.month === 11) return { year: v.year + 1, month: 0 };
      return { ...v, month: v.month + 1 };
    });
  };

  const monthName = new Date(viewDate.year, viewDate.month).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const handleDayClick = (day: number) => {
    const dateStr = `${viewDate.year}-${String(viewDate.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    if (dateStr > today) return;

    if (selectingStart) {
      setLocalStartDate(dateStr);
      if (dateStr > localEndDate) {
        setLocalEndDate(dateStr);
      }
      setSelectingStart(false);
    } else {
      if (dateStr < localStartDate) {
        setLocalStartDate(dateStr);
      } else {
        setLocalEndDate(dateStr);
      }
      setSelectingStart(true);
    }
  };

  const isInRange = (dateStr: string) => {
    return dateStr >= localStartDate && dateStr <= localEndDate;
  };

  // Preset handlers
  const setWeekToDate = () => {
    const todayDate = new Date();
    const dayOfWeek = todayDate.getDay();
    const startOfWeek = new Date(todayDate);
    startOfWeek.setDate(todayDate.getDate() - dayOfWeek);
    setLocalStartDate(getDateString(startOfWeek));
    setLocalEndDate(today);
  };

  const setMonthToDate = () => {
    const todayDate = new Date();
    const startOfMonth = new Date(todayDate.getFullYear(), todayDate.getMonth(), 1);
    setLocalStartDate(getDateString(startOfMonth));
    setLocalEndDate(today);
  };

  const setLast7Days = () => {
    const todayDate = new Date();
    const weekAgo = new Date(todayDate);
    weekAgo.setDate(todayDate.getDate() - 6);
    setLocalStartDate(getDateString(weekAgo));
    setLocalEndDate(today);
  };

  const setLast30Days = () => {
    const todayDate = new Date();
    const monthAgo = new Date(todayDate);
    monthAgo.setDate(todayDate.getDate() - 29);
    setLocalStartDate(getDateString(monthAgo));
    setLocalEndDate(today);
  };

  return (
    <div className="absolute top-full right-0 mt-2 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-4 z-50 w-80">
      {/* Selection indicator */}
      <div className="flex items-center justify-between mb-3 text-sm">
        <button
          onClick={() => setSelectingStart(true)}
          className={`px-3 py-1.5 rounded-lg transition-colors ${selectingStart ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300' : 'bg-gray-100 dark:bg-gray-700'}`}
        >
          {formatDateLabel(localStartDate)}
        </button>
        <span className="text-gray-400">→</span>
        <button
          onClick={() => setSelectingStart(false)}
          className={`px-3 py-1.5 rounded-lg transition-colors ${!selectingStart ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300' : 'bg-gray-100 dark:bg-gray-700'}`}
        >
          {formatDateLabel(localEndDate)}
        </button>
      </div>

      {/* Calendar */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={prevMonth} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <span className="font-medium">{monthName}</span>
        <button onClick={nextMonth} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs text-gray-500 dark:text-gray-400 mb-2">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => <div key={d}>{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((day, idx) => {
          if (day === null) return <div key={idx} />;
          const dateStr = `${viewDate.year}-${String(viewDate.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const isSelected = dateStr === localStartDate || dateStr === localEndDate;
          const isRangeDate = isInRange(dateStr);
          const isToday = dateStr === today;
          const isDisabled = dateStr > today;

          return (
            <button
              key={idx}
              onClick={() => !isDisabled && handleDayClick(day)}
              disabled={isDisabled}
              className={`p-2 text-sm rounded-lg transition-colors ${
                isSelected
                  ? 'bg-blue-600 text-white'
                  : isRangeDate
                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                  : isToday
                  ? 'bg-gray-200 dark:bg-gray-600'
                  : isDisabled
                  ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
                  : 'hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              {day}
            </button>
          );
        })}
      </div>

      {/* Presets */}
      <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t dark:border-gray-700">
        <button onClick={setWeekToDate} className="h-7 px-3 text-xs bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors">Week to date</button>
        <button onClick={setMonthToDate} className="h-7 px-3 text-xs bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors">Month to date</button>
        <button onClick={setLast7Days} className="h-7 px-3 text-xs bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors">Last 7 days</button>
        <button onClick={setLast30Days} className="h-7 px-3 text-xs bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors">Last 30 days</button>
      </div>

      {/* Actions */}
      <div className="flex justify-between mt-4 pt-4 border-t dark:border-gray-700">
        <button
          onClick={onClose}
          className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
        >
          Cancel
        </button>
        <button
          onClick={() => {
            onSelectRange(localStartDate, localEndDate);
            onClose();
          }}
          className="text-sm text-blue-600 hover:text-blue-700 font-medium"
        >
          Apply
        </button>
      </div>
    </div>
  );
}

// Full Timeline Component with animations
interface TimelineProps {
  sessions: SiteSession[];
  sites: Record<string, number>;
  startDate: string;
  endDate: string;
  animationDirection: 'left' | 'right' | null;
}

function Timeline({ sessions, sites, startDate, endDate, animationDirection }: TimelineProps) {
  const [expanded, setExpanded] = useState(false);
  const INITIAL_DISPLAY = 10;

  const today = getDateString(new Date());
  const isMultiDay = startDate !== endDate;
  const isSingleDayToday = !isMultiDay && startDate === today;

  const sortedSites = Object.entries(sites).sort((a, b) => b[1] - a[1]);
  const hasMore = sortedSites.length > INITIAL_DISPLAY;

  // Animation classes
  const animationClass = animationDirection
    ? animationDirection === 'left'
      ? 'animate-slide-in-left'
      : 'animate-slide-in-right'
    : '';

  if (sortedSites.length === 0 && sessions.length === 0) {
    return (
      <div className={`text-center py-8 text-gray-500 dark:text-gray-400 ${animationClass}`}>
        {isSingleDayToday ? 'No activity recorded yet today' : 'No activity recorded for this period'}
      </div>
    );
  }

  // Calculate the full time range based on start and end dates
  const rangeStart = new Date(startDate + 'T00:00:00');
  const rangeEnd = new Date(endDate + 'T23:59:59');

  // For single day, find actual session bounds; for multi-day, use full range
  let minTime: number;
  let maxTime: number;

  if (isMultiDay) {
    // Use full date range
    minTime = rangeStart.getTime();
    maxTime = rangeEnd.getTime();
  } else {
    // Single day - find actual time range from sessions
    minTime = rangeEnd.getTime();
    maxTime = rangeStart.getTime();
    sessions.forEach(s => {
      minTime = Math.min(minTime, s.startTime);
      maxTime = Math.max(maxTime, s.endTime);
    });

    // Add 30 min padding for single day
    minTime = Math.max(rangeStart.getTime(), minTime - 30 * 60 * 1000);
    maxTime = Math.min(rangeEnd.getTime(), maxTime + 30 * 60 * 1000);

    // If no sessions, show 8am to current time (for today) or 8am-6pm (for past days)
    if (sessions.length === 0) {
      minTime = rangeStart.getTime() + 8 * 60 * 60 * 1000;
      maxTime = isSingleDayToday ? Date.now() : rangeStart.getTime() + 18 * 60 * 60 * 1000;
    }
  }

  const timeRange = Math.max(maxTime - minTime, 1);

  // Group and merge overlapping sessions by domain
  const sessionsByDomain = new Map<string, { start: number; end: number }[]>();
  sessions.forEach(session => {
    const existing = sessionsByDomain.get(session.domain) || [];
    existing.push({ start: session.startTime, end: session.endTime });
    sessionsByDomain.set(session.domain, existing);
  });

  // Merge overlapping intervals for each domain
  for (const [domain, intervals] of sessionsByDomain) {
    if (intervals.length <= 1) continue;
    intervals.sort((a, b) => a.start - b.start);
    const merged: { start: number; end: number }[] = [intervals[0]];
    for (let i = 1; i < intervals.length; i++) {
      const last = merged[merged.length - 1];
      const current = intervals[i];
      if (current.start <= last.end) {
        last.end = Math.max(last.end, current.end);
      } else {
        merged.push(current);
      }
    }
    sessionsByDomain.set(domain, merged);
  }

  // Generate time markers - hours for single day, days for multi-day
  // Limit to ~8-10 markers max to avoid crowding
  const MAX_MARKERS = 8;
  const timeMarkers: { label: string; position: number }[] = [];

  if (isMultiDay) {
    // Calculate total days in range
    const totalDays = Math.ceil((rangeEnd.getTime() - rangeStart.getTime()) / (1000 * 60 * 60 * 24));
    const dayInterval = Math.max(1, Math.ceil(totalDays / MAX_MARKERS));

    let currentDay = new Date(rangeStart);
    let dayCount = 0;
    while (currentDay <= rangeEnd) {
      if (dayCount % dayInterval === 0) {
        const dayTime = currentDay.getTime();
        const position = ((dayTime - minTime) / timeRange) * 100;
        timeMarkers.push({
          label: currentDay.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          position,
        });
      }
      currentDay.setDate(currentDay.getDate() + 1);
      dayCount++;
    }
  } else {
    // Show hour markers for single day
    const startHour = new Date(minTime).getHours();
    const endHour = new Date(maxTime).getHours();
    const totalHours = endHour - startHour + 1;
    const hourInterval = Math.max(1, Math.ceil(totalHours / MAX_MARKERS));

    for (let h = startHour; h <= endHour; h++) {
      if ((h - startHour) % hourInterval === 0) {
        const markerTime = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), rangeStart.getDate(), h, 0, 0).getTime();
        if (markerTime >= minTime && markerTime <= maxTime) {
          const position = ((markerTime - minTime) / timeRange) * 100;
          timeMarkers.push({
            label: h === 0 ? '12am' : h < 12 ? `${h}am` : h === 12 ? '12pm' : `${h - 12}pm`,
            position,
          });
        }
      }
    }
  }

  if (sortedSites.length > 0 && sessions.length === 0) {
    return (
      <div className={`text-center py-8 text-gray-500 dark:text-gray-400 ${animationClass}`}>
        <p>Timeline data not available for this day.</p>
        <p className="text-xs mt-2">Session tracking was enabled recently.</p>
      </div>
    );
  }

  return (
    <div className={animationClass}>
      <div className="relative h-6 mb-2 ml-40">
        {timeMarkers.map((marker, idx) => (
          <div
            key={idx}
            className="absolute text-xs text-gray-400"
            style={{ left: `${marker.position}%`, transform: 'translateX(-50%)' }}
          >
            {marker.label}
          </div>
        ))}
      </div>

      <div className={`space-y-2 max-h-[450px] transition-all duration-300 overflow-hidden ${expanded ? 'overflow-y-auto' : ''}`}>
        {sortedSites.map(([domain, totalTime]) => {
          const domainIntervals = sessionsByDomain.get(domain) || [];
          const color = getDomainColor(domain);
          // Check if original sessions had multiple windows
          const originalSessions = sessions.filter(s => s.domain === domain);
          const windowIds = new Set(originalSessions.map(s => s.windowId));
          const hasMultipleWindows = windowIds.size > 1;

          return (
            <div key={domain} className="flex items-center gap-3">
              <div className="w-36 flex-shrink-0">
                <div className="flex items-center gap-1">
                  <a
                    href={`https://${domain}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium truncate hover:text-blue-600 hover:underline"
                    title={domain}
                  >
                    {domain.replace(/^www\./, '')}
                  </a>
                  {hasMultipleWindows && (
                    <span title="Multiple windows">
                      <Layers className="w-3 h-3 text-gray-400 flex-shrink-0" />
                    </span>
                  )}
                </div>
                <span className="text-xs text-gray-500">{formatTime(totalTime)}</span>
              </div>

              <div className="flex-1 relative h-6 bg-gray-100 dark:bg-gray-700 rounded overflow-hidden">
                {timeMarkers.map((marker, idx) => (
                  <div
                    key={idx}
                    className="absolute top-0 bottom-0 w-px bg-gray-200 dark:bg-gray-600"
                    style={{ left: `${marker.position}%` }}
                  />
                ))}

                {domainIntervals.map((interval, idx) => {
                  const startPos = Math.max(0, ((interval.start - minTime) / timeRange) * 100);
                  const endPos = Math.min(100, ((interval.end - minTime) / timeRange) * 100);
                  const width = Math.max(0.5, endPos - startPos);

                  return (
                    <div
                      key={idx}
                      className={`absolute top-1 bottom-1 ${color} rounded-sm opacity-80 hover:opacity-100 transition-opacity cursor-default`}
                      style={{ left: `${startPos}%`, width: `${width}%` }}
                      title={isMultiDay
                        ? `${new Date(interval.start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} ${formatTimeOfDay(interval.start)} - ${formatTimeOfDay(interval.end)}`
                        : `${formatTimeOfDay(interval.start)} - ${formatTimeOfDay(interval.end)}`
                      }
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {hasMore && (
        <div className="mt-4 flex justify-center h-5">
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center gap-1.5"
          >
            <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
            <span className="w-14">{expanded ? 'Collapse' : 'Expand'}</span>
          </button>
        </div>
      )}
    </div>
  );
}

export default function Metrics() {
  const [allStats, setAllStats] = useState<Record<string, DailyStats>>({});
  const [loading, setLoading] = useState(true);
  const [hoveredSegment, setHoveredSegment] = useState<{ date: string; domain: string; time: number; percent: number } | null>(null);
  const [domainCategories, setDomainCategories] = useState<Record<string, string>>({});
  const [settings, setSettings] = useState<Settings | null>(null);
  const [activeYoutubeSessions, setActiveYoutubeSessions] = useState<Record<number, ActiveYouTubeSession>>({});

  // Unified date range state
  const today = getDateString(new Date());
  const [dateRangeStart, setDateRangeStart] = useState(() => {
    // Default to last 7 days (week)
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 6);
    return getDateString(weekAgo);
  });
  const [dateRangeEnd, setDateRangeEnd] = useState(() => today);
  const [showDateRangePicker, setShowDateRangePicker] = useState(false);
  const [youtubeExpanded, setYoutubeExpanded] = useState(false);

  // Detect which period preset matches the current date range
  const detectPeriod = (start: string, end: string): 'day' | 'week' | 'month' | 'custom' => {
    if (end !== today) return 'custom';

    const startDate = new Date(start + 'T00:00:00');
    const endDate = new Date(end + 'T00:00:00');
    const daysDiff = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

    if (daysDiff === 0) return 'day';
    if (daysDiff === 6) return 'week';
    if (daysDiff === 29) return 'month';
    return 'custom';
  };

  const selectedPeriod = detectPeriod(dateRangeStart, dateRangeEnd);

  // Set date range for presets
  const setPreset = (preset: 'day' | 'week' | 'month') => {
    const todayDate = new Date();
    let start: Date;

    switch (preset) {
      case 'day':
        start = todayDate;
        break;
      case 'week':
        start = new Date(todayDate);
        start.setDate(todayDate.getDate() - 6);
        break;
      case 'month':
        start = new Date(todayDate);
        start.setDate(todayDate.getDate() - 29);
        break;
    }

    setDateRangeStart(getDateString(start));
    setDateRangeEnd(today);
  };

  const location = useLocation();

  useEffect(() => {
    loadStats();
  }, []);

  // Scroll to anchor when loading completes
  useEffect(() => {
    if (!loading && location.hash) {
      const element = document.getElementById(location.hash.slice(1));
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }, [loading, location.hash]);

  async function loadStats() {
    try {
      const [stats, categories, settingsResult, activeYt] = await Promise.all([
        chrome.runtime.sendMessage({ type: 'GET_STATS' }),
        chrome.runtime.sendMessage({ type: 'GET_DOMAIN_CATEGORIES' }),
        chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }),
        chrome.runtime.sendMessage({ type: 'GET_ACTIVE_YOUTUBE_SESSIONS' }),
      ]);
      setAllStats(stats);
      setDomainCategories(categories || {});
      setSettings(settingsResult);
      setActiveYoutubeSessions(activeYt || {});
    } catch (err) {
      console.error('Failed to load stats:', err);
    } finally {
      setLoading(false);
    }
  }

  // Calculate time per category for the selected period
  function getCategoryBreakdown(siteTotals: Record<string, number>): { category: string; time: number; percent: number }[] {
    const categoryTotals: Record<string, number> = {};
    let totalTime = 0;

    for (const [domain, time] of Object.entries(siteTotals)) {
      const category = getCategoryForDomain(domain, domainCategories);
      categoryTotals[category] = (categoryTotals[category] || 0) + time;
      totalTime += time;
    }

    return CATEGORIES
      .map(cat => ({
        category: cat.id as string,
        time: categoryTotals[cat.id] || 0,
        percent: totalTime > 0 ? ((categoryTotals[cat.id] || 0) / totalTime) * 100 : 0,
      }))
      .filter(item => item.time > 0)
      .sort((a, b) => b.time - a.time);
  }

  // Get timeline stats for the selected period
  const getTimelineStats = (datesToUse: string[]): { sessions: SiteSession[]; sites: Record<string, number> } => {
    const allSessions: SiteSession[] = [];
    const aggregatedSites: Record<string, number> = {};

    for (const dateStr of datesToUse) {
      const dayStats = allStats[dateStr];
      if (dayStats) {
        if (dayStats.sessions) {
          allSessions.push(...dayStats.sessions);
        }
        for (const [domain, time] of Object.entries(dayStats.sites || {})) {
          aggregatedSites[domain] = (aggregatedSites[domain] || 0) + time;
        }
      }
    }

    return { sessions: allSessions, sites: aggregatedSites };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Get dates for selected period from unified date range
  const dates: string[] = [];
  let currentDate = new Date(dateRangeStart + 'T00:00:00');
  const endDate = new Date(dateRangeEnd + 'T00:00:00');
  while (currentDate <= endDate) {
    dates.push(getDateString(currentDate));
    currentDate.setDate(currentDate.getDate() + 1);
  }

  const periodDays = dates.length;

  // Calculate stats for period
  const periodStats = dates.map((date) => allStats[date] || { date, totalTime: 0, sites: {}, visits: 0, blockedAttempts: 0 });
  const totalTime = periodStats.reduce((sum, s) => sum + s.totalTime, 0);
  const totalBlocks = periodStats.reduce((sum, s) => sum + s.blockedAttempts, 0);
  const avgDailyTime = totalTime / periodDays;

  // Aggregate site times across period
  const siteTotals: Record<string, number> = {};
  for (const stats of periodStats) {
    for (const [domain, time] of Object.entries(stats.sites)) {
      siteTotals[domain] = (siteTotals[domain] || 0) + time;
    }
  }
  const topSites = Object.entries(siteTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  // Find max time for chart scaling
  const maxDailyTime = Math.max(...periodStats.map((s) => s.totalTime), 1);

  // Compare to previous period (same length, immediately before)
  const prevDates: string[] = [];
  const startDateObj = new Date(dateRangeStart + 'T00:00:00');
  for (let i = periodDays; i > 0; i--) {
    const date = new Date(startDateObj);
    date.setDate(startDateObj.getDate() - i);
    prevDates.push(getDateString(date));
  }
  const prevStats = prevDates.map((date) => allStats[date] || { totalTime: 0 });
  const prevTotalTime = prevStats.reduce((sum, s) => sum + s.totalTime, 0);
  const timeChange = prevTotalTime > 0 ? ((totalTime - prevTotalTime) / prevTotalTime) * 100 : 0;

  // Get period label for display
  const getPeriodLabel = () => {
    if (selectedPeriod === 'day') return 'day';
    if (selectedPeriod === 'custom') return 'period';
    return selectedPeriod;
  };

  // Format the date range for display
  const getDateRangeDisplay = () => {
    if (dateRangeStart === dateRangeEnd) {
      return formatDateLabel(dateRangeStart);
    }
    return `${formatDate(dateRangeStart)} → ${formatDate(dateRangeEnd)}`;
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Metrics</h1>
        <div className="flex items-center gap-4">
          {/* Date range display (non-clickable) */}
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {getDateRangeDisplay()}
          </span>

          {/* Period selector with sliding indicator */}
          <div className="relative flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
            {/* Animated sliding background */}
            <div
              className="absolute top-1 bottom-1 bg-white dark:bg-gray-700 rounded-md shadow transition-all duration-300 ease-out"
              style={{
                width: 'calc(25% - 2px)',
                left: '4px',
                transform: `translateX(${
                  selectedPeriod === 'day' ? '0%' :
                  selectedPeriod === 'week' ? '100%' :
                  selectedPeriod === 'month' ? '200%' :
                  '300%'
                })`,
              }}
            />
            <button
              onClick={() => setPreset('day')}
              className={`relative z-10 w-16 py-2 text-sm font-medium rounded-md transition-colors duration-200 text-center ${
                selectedPeriod === 'day' ? 'text-gray-900 dark:text-gray-100' : 'text-gray-600 dark:text-gray-400'
              }`}
            >
              Day
            </button>
            <button
              onClick={() => setPreset('week')}
              className={`relative z-10 w-16 py-2 text-sm font-medium rounded-md transition-colors duration-200 text-center ${
                selectedPeriod === 'week' ? 'text-gray-900 dark:text-gray-100' : 'text-gray-600 dark:text-gray-400'
              }`}
            >
              Week
            </button>
            <button
              onClick={() => setPreset('month')}
              className={`relative z-10 w-16 py-2 text-sm font-medium rounded-md transition-colors duration-200 text-center ${
                selectedPeriod === 'month' ? 'text-gray-900 dark:text-gray-100' : 'text-gray-600 dark:text-gray-400'
              }`}
            >
              Month
            </button>
            <div className="relative">
              <button
                onClick={() => setShowDateRangePicker(!showDateRangePicker)}
                className={`relative z-10 w-16 py-2 text-sm font-medium rounded-md transition-colors duration-200 text-center ${
                  selectedPeriod === 'custom' ? 'text-gray-900 dark:text-gray-100' : 'text-gray-600 dark:text-gray-400'
                }`}
              >
                Custom
              </button>
              {showDateRangePicker && (
                <DateRangePicker
                  startDate={dateRangeStart}
                  endDate={dateRangeEnd}
                  onSelectRange={(start, end) => {
                    setDateRangeStart(start);
                    setDateRangeEnd(end);
                  }}
                  onClose={() => setShowDateRangePicker(false)}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-500 dark:text-gray-400">Total time</span>
            <Clock className="w-5 h-5 text-gray-400 dark:text-gray-500" />
          </div>
          <p className="text-2xl font-bold">{formatTime(totalTime)}</p>
          <div className="flex items-center gap-1 mt-1">
            {timeChange > 0 ? (
              <TrendingUp className="w-4 h-4 text-red-500" />
            ) : (
              <TrendingDown className="w-4 h-4 text-green-500" />
            )}
            <span className={`text-sm ${timeChange > 0 ? 'text-red-500' : 'text-green-500'}`}>
              {Math.abs(timeChange).toFixed(0)}% vs prev {getPeriodLabel()}
            </span>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-500 dark:text-gray-400">Daily average</span>
            <Calendar className="w-5 h-5 text-gray-400 dark:text-gray-500" />
          </div>
          <p className="text-2xl font-bold">{formatTime(avgDailyTime)}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">per day</p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-500 dark:text-gray-400">Sites blocked</span>
            <TrendingDown className="w-5 h-5 text-gray-400 dark:text-gray-500" />
          </div>
          <p className="text-2xl font-bold">{totalBlocks}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">distractions avoided</p>
        </div>
      </div>

      {/* Activity timeline */}
      <div id="activity-timeline" className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Activity timeline</h2>
        <div className="overflow-hidden">
          <Timeline
            sessions={getTimelineStats(dates).sessions}
            sites={getTimelineStats(dates).sites}
            startDate={dateRangeStart}
            endDate={dateRangeEnd}
            animationDirection={null}
          />
        </div>
      </div>

      {/* Top sites and Category Breakdown - Two Columns */}
      <div className="grid grid-cols-2 gap-6 mb-6">
        {/* Top sites */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold mb-4">Top sites</h2>
          {topSites.length > 0 ? (
            <div className="space-y-3">
              {topSites.slice(0, 8).map(([domain, time], index) => (
                <div key={domain} className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${DOMAIN_COLORS[index % DOMAIN_COLORS.length]}`} />
                  <span className="text-sm text-gray-400 dark:text-gray-500 w-4">{index + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <a
                        href={`https://${domain}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium truncate hover:text-blue-600 hover:underline"
                      >
                        {domain}
                      </a>
                      <span className="text-sm text-gray-500 dark:text-gray-400 ml-2">{formatTime(time)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 dark:text-gray-400 text-center py-8">No data for this period</p>
          )}
        </div>

        {/* Category Breakdown */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold mb-4">By category</h2>
          {(() => {
            const categoryBreakdown = getCategoryBreakdown(siteTotals);
            if (categoryBreakdown.length === 0) {
              return <p className="text-gray-500 dark:text-gray-400 text-center py-8">No data for this period</p>;
            }
            return (
              <div className="space-y-3">
                {categoryBreakdown.map(({ category, time, percent }) => {
                  const info = getCategoryInfo(category);
                  return (
                    <div key={category} className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${info.color}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium">{info.name}</span>
                          <span className="text-sm text-gray-500 dark:text-gray-400">{formatTime(time)}</span>
                        </div>
                        <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${info.color} transition-all`}
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>
                      <span className="text-xs text-gray-400 dark:text-gray-500 w-12 text-right">{percent.toFixed(1)}%</span>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      </div>

      {/* Daily breakdown Chart */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Daily breakdown</h2>
          {hoveredSegment && (
            <div className="bg-gray-900 text-white text-xs px-3 py-1.5 rounded-lg flex items-center gap-2 animate-fade-in">
              <div className={`w-2 h-2 rounded-full ${DOMAIN_COLORS[topSites.findIndex(([d]) => d === hoveredSegment.domain) % DOMAIN_COLORS.length] || 'bg-gray-400'}`} />
              <span className="font-medium">{hoveredSegment.domain}</span>
              <span className="text-gray-300">•</span>
              <span>{formatTime(hoveredSegment.time)}</span>
              <span className="text-gray-400">({hoveredSegment.percent.toFixed(1)}%)</span>
            </div>
          )}
        </div>
        <div className="space-y-3">
          {periodStats.slice(-7).map((stats) => {
            const sortedSites = Object.entries(stats.sites).sort((a, b) => b[1] - a[1]);
            const topDomainIndices = new Map(
              topSites.map(([domain], idx) => [domain, idx])
            );

            return (
              <div key={stats.date} className="flex items-center gap-3">
                <span className="text-xs text-gray-500 dark:text-gray-400 w-20">{formatDate(stats.date)}</span>
                <div className="flex-1 h-8 bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden flex">
                  {stats.totalTime > 0 ? (
                    sortedSites.map(([domain, time]) => {
                      const colorIndex = topDomainIndices.get(domain) ?? 9;
                      const widthPercent = (time / maxDailyTime) * 100;
                      if (widthPercent < 0.5) return null;
                      return (
                        <div
                          key={domain}
                          className={`h-full ${DOMAIN_COLORS[colorIndex % DOMAIN_COLORS.length]} hover:opacity-80 transition-opacity cursor-pointer`}
                          style={{ width: `${widthPercent}%` }}
                          onMouseEnter={() => setHoveredSegment({
                            date: stats.date,
                            domain,
                            time,
                            percent: (time / stats.totalTime) * 100
                          })}
                          onMouseLeave={() => setHoveredSegment(null)}
                        />
                      );
                    })
                  ) : (
                    <div className="flex-1 flex items-center justify-center text-xs text-gray-400 dark:text-gray-500">
                      No activity
                    </div>
                  )}
                </div>
                <span className="text-xs text-gray-600 dark:text-gray-400 w-14 text-right">
                  {formatTime(stats.totalTime)}
                </span>
              </div>
            );
          })}
        </div>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-4">
          Hover over segments to see domain details. Colors match the top sites list above.
        </p>
      </div>

      {/* YouTube channels - only shown when tracking is enabled */}
      {settings?.youtubeTrackingEnabled && (
        <div id="youtube-channels" className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Youtube className="w-5 h-5 text-red-600" />
            YouTube channels
          </h2>
          {(() => {
            // Aggregate YouTube sessions for the selected period
            const allYouTubeSessions = periodStats.flatMap(s => s.youtubeSessions || []);

            if (allYouTubeSessions.length === 0) {
              return (
                <p className="text-gray-500 dark:text-gray-400 text-center py-8">
                  No YouTube activity recorded in this period
                </p>
              );
            }

            const channelStats = computeYouTubeStatsWithUrls(allYouTubeSessions);

            // Build a map of channel URLs from active sessions
            const activeUrls: Record<string, string> = {};
            for (const session of Object.values(activeYoutubeSessions)) {
              if (session.channelUrl && session.channelName) {
                activeUrls[session.channelName] = session.channelUrl;
              }
            }

            const sortedChannels = Object.entries(channelStats).sort((a, b) => b[1].time - a[1].time);
            const totalYouTubeTime = Object.values(channelStats).reduce((a, b) => a + b.time, 0);
            const maxChannelTime = sortedChannels.length > 0 ? sortedChannels[0][1].time : 0;
            const INITIAL_DISPLAY = 10;
            const hasMore = sortedChannels.length > INITIAL_DISPLAY;

            return (
              <div>
                <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400 mb-4">
                  <span>{sortedChannels.length} channel{sortedChannels.length !== 1 ? 's' : ''}</span>
                  <span>Total: {formatTime(totalYouTubeTime)}</span>
                </div>
                <div className={`space-y-4 max-h-[420px] transition-all duration-300 overflow-hidden ${youtubeExpanded ? 'overflow-y-auto' : ''}`}>
                {sortedChannels.map(([channel, stats], idx) => {
                  const percent = totalYouTubeTime > 0 ? (stats.time / totalYouTubeTime) * 100 : 0;
                  const barWidth = maxChannelTime > 0 ? (stats.time / maxChannelTime) * 100 : 0;
                  const channelUrl = stats.url || activeUrls[channel];

                  return (
                    <div key={channel}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium truncate flex items-center gap-2">
                          <span className="text-gray-400">{idx + 1}.</span>
                          {channelUrl ? (
                            <a
                              href={channelUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="hover:text-red-600 hover:underline"
                            >
                              {channel}
                            </a>
                          ) : (
                            channel
                          )}
                        </span>
                        <span className="text-gray-500 dark:text-gray-400 flex items-center gap-2">
                          {formatTime(stats.time)}
                          <span className="text-xs text-gray-400">({percent.toFixed(1)}%)</span>
                        </span>
                      </div>
                      <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-red-500 rounded-full transition-all"
                          style={{ width: `${barWidth}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
                </div>

                {hasMore && (
                  <div className="mt-4 flex justify-center h-5">
                    <button
                      onClick={() => setYoutubeExpanded(!youtubeExpanded)}
                      className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center gap-1.5"
                    >
                      <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${youtubeExpanded ? 'rotate-180' : ''}`} />
                      <span className="w-14">{youtubeExpanded ? 'Collapse' : 'Expand'}</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
