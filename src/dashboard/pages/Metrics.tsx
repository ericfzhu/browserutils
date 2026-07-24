import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Calendar, Clock, TrendingDown, TrendingUp, ChevronLeft, ChevronRight, ChevronDown, Layers, Shield, Video } from 'lucide-react';
import { DailyStatsSummary, SiteSession, Settings, ActiveYouTubeSession, YouTubeChannelSession, CustomCategory } from '../../shared/types';
import { getCategoryForDomain, getCategoryInfoWithOverrides, getCategoryOptions } from '../../shared/categories';
import { computeYouTubeStatsWithUrlsLegacy } from '../../shared/storage';
import {
  analyticsBarTrackClass,
  analyticsEmptyStateClass,
  analyticsPanelClass,
  analyticsStatCardClass,
} from '../components/analyticsStyles';

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
    <div className="absolute right-0 top-full z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-2xl bg-popover p-4 text-popover-foreground shadow-[var(--shadow-card-hover)]">
      {/* Selection indicator */}
      <div className="flex items-center justify-between mb-3 text-sm">
        <button
          onClick={() => setSelectingStart(true)}
          className={`min-h-10 rounded-lg px-3 text-sm font-medium transition-[background-color,color,transform] duration-150 ease-out active:scale-[0.96] ${selectingStart ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground hover:text-foreground'}`}
        >
          {formatDateLabel(localStartDate)}
        </button>
        <span className="text-muted-foreground">→</span>
        <button
          onClick={() => setSelectingStart(false)}
          className={`min-h-10 rounded-lg px-3 text-sm font-medium transition-[background-color,color,transform] duration-150 ease-out active:scale-[0.96] ${!selectingStart ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground hover:text-foreground'}`}
        >
          {formatDateLabel(localEndDate)}
        </button>
      </div>

      {/* Calendar */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={prevMonth} className="flex size-10 items-center justify-center rounded-lg text-muted-foreground transition-[background-color,color,transform] duration-150 ease-out hover:bg-muted hover:text-foreground active:scale-[0.96]" title="Previous month">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <span className="font-medium">{monthName}</span>
        <button onClick={nextMonth} className="flex size-10 items-center justify-center rounded-lg text-muted-foreground transition-[background-color,color,transform] duration-150 ease-out hover:bg-muted hover:text-foreground active:scale-[0.96]" title="Next month">
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
      <div className="mb-2 grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
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
              className={`aspect-square rounded-lg text-sm tabular-nums transition-[background-color,color,transform] duration-150 ease-out active:scale-[0.96] ${
                isSelected
                  ? 'bg-primary text-primary-foreground'
                  : isRangeDate
                  ? 'bg-primary/10 text-primary'
                  : isToday
                  ? 'bg-muted font-semibold text-foreground'
                  : isDisabled
                  ? 'cursor-not-allowed text-muted-foreground/35'
                  : 'hover:bg-muted'
              }`}
            >
              {day}
            </button>
          );
        })}
      </div>

      {/* Presets */}
      <div className="mt-4 flex flex-wrap gap-2 border-t pt-4">
        <button onClick={setWeekToDate} className="min-h-10 rounded-lg bg-muted px-3 text-xs font-medium transition-[background-color,transform] duration-150 ease-out hover:bg-muted/70 active:scale-[0.96]">Week to date</button>
        <button onClick={setMonthToDate} className="min-h-10 rounded-lg bg-muted px-3 text-xs font-medium transition-[background-color,transform] duration-150 ease-out hover:bg-muted/70 active:scale-[0.96]">Month to date</button>
        <button onClick={setLast7Days} className="min-h-10 rounded-lg bg-muted px-3 text-xs font-medium transition-[background-color,transform] duration-150 ease-out hover:bg-muted/70 active:scale-[0.96]">Last 7 days</button>
        <button onClick={setLast30Days} className="min-h-10 rounded-lg bg-muted px-3 text-xs font-medium transition-[background-color,transform] duration-150 ease-out hover:bg-muted/70 active:scale-[0.96]">Last 30 days</button>
      </div>

      {/* Actions */}
      <div className="mt-4 flex justify-between border-t pt-4">
        <button
          onClick={onClose}
          className="min-h-10 px-2 text-sm font-medium text-muted-foreground transition-colors duration-150 ease-out hover:text-foreground"
        >
          Cancel
        </button>
        <button
          onClick={() => {
            onSelectRange(localStartDate, localEndDate);
            onClose();
          }}
          className="min-h-10 px-2 text-sm font-medium text-primary transition-colors duration-150 ease-out hover:text-primary/80"
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
      <div className={`${analyticsEmptyStateClass} ${animationClass}`}>
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

  // Precompute unique window counts per domain to avoid repeated filtering in render.
  const windowIdsByDomain = new Map<string, Set<number>>();
  sessions.forEach(session => {
    if (!windowIdsByDomain.has(session.domain)) {
      windowIdsByDomain.set(session.domain, new Set());
    }
    windowIdsByDomain.get(session.domain)?.add(session.windowId);
  });

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
      <div className={`${analyticsEmptyStateClass} ${animationClass}`}>
        <p>Timeline data not available for this day.</p>
        <p className="mt-2 text-xs">Session tracking was enabled recently.</p>
      </div>
    );
  }

  return (
    <div className={animationClass}>
      <div className="relative mb-2 ml-32 h-5">
        {timeMarkers.map((marker, idx) => (
          <div
            key={idx}
            className="absolute text-xs text-muted-foreground"
            style={{ left: `${marker.position}%`, transform: 'translateX(-50%)' }}
          >
            {marker.label}
          </div>
        ))}
      </div>

      <div className={`max-h-[450px] space-y-1.5 overflow-hidden transition-[max-height] duration-300 ${expanded ? 'overflow-y-auto' : ''}`}>
        {sortedSites.map(([domain, totalTime]) => {
          const domainIntervals = sessionsByDomain.get(domain) || [];
          const color = getDomainColor(domain);
          const hasMultipleWindows = (windowIdsByDomain.get(domain)?.size || 0) > 1;

          return (
            <div key={domain} className="flex items-center gap-2">
              <div className="w-28 flex-shrink-0">
                <div className="flex items-center gap-1">
                  <a
                    href={`https://${domain}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="truncate text-xs font-medium transition-colors duration-150 ease-out hover:text-primary hover:underline"
                    title={domain}
                  >
                    {domain.replace(/^www\./, '')}
                  </a>
                  {hasMultipleWindows && (
                    <span title="Multiple windows">
                      <Layers className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
                    </span>
                  )}
                </div>
                <span className="text-xs text-muted-foreground tabular-nums">{formatTime(totalTime)}</span>
              </div>

              <div className="relative h-5 flex-1 overflow-hidden rounded-lg bg-muted shadow-[inset_0_0_0_1px_rgba(0,0,0,0.04)] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]">
                {timeMarkers.map((marker, idx) => (
                  <div
                    key={idx}
                    className="absolute bottom-0 top-0 w-px bg-background/70"
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
                      className={`absolute bottom-0.5 top-0.5 ${color} cursor-default rounded-md opacity-80 transition-opacity duration-150 ease-out hover:opacity-100`}
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
        <div className="mt-4 flex min-h-10 justify-center">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex min-h-10 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-primary transition-[background-color,color,transform] duration-150 ease-out hover:bg-muted hover:text-primary/80 active:scale-[0.96]"
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
  // Summary stats (without sessions) - loaded once on mount
  const [allStats, setAllStats] = useState<Record<string, DailyStatsSummary>>({});
  // Session data for timeline - loaded for selected date range
  const [sessionData, setSessionData] = useState<{ sessions: SiteSession[]; youtubeSessions: YouTubeChannelSession[] }>({ sessions: [], youtubeSessions: [] });
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hoveredSegment, setHoveredSegment] = useState<{ date: string; domain: string; time: number; percent: number } | null>(null);
  const [domainCategories, setDomainCategories] = useState<Record<string, string>>({});
  const [customCategories, setCustomCategories] = useState<CustomCategory[]>([]);
  const [builtInOverrides, setBuiltInOverrides] = useState<Record<string, string>>({});
  const [settings, setSettings] = useState<Settings | null>(null);
  const [activeYoutubeSessions, setActiveYoutubeSessions] = useState<Record<number, ActiveYouTubeSession>>({});

  // Unified date range state
  const today = getDateString(new Date());
  const [dateRangeStart, setDateRangeStart] = useState(() => today);
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

  // Load sessions when date range changes
  useEffect(() => {
    if (!loading) {
      loadSessionsForRange(dateRangeStart, dateRangeEnd);
    }
  }, [dateRangeStart, dateRangeEnd, loading]);

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
      const [stats, categories, custom, overrides, settingsResult, activeYt] = await Promise.all([
        chrome.runtime.sendMessage({ type: 'GET_STATS_SUMMARY' }),
        chrome.runtime.sendMessage({ type: 'GET_DOMAIN_CATEGORIES' }),
        chrome.runtime.sendMessage({ type: 'GET_CUSTOM_CATEGORIES' }),
        chrome.runtime.sendMessage({ type: 'GET_BUILTIN_CATEGORY_OVERRIDES' }),
        chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }),
        chrome.runtime.sendMessage({ type: 'GET_ACTIVE_YOUTUBE_SESSIONS' }),
      ]);
      setAllStats(stats || {});
      setDomainCategories(categories || {});
      setCustomCategories(custom || []);
      setBuiltInOverrides(overrides || {});
      setSettings(settingsResult);
      setActiveYoutubeSessions(activeYt || {});
    } catch (err) {
      console.error('Failed to load stats:', err);
    } finally {
      setLoading(false);
    }
  }

  // Load sessions for the selected date range (for timeline and YouTube sections)
  async function loadSessionsForRange(startDate: string, endDate: string) {
    setLoadingSessions(true);
    try {
      const data = await chrome.runtime.sendMessage({
        type: 'GET_SESSIONS_FOR_RANGE',
        payload: { startDate, endDate },
      });
      setSessionData(data || { sessions: [], youtubeSessions: [] });
    } catch (err) {
      console.error('Failed to load sessions:', err);
    } finally {
      setLoadingSessions(false);
    }
  }

  // Calculate time per category for the selected period
  function getCategoryBreakdown(siteTotals: Record<string, number>): { category: string; time: number; percent: number }[] {
    const categoryTotals: Record<string, number> = {};
    let totalTime = 0;

    const categoryOptions = getCategoryOptions(customCategories, builtInOverrides);
    const validCategoryIds = new Set(categoryOptions.map(category => category.id as string));

    for (const [domain, time] of Object.entries(siteTotals)) {
      const assignedCategory = getCategoryForDomain(domain, domainCategories);
      const category = validCategoryIds.has(assignedCategory) ? assignedCategory : 'other';
      categoryTotals[category] = (categoryTotals[category] || 0) + time;
      totalTime += time;
    }

    return categoryOptions
      .map(cat => ({
        category: cat.id as string,
        time: categoryTotals[cat.id] || 0,
        percent: totalTime > 0 ? ((categoryTotals[cat.id] || 0) / totalTime) * 100 : 0,
      }))
      .filter(item => item.time > 0)
      .sort((a, b) => b.time - a.time);
  }

  // Get aggregated sites for the selected period (from summary data)
  const getAggregatedSites = (datesToUse: string[]): Record<string, number> => {
    const aggregatedSites: Record<string, number> = {};
    for (const dateStr of datesToUse) {
      const dayStats = allStats[dateStr];
      if (dayStats) {
        for (const [domain, time] of Object.entries(dayStats.sites || {})) {
          aggregatedSites[domain] = (aggregatedSites[domain] || 0) + time;
        }
      }
    }
    return aggregatedSites;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-primary"></div>
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
      <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <h1 className="text-2xl font-bold text-foreground">Metrics</h1>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
          {/* Date range display (non-clickable) */}
          <span className="text-sm text-muted-foreground tabular-nums">
            {getDateRangeDisplay()}
          </span>

          {/* Period selector with sliding indicator */}
          <div className="relative flex w-fit rounded-xl bg-muted p-1">
            {/* Animated sliding background */}
            <div
              className="absolute bottom-1 top-1 rounded-lg bg-background shadow-[var(--shadow-border)] transition-transform duration-300 ease-out"
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
              className={`relative z-10 min-h-10 w-16 rounded-lg text-center text-sm font-medium transition-[color,transform] duration-150 ease-out active:scale-[0.96] ${
                selectedPeriod === 'day' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Day
            </button>
            <button
              onClick={() => setPreset('week')}
              className={`relative z-10 min-h-10 w-16 rounded-lg text-center text-sm font-medium transition-[color,transform] duration-150 ease-out active:scale-[0.96] ${
                selectedPeriod === 'week' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Week
            </button>
            <button
              onClick={() => setPreset('month')}
              className={`relative z-10 min-h-10 w-16 rounded-lg text-center text-sm font-medium transition-[color,transform] duration-150 ease-out active:scale-[0.96] ${
                selectedPeriod === 'month' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Month
            </button>
            <div className="relative">
              <button
                onClick={() => setShowDateRangePicker(!showDateRangePicker)}
                className={`relative z-10 min-h-10 w-16 rounded-lg text-center text-sm font-medium transition-[color,transform] duration-150 ease-out active:scale-[0.96] ${
                  selectedPeriod === 'custom' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
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
      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <div className={analyticsStatCardClass}>
          <div className="mb-2 flex items-center gap-3">
            <div className="rounded-xl bg-blue-100 p-2 dark:bg-blue-900/50">
              <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <span className="text-sm text-muted-foreground">Total time</span>
          </div>
          <p className="text-2xl font-bold tabular-nums">{formatTime(totalTime)}</p>
          <div className="mt-1 flex items-center gap-1">
            {timeChange > 0 ? (
              <TrendingUp className="w-4 h-4 text-red-500" />
            ) : (
              <TrendingDown className="w-4 h-4 text-green-500" />
            )}
            <span className={`text-sm tabular-nums ${timeChange > 0 ? 'text-red-500' : 'text-green-600 dark:text-green-400'}`}>
              {Math.abs(timeChange).toFixed(0)}% vs prev {getPeriodLabel()}
            </span>
          </div>
        </div>

        <div className={analyticsStatCardClass}>
          <div className="mb-2 flex items-center gap-3">
            <div className="rounded-xl bg-green-100 p-2 dark:bg-green-900/50">
              <Calendar className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <span className="text-sm text-muted-foreground">Daily average</span>
          </div>
          <p className="text-2xl font-bold tabular-nums">{formatTime(avgDailyTime)}</p>
          <p className="mt-1 text-sm text-muted-foreground">per day</p>
        </div>

        <div className={analyticsStatCardClass}>
          <div className="mb-2 flex items-center gap-3">
            <div className="rounded-xl bg-red-100 p-2 dark:bg-red-900/50">
              <Shield className="h-5 w-5 text-red-600 dark:text-red-400" />
            </div>
            <span className="text-sm text-muted-foreground">Sites blocked</span>
          </div>
          <p className="text-2xl font-bold tabular-nums">{totalBlocks}</p>
          <p className="mt-1 text-sm text-muted-foreground">distractions avoided</p>
        </div>
      </div>

      {/* Activity timeline */}
      <div id="activity-timeline" className={`${analyticsPanelClass} mb-6`}>
        <h2 className="text-lg font-semibold mb-4">Activity timeline</h2>
        <div className="overflow-hidden">
          {loadingSessions ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary"></div>
            </div>
          ) : (
            <Timeline
              sessions={sessionData.sessions}
              sites={getAggregatedSites(dates)}
              startDate={dateRangeStart}
              endDate={dateRangeEnd}
              animationDirection={null}
            />
          )}
        </div>
      </div>

      {/* Top sites and Category Breakdown - Two Columns */}
      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        {/* Top sites */}
        <div className={analyticsPanelClass}>
          <h2 className="text-lg font-semibold mb-4">Top sites</h2>
          {topSites.length > 0 ? (
            <div className="space-y-3">
              {topSites.slice(0, 8).map(([domain, time], index) => {
                const maxSiteTime = topSites[0]?.[1] || 1;
                return (
                  <div key={domain} className="flex items-center gap-3">
                    <span className="w-4 text-sm text-muted-foreground tabular-nums">{index + 1}</span>
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-center justify-between">
                        <a
                          href={`https://${domain}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="truncate text-sm font-medium transition-colors duration-150 ease-out hover:text-primary hover:underline"
                        >
                          {domain}
                        </a>
                        <span className="ml-2 text-sm text-muted-foreground tabular-nums">{formatTime(time)}</span>
                      </div>
                      <div className={analyticsBarTrackClass}>
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${(time / maxSiteTime) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className={analyticsEmptyStateClass}>No data for this period</p>
          )}
        </div>

        {/* Category Breakdown */}
        <div className={analyticsPanelClass}>
          <h2 className="text-lg font-semibold mb-4">By category</h2>
          {(() => {
            const categoryBreakdown = getCategoryBreakdown(siteTotals);
            if (categoryBreakdown.length === 0) {
              return <p className={analyticsEmptyStateClass}>No data for this period</p>;
            }
            return (
              <div className="space-y-3">
                {categoryBreakdown.map(({ category, time, percent }) => {
                  const info = getCategoryInfoWithOverrides(category, customCategories, builtInOverrides);
                  return (
                    <div key={category} className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${info.color}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium">{info.name}</span>
                          <span className="text-sm text-muted-foreground tabular-nums">{formatTime(time)}</span>
                        </div>
                        <div className={analyticsBarTrackClass}>
                          <div
                            className={`h-full ${info.color} transition-[width] duration-300 ease-out`}
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>
                      <span className="w-12 text-right text-xs text-muted-foreground tabular-nums">{percent.toFixed(1)}%</span>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      </div>

      {/* Daily breakdown Chart */}
      <div className={`${analyticsPanelClass} mb-6`}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Daily breakdown</h2>
          {hoveredSegment && (
            <div className="flex animate-fade-in items-center gap-2 rounded-lg bg-foreground px-3 py-1.5 text-xs text-background shadow-[var(--shadow-border)]">
              <div className={`h-2 w-2 rounded-full ${DOMAIN_COLORS[topSites.findIndex(([d]) => d === hoveredSegment.domain) % DOMAIN_COLORS.length] || 'bg-muted-foreground'}`} />
              <span className="font-medium">{hoveredSegment.domain}</span>
              <span className="text-background/60">•</span>
              <span className="tabular-nums">{formatTime(hoveredSegment.time)}</span>
              <span className="text-background/60 tabular-nums">({hoveredSegment.percent.toFixed(1)}%)</span>
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
                <span className="w-20 text-xs text-muted-foreground">{formatDate(stats.date)}</span>
                <div className="flex h-8 flex-1 overflow-hidden rounded-lg bg-muted shadow-[inset_0_0_0_1px_rgba(0,0,0,0.04)] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]">
                  {stats.totalTime > 0 ? (
                    sortedSites.map(([domain, time]) => {
                      const colorIndex = topDomainIndices.get(domain) ?? 9;
                      const widthPercent = (time / maxDailyTime) * 100;
                      if (widthPercent < 0.5) return null;
                      return (
                        <div
                          key={domain}
                          className={`h-full ${DOMAIN_COLORS[colorIndex % DOMAIN_COLORS.length]} cursor-pointer transition-opacity duration-150 ease-out hover:opacity-80`}
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
                    <div className="flex flex-1 items-center justify-center text-xs text-muted-foreground">
                      No activity
                    </div>
                  )}
                </div>
                <span className="w-14 text-right text-xs text-muted-foreground tabular-nums">
                  {formatTime(stats.totalTime)}
                </span>
              </div>
            );
          })}
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          Hover over segments to see domain details. Colors match the top sites list above.
        </p>
      </div>

      {/* YouTube channels - only shown when tracking is enabled */}
      {settings?.youtubeTrackingEnabled && (
        <div id="youtube-channels" className={analyticsPanelClass}>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Video className="w-5 h-5 text-red-600" />
            YouTube channels
          </h2>
          {loadingSessions ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-red-600"></div>
            </div>
          ) : (() => {
            const allYouTubeSessions = sessionData.youtubeSessions;

            if (allYouTubeSessions.length === 0) {
              return (
                <p className={analyticsEmptyStateClass}>
                  No YouTube activity recorded in this period
                </p>
              );
            }

            const channelStats = computeYouTubeStatsWithUrlsLegacy(allYouTubeSessions);

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
                <div className="mb-4 flex items-center justify-between text-sm text-muted-foreground">
                  <span className="tabular-nums">{sortedChannels.length} channel{sortedChannels.length !== 1 ? 's' : ''}</span>
                  <span className="tabular-nums">Total: {formatTime(totalYouTubeTime)}</span>
                </div>
                <div className={`space-y-4 max-h-[420px] transition-[max-height] duration-300 overflow-hidden ${youtubeExpanded ? 'overflow-y-auto' : ''}`}>
                {sortedChannels.map(([channel, stats], idx) => {
                  const percent = totalYouTubeTime > 0 ? (stats.time / totalYouTubeTime) * 100 : 0;
                  const barWidth = maxChannelTime > 0 ? (stats.time / maxChannelTime) * 100 : 0;
                  const channelUrl = stats.url || activeUrls[channel];

                  return (
                    <div key={channel}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium truncate flex items-center gap-2">
                          <span className="text-muted-foreground tabular-nums">{idx + 1}.</span>
                          {channelUrl ? (
                            <a
                              href={channelUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="transition-colors duration-150 ease-out hover:text-red-600 hover:underline"
                            >
                              {channel}
                            </a>
                          ) : (
                            channel
                          )}
                        </span>
                        <span className="flex items-center gap-2 text-muted-foreground tabular-nums">
                          {formatTime(stats.time)}
                          <span className="text-xs text-muted-foreground/75">({percent.toFixed(1)}%)</span>
                        </span>
                      </div>
                      <div className={analyticsBarTrackClass}>
                        <div
                          className="h-full bg-red-500 rounded-full transition-[width] duration-300 ease-out"
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
                      className="flex min-h-10 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-primary transition-[background-color,color,transform] duration-150 ease-out hover:bg-muted hover:text-primary/80 active:scale-[0.96]"
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
