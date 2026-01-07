import { useEffect, useState } from 'react';
import { Calendar, Clock, TrendingDown, TrendingUp, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Layers, CalendarDays, X } from 'lucide-react';
import { DailyStats, SiteSession, SiteCategory } from '../../shared/types';
import { CATEGORIES, getCategoryForDomain, getCategoryInfo } from '../../shared/categories';

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

// Calendar Picker Component
interface CalendarPickerProps {
  selectedDate: string;
  onSelect: (date: string) => void;
  onClose: () => void;
  minDate?: string;
  maxDate?: string;
}

function CalendarPicker({ selectedDate, onSelect, onClose, minDate, maxDate }: CalendarPickerProps) {
  const [viewDate, setViewDate] = useState(() => {
    const d = new Date(selectedDate + 'T00:00:00');
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  const today = getDateString(new Date());
  const effectiveMaxDate = maxDate || today;

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

  return (
    <div className="absolute top-full left-0 mt-2 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-4 z-50 w-72">
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
          const isSelected = dateStr === selectedDate;
          const isToday = dateStr === today;
          const isDisabled = dateStr > effectiveMaxDate || (minDate ? dateStr < minDate : false);

          return (
            <button
              key={idx}
              onClick={() => !isDisabled && onSelect(dateStr)}
              disabled={isDisabled}
              className={`p-2 text-sm rounded-lg transition-colors ${
                isSelected
                  ? 'bg-blue-600 text-white'
                  : isToday
                  ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-900'
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
      <div className="flex justify-between mt-4 pt-4 border-t dark:border-gray-700">
        <button
          onClick={() => onSelect(today)}
          className="text-sm text-blue-600 hover:text-blue-700"
        >
          Today
        </button>
        <button
          onClick={onClose}
          className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
        >
          Close
        </button>
      </div>
    </div>
  );
}

// Full Timeline Component with animations
interface TimelineProps {
  sessions: SiteSession[];
  sites: Record<string, number>;
  dateStr: string;
  animationDirection: 'left' | 'right' | null;
}

function Timeline({ sessions, sites, dateStr, animationDirection }: TimelineProps) {
  const [expanded, setExpanded] = useState(false);
  const INITIAL_DISPLAY = 10;

  const selectedDate = new Date(dateStr + 'T00:00:00');
  const dayStart = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(), 0, 0, 0);
  const dayEnd = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(), 23, 59, 59);
  const today = getDateString(new Date());
  const isToday = dateStr === today;

  // Find actual time range from sessions
  let minTime = dayEnd.getTime();
  let maxTime = dayStart.getTime();
  sessions.forEach(s => {
    minTime = Math.min(minTime, s.startTime);
    maxTime = Math.max(maxTime, s.endTime);
  });

  // Add 30 min padding
  minTime = Math.max(dayStart.getTime(), minTime - 30 * 60 * 1000);
  maxTime = Math.min(dayEnd.getTime(), maxTime + 30 * 60 * 1000);

  // If no sessions, show 8am to current time (for today) or 8am-6pm (for past days)
  if (sessions.length === 0) {
    minTime = dayStart.getTime() + 8 * 60 * 60 * 1000;
    maxTime = isToday ? Date.now() : dayStart.getTime() + 18 * 60 * 60 * 1000;
  }

  const timeRange = Math.max(maxTime - minTime, 1);

  const sortedSites = Object.entries(sites).sort((a, b) => b[1] - a[1]);
  const displayedSites = expanded ? sortedSites : sortedSites.slice(0, INITIAL_DISPLAY);

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

  const hourMarkers: { hour: number; label: string; position: number }[] = [];
  const startHour = new Date(minTime).getHours();
  const endHour = new Date(maxTime).getHours();
  for (let h = startHour; h <= endHour; h++) {
    const markerTime = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(), h, 0, 0).getTime();
    if (markerTime >= minTime && markerTime <= maxTime) {
      const position = ((markerTime - minTime) / timeRange) * 100;
      hourMarkers.push({
        hour: h,
        label: h === 0 ? '12am' : h < 12 ? `${h}am` : h === 12 ? '12pm' : `${h - 12}pm`,
        position,
      });
    }
  }

  // Animation classes
  const animationClass = animationDirection
    ? animationDirection === 'left'
      ? 'animate-slide-in-left'
      : 'animate-slide-in-right'
    : '';

  if (sortedSites.length === 0 && sessions.length === 0) {
    return (
      <div className={`text-center py-8 text-gray-500 dark:text-gray-400 ${animationClass}`}>
        {isToday ? 'No activity recorded yet today' : 'No activity recorded on this day'}
      </div>
    );
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
        {hourMarkers.map(marker => (
          <div
            key={marker.hour}
            className="absolute text-xs text-gray-400"
            style={{ left: `${marker.position}%`, transform: 'translateX(-50%)' }}
          >
            {marker.label}
          </div>
        ))}
      </div>

      <div className="space-y-2">
        {displayedSites.map(([domain, totalTime]) => {
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
                  <span className="text-sm font-medium truncate" title={domain}>
                    {domain.replace(/^www\./, '')}
                  </span>
                  {hasMultipleWindows && (
                    <span title="Multiple windows">
                      <Layers className="w-3 h-3 text-gray-400 flex-shrink-0" />
                    </span>
                  )}
                </div>
                <span className="text-xs text-gray-500">{formatTime(totalTime)}</span>
              </div>

              <div className="flex-1 relative h-6 bg-gray-100 dark:bg-gray-700 rounded overflow-hidden">
                {hourMarkers.map(marker => (
                  <div
                    key={marker.hour}
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
                      title={`${formatTimeOfDay(interval.start)} - ${formatTimeOfDay(interval.end)}`}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {sortedSites.length > INITIAL_DISPLAY && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-4 flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 mx-auto"
        >
          {expanded ? (
            <>
              <ChevronUp className="w-4 h-4" />
              Show less
            </>
          ) : (
            <>
              <ChevronDown className="w-4 h-4" />
              Show {sortedSites.length - INITIAL_DISPLAY} more sites
            </>
          )}
        </button>
      )}
    </div>
  );
}

export default function Metrics() {
  const [allStats, setAllStats] = useState<Record<string, DailyStats>>({});
  const [selectedPeriod, setSelectedPeriod] = useState<'week' | 'month'>('week');
  const [loading, setLoading] = useState(true);
  const [hoveredSegment, setHoveredSegment] = useState<{ date: string; domain: string; time: number; percent: number } | null>(null);
  const [domainCategories, setDomainCategories] = useState<Record<string, SiteCategory>>({});

  // Timeline state
  const [selectedDate, setSelectedDate] = useState(() => getDateString(new Date()));
  const [showCalendar, setShowCalendar] = useState(false);
  const [animationDirection, setAnimationDirection] = useState<'left' | 'right' | null>(null);
  const [dateRangeMode, setDateRangeMode] = useState(false);
  const [startDate, setStartDate] = useState<string | null>(null);
  const [endDate, setEndDate] = useState<string | null>(null);
  const [showStartCalendar, setShowStartCalendar] = useState(false);
  const [showEndCalendar, setShowEndCalendar] = useState(false);

  const today = getDateString(new Date());

  useEffect(() => {
    loadStats();
  }, []);

  async function loadStats() {
    try {
      const [stats, categories] = await Promise.all([
        chrome.runtime.sendMessage({ type: 'GET_STATS' }),
        chrome.runtime.sendMessage({ type: 'GET_DOMAIN_CATEGORIES' }),
      ]);
      setAllStats(stats);
      setDomainCategories(categories || {});
    } catch (err) {
      console.error('Failed to load stats:', err);
    } finally {
      setLoading(false);
    }
  }

  // Calculate time per category for the selected period
  function getCategoryBreakdown(siteTotals: Record<string, number>): { category: SiteCategory; time: number; percent: number }[] {
    const categoryTotals: Record<SiteCategory, number> = {} as Record<SiteCategory, number>;
    let totalTime = 0;

    for (const [domain, time] of Object.entries(siteTotals)) {
      const category = getCategoryForDomain(domain, domainCategories);
      categoryTotals[category] = (categoryTotals[category] || 0) + time;
      totalTime += time;
    }

    return CATEGORIES
      .map(cat => ({
        category: cat.id,
        time: categoryTotals[cat.id] || 0,
        percent: totalTime > 0 ? ((categoryTotals[cat.id] || 0) / totalTime) * 100 : 0,
      }))
      .filter(item => item.time > 0)
      .sort((a, b) => b.time - a.time);
  }

  // Navigation functions for timeline
  const goToPrevDay = () => {
    const date = new Date(selectedDate + 'T00:00:00');
    date.setDate(date.getDate() - 1);
    setAnimationDirection('left');
    setSelectedDate(getDateString(date));
    setTimeout(() => setAnimationDirection(null), 300);
  };

  const goToNextDay = () => {
    const date = new Date(selectedDate + 'T00:00:00');
    date.setDate(date.getDate() + 1);
    const nextDateStr = getDateString(date);
    if (nextDateStr <= today) {
      setAnimationDirection('right');
      setSelectedDate(nextDateStr);
      setTimeout(() => setAnimationDirection(null), 300);
    }
  };

  const handleDateSelect = (dateStr: string) => {
    const direction = dateStr < selectedDate ? 'left' : 'right';
    setAnimationDirection(direction);
    setSelectedDate(dateStr);
    setShowCalendar(false);
    setTimeout(() => setAnimationDirection(null), 300);
  };

  // Get timeline stats for selected date or date range
  const getTimelineStats = (): { sessions: SiteSession[]; sites: Record<string, number> } => {
    if (dateRangeMode && startDate && endDate) {
      // Aggregate sessions and sites across date range
      const allSessions: SiteSession[] = [];
      const aggregatedSites: Record<string, number> = {};

      let currentDate = new Date(startDate + 'T00:00:00');
      const end = new Date(endDate + 'T00:00:00');

      while (currentDate <= end) {
        const dateStr = getDateString(currentDate);
        const dayStats = allStats[dateStr];
        if (dayStats) {
          if (dayStats.sessions) {
            allSessions.push(...dayStats.sessions);
          }
          for (const [domain, time] of Object.entries(dayStats.sites || {})) {
            aggregatedSites[domain] = (aggregatedSites[domain] || 0) + time;
          }
        }
        currentDate.setDate(currentDate.getDate() + 1);
      }

      return { sessions: allSessions, sites: aggregatedSites };
    }

    const stats = allStats[selectedDate];
    return {
      sessions: stats?.sessions || [],
      sites: stats?.sites || {},
    };
  };

  const timelineData = getTimelineStats();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Get dates for selected period (using local timezone)
  const todayDate = new Date();
  const periodDays = selectedPeriod === 'week' ? 7 : 30;
  const dates: string[] = [];
  for (let i = periodDays - 1; i >= 0; i--) {
    const date = new Date(todayDate);
    date.setDate(date.getDate() - i);
    // Use local date format instead of UTC
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    dates.push(`${year}-${month}-${day}`);
  }

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

  // Compare to previous period
  const prevDates: string[] = [];
  for (let i = periodDays * 2 - 1; i >= periodDays; i--) {
    const date = new Date(todayDate);
    date.setDate(date.getDate() - i);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    prevDates.push(`${year}-${month}-${day}`);
  }
  const prevStats = prevDates.map((date) => allStats[date] || { totalTime: 0 });
  const prevTotalTime = prevStats.reduce((sum, s) => sum + s.totalTime, 0);
  const timeChange = prevTotalTime > 0 ? ((totalTime - prevTotalTime) / prevTotalTime) * 100 : 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Metrics</h1>
        <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
          <button
            onClick={() => setSelectedPeriod('week')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              selectedPeriod === 'week' ? 'bg-white dark:bg-gray-700 shadow text-gray-900 dark:text-gray-100' : 'text-gray-600 dark:text-gray-400'
            }`}
          >
            Week
          </button>
          <button
            onClick={() => setSelectedPeriod('month')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              selectedPeriod === 'month' ? 'bg-white dark:bg-gray-700 shadow text-gray-900 dark:text-gray-100' : 'text-gray-600 dark:text-gray-400'
            }`}
          >
            Month
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-500 dark:text-gray-400">Total Time</span>
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
              {Math.abs(timeChange).toFixed(0)}% vs prev {selectedPeriod}
            </span>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-500 dark:text-gray-400">Daily Average</span>
            <Calendar className="w-5 h-5 text-gray-400 dark:text-gray-500" />
          </div>
          <p className="text-2xl font-bold">{formatTime(avgDailyTime)}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">per day</p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-500 dark:text-gray-400">Sites Blocked</span>
            <TrendingDown className="w-5 h-5 text-gray-400 dark:text-gray-500" />
          </div>
          <p className="text-2xl font-bold">{totalBlocks}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">distractions avoided</p>
        </div>
      </div>

      {/* Activity Timeline */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Activity Timeline</h2>
          <div className="flex items-center gap-2">
            {/* Date Range Toggle */}
            <button
              onClick={() => {
                setDateRangeMode(!dateRangeMode);
                if (!dateRangeMode) {
                  setStartDate(selectedDate);
                  setEndDate(selectedDate);
                }
              }}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                dateRangeMode
                  ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {dateRangeMode ? 'Date Range' : 'Single Day'}
            </button>
          </div>
        </div>

        {/* Date Navigation / Selection */}
        {!dateRangeMode ? (
          <div className="flex items-center justify-center gap-4 mb-6">
            <button
              onClick={goToPrevDay}
              className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            <div className="relative">
              <button
                onClick={() => setShowCalendar(!showCalendar)}
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
              >
                <CalendarDays className="w-4 h-4 text-gray-500" />
                <span className="font-medium">{formatDateLabel(selectedDate)}</span>
              </button>
              {showCalendar && (
                <CalendarPicker
                  selectedDate={selectedDate}
                  onSelect={handleDateSelect}
                  onClose={() => setShowCalendar(false)}
                />
              )}
            </div>

            <button
              onClick={goToNextDay}
              disabled={selectedDate === today}
              className={`p-2 rounded-lg transition-colors ${
                selectedDate === today
                  ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <ChevronRight className="w-5 h-5" />
            </button>

            {selectedDate !== today && (
              <button
                onClick={() => handleDateSelect(today)}
                className="text-sm text-blue-600 hover:text-blue-700"
              >
                Back to today
              </button>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center gap-4 mb-6 flex-wrap">
            {/* Start Date */}
            <div className="relative">
              <span className="text-xs text-gray-500 block mb-1">From</span>
              <button
                onClick={() => {
                  setShowStartCalendar(!showStartCalendar);
                  setShowEndCalendar(false);
                }}
                className="flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                <CalendarDays className="w-4 h-4 text-gray-500" />
                <span className="text-sm font-medium">{startDate ? formatDateLabel(startDate) : 'Select'}</span>
              </button>
              {showStartCalendar && (
                <CalendarPicker
                  selectedDate={startDate || today}
                  onSelect={(d) => {
                    setStartDate(d);
                    if (endDate && d > endDate) setEndDate(d);
                    setShowStartCalendar(false);
                  }}
                  onClose={() => setShowStartCalendar(false)}
                  maxDate={endDate || today}
                />
              )}
            </div>

            <span className="text-gray-400 mt-5">→</span>

            {/* End Date */}
            <div className="relative">
              <span className="text-xs text-gray-500 block mb-1">To</span>
              <button
                onClick={() => {
                  setShowEndCalendar(!showEndCalendar);
                  setShowStartCalendar(false);
                }}
                className="flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                <CalendarDays className="w-4 h-4 text-gray-500" />
                <span className="text-sm font-medium">{endDate ? formatDateLabel(endDate) : 'Select'}</span>
              </button>
              {showEndCalendar && (
                <CalendarPicker
                  selectedDate={endDate || today}
                  onSelect={(d) => {
                    setEndDate(d);
                    if (startDate && d < startDate) setStartDate(d);
                    setShowEndCalendar(false);
                  }}
                  onClose={() => setShowEndCalendar(false)}
                  minDate={startDate || undefined}
                />
              )}
            </div>

            {startDate && endDate && (
              <button
                onClick={() => {
                  setStartDate(null);
                  setEndDate(null);
                }}
                className="mt-5 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        )}

        {/* Timeline Content */}
        <div className="overflow-hidden">
          <Timeline
            sessions={timelineData.sessions}
            sites={timelineData.sites}
            dateStr={dateRangeMode ? (startDate || today) : selectedDate}
            animationDirection={animationDirection}
          />
        </div>
      </div>

      {/* Top Sites and Category Breakdown - Two Columns */}
      <div className="grid grid-cols-2 gap-6 mb-6">
        {/* Top Sites */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold mb-4">Top Sites ({selectedPeriod})</h2>
          {topSites.length > 0 ? (
            <div className="space-y-3">
              {topSites.slice(0, 8).map(([domain, time], index) => (
                <div key={domain} className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${DOMAIN_COLORS[index % DOMAIN_COLORS.length]}`} />
                  <span className="text-sm text-gray-400 dark:text-gray-500 w-4">{index + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium truncate">{domain}</span>
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
          <h2 className="text-lg font-semibold mb-4">By Category ({selectedPeriod})</h2>
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

      {/* Daily Breakdown Chart */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Daily Breakdown</h2>
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
    </div>
  );
}
