import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Clock, Globe, Shield, TrendingUp, Layers, Video } from 'lucide-react';
import { DailyStats, BlockedSite, SiteSession, DailyLimit, Settings, ActiveYouTubeSession, CompactSessions, CompactYouTubeSessions } from '../../shared/types';
import { CATEGORIES, getCategoryForDomain, getCategoryInfo } from '../../shared/categories';
import { computeYouTubeStatsWithUrls } from '../../shared/storage';

// Expand compact sessions to SiteSession[] for UI components
function expandCompactSessions(sessions: CompactSessions | undefined): SiteSession[] {
  if (!sessions || Array.isArray(sessions)) return [];
  const result: SiteSession[] = [];
  for (const [domain, times] of Object.entries(sessions)) {
    for (const [startSec, endSec] of times) {
      result.push({
        domain,
        startTime: startSec * 1000,
        endTime: endSec * 1000,
        windowId: 0,
      });
    }
  }
  return result;
}

function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

function formatTimeOfDay(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
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

interface TimelinePreviewProps {
  sessions: SiteSession[];
  sites: Record<string, number>;
}

const panelClass = 'rounded-2xl bg-card p-6 text-card-foreground shadow-[var(--shadow-card)]';
const statCardClass = 'rounded-2xl bg-card p-6 text-card-foreground shadow-[var(--shadow-card)]';
const barTrackClass = 'h-2 overflow-hidden rounded-full bg-muted';
const linkClass = 'text-sm font-medium text-primary transition-colors duration-150 ease-out hover:text-primary/80 hover:underline';

// Simplified timeline preview for Overview - shows top 5 sites, no navigation
function TimelinePreview({ sessions, sites }: TimelinePreviewProps) {
  const DISPLAY_COUNT = 5;

  const now = new Date();
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  const dayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

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

  // If no sessions, show 8am to current time
  if (sessions.length === 0) {
    minTime = dayStart.getTime() + 8 * 60 * 60 * 1000;
    maxTime = now.getTime();
  }

  const timeRange = Math.max(maxTime - minTime, 1);

  // Sort sites by total time, take top 5
  const sortedSites = Object.entries(sites).sort((a, b) => b[1] - a[1]);
  const displayedSites = sortedSites.slice(0, DISPLAY_COUNT);

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

  // Generate hour markers
  const hourMarkers: { hour: number; label: string; position: number }[] = [];
  const startHour = new Date(minTime).getHours();
  const endHour = new Date(maxTime).getHours();
  for (let h = startHour; h <= endHour; h++) {
    const markerTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, 0, 0).getTime();
    if (markerTime >= minTime && markerTime <= maxTime) {
      const position = ((markerTime - minTime) / timeRange) * 100;
      hourMarkers.push({
        hour: h,
        label: h === 0 ? '12am' : h < 12 ? `${h}am` : h === 12 ? '12pm' : `${h - 12}pm`,
        position,
      });
    }
  }

  if (sortedSites.length === 0 && sessions.length === 0) {
    return (
      <div className="py-6 text-center text-muted-foreground">
        No activity recorded yet today
      </div>
    );
  }

  if (sortedSites.length > 0 && sessions.length === 0) {
    return (
      <div className="py-6 text-center text-muted-foreground">
        <p>Timeline data will appear as you browse.</p>
        <p className="text-xs mt-1">Session tracking has just been enabled.</p>
      </div>
    );
  }

  return (
    <div>
      {/* Time axis header */}
      <div className="relative mb-2 ml-32 h-5">
        {hourMarkers.map(marker => (
          <div
            key={marker.hour}
            className="absolute text-xs text-muted-foreground"
            style={{ left: `${marker.position}%`, transform: 'translateX(-50%)' }}
          >
            {marker.label}
          </div>
        ))}
      </div>

      {/* Timeline rows */}
      <div className="space-y-1.5">
        {displayedSites.map(([domain, totalTime]) => {
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
                {hourMarkers.map(marker => (
                  <div
                    key={marker.hour}
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
                      className={`absolute bottom-0.5 top-0.5 ${color} rounded-md opacity-80`}
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

      {/* More sites indicator */}
      {sortedSites.length > DISPLAY_COUNT && (
        <p className="pt-2 text-center text-sm text-muted-foreground tabular-nums">
          +{sortedSites.length - DISPLAY_COUNT} more sites
        </p>
      )}
    </div>
  );
}

function getDateString(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export default function Overview() {
  const [todayStats, setTodayStats] = useState<DailyStats | null>(null);
  const [blockedSites, setBlockedSites] = useState<BlockedSite[]>([]);
  const [dailyLimits, setDailyLimits] = useState<DailyLimit[]>([]);
  const [domainCategories, setDomainCategories] = useState<Record<string, string>>({});
  const [settings, setSettings] = useState<Settings | null>(null);
  const [activeYoutubeSessions, setActiveYoutubeSessions] = useState<Record<number, ActiveYouTubeSession>>({});
  const [loading, setLoading] = useState(true);

  const today = getDateString(new Date());

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [stats, sites, limits, categories, settingsResult, activeYt] = await Promise.all([
        chrome.runtime.sendMessage({ type: 'GET_STATS', payload: { date: today } }),
        chrome.runtime.sendMessage({ type: 'GET_BLOCKED_SITES' }),
        chrome.runtime.sendMessage({ type: 'GET_DAILY_LIMITS' }),
        chrome.runtime.sendMessage({ type: 'GET_DOMAIN_CATEGORIES' }),
        chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }),
        chrome.runtime.sendMessage({ type: 'GET_ACTIVE_YOUTUBE_SESSIONS' }),
      ]);
      setTodayStats(stats);
      setBlockedSites(sites);
      setDailyLimits(limits || []);
      setDomainCategories(categories || {});
      setSettings(settingsResult);
      setActiveYoutubeSessions(activeYt || {});
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  }

  // Calculate category breakdown for today
  function getCategoryBreakdown(): { category: string; time: number; percent: number }[] {
    if (!todayStats?.sites) return [];

    const categoryTotals: Record<string, number> = {};
    let totalTime = 0;

    for (const [domain, time] of Object.entries(todayStats.sites)) {
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

  // Get limits that are approaching but not yet exceeded.
  function getLimitsApproaching(): { limit: DailyLimit; timeSpent: number; percent: number }[] {
    if (!todayStats?.sites) return [];

    return dailyLimits
      .filter(limit => limit.enabled)
      .map(limit => {
        const domain = limit.pattern.replace(/^www\./, '');
        const timeSpent = todayStats.sites[domain] || todayStats.sites['www.' + domain] || todayStats.sites[limit.pattern] || 0;
        const percent = (timeSpent / limit.limitSeconds) * 100;
        return { limit, timeSpent, percent };
      })
      .filter(item => item.percent >= 70 && item.percent < 100)
      .sort((a, b) => b.percent - a.percent);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-primary"></div>
      </div>
    );
  }

  const topSites = todayStats
    ? Object.entries(todayStats.sites)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
    : [];

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-foreground">Overview</h1>

      {/* Stats Cards */}
      <div className="mb-6 grid grid-cols-4 gap-4">
        <div className={statCardClass}>
          <div className="flex items-center gap-3 mb-2">
            <div className="rounded-xl bg-blue-100 p-2 dark:bg-blue-900/50">
              <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <span className="text-sm text-muted-foreground">Time today</span>
          </div>
          <p className="text-2xl font-bold tabular-nums">{formatTime(todayStats?.totalTime || 0)}</p>
        </div>

        <div className={statCardClass}>
          <div className="flex items-center gap-3 mb-2">
            <div className="rounded-xl bg-green-100 p-2 dark:bg-green-900/50">
              <Globe className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <span className="text-sm text-muted-foreground">Sites visited</span>
          </div>
          <p className="text-2xl font-bold tabular-nums">{Object.keys(todayStats?.sites || {}).length}</p>
        </div>

        <div className={statCardClass}>
          <div className="flex items-center gap-3 mb-2">
            <div className="rounded-xl bg-red-100 p-2 dark:bg-red-900/50">
              <Shield className="h-5 w-5 text-red-600 dark:text-red-400" />
            </div>
            <span className="text-sm text-muted-foreground">Blocks today</span>
          </div>
          <p className="text-2xl font-bold tabular-nums">{todayStats?.blockedAttempts || 0}</p>
        </div>

        <div className={statCardClass}>
          <div className="flex items-center gap-3 mb-2">
            <div className="rounded-xl bg-purple-100 p-2 dark:bg-purple-900/50">
              <TrendingUp className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
            <span className="text-sm text-muted-foreground">Active blocks</span>
          </div>
          <p className="text-2xl font-bold tabular-nums">{blockedSites.filter(s => s.enabled).length}</p>
        </div>
      </div>

      {/* Activity Timeline Preview */}
      <div className={`${panelClass} mb-6`}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Today's activity</h2>
          <Link to="/metrics#activity-timeline" className={linkClass}>
            View all
          </Link>
        </div>
        <TimelinePreview
          sessions={expandCompactSessions(todayStats?.sessions as CompactSessions)}
          sites={todayStats?.sites || {}}
        />
      </div>

      <div className="grid grid-cols-2 gap-6 mb-6">
        {/* Top Sites Today */}
        <div className={panelClass}>
          <h2 className="text-lg font-semibold mb-4">Top sites today</h2>
          {topSites.length > 0 ? (
            <div className="space-y-3">
              {(() => {
                const maxSiteTime = topSites[0]?.[1] || 1;
                return topSites.map(([domain, time], index) => (
                  <div key={domain} className="flex items-center gap-3">
                    <span className="w-4 text-sm text-muted-foreground tabular-nums">{index + 1}</span>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <a
                          href={`https://${domain}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="truncate text-sm font-medium transition-colors duration-150 ease-out hover:text-primary hover:underline"
                        >
                          {domain}
                        </a>
                        <span className="text-sm text-muted-foreground tabular-nums">{formatTime(time)}</span>
                      </div>
                      <div className={barTrackClass}>
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{
                            width: `${(time / maxSiteTime) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ));
              })()}
            </div>
          ) : (
            <p className="py-8 text-center text-muted-foreground">No activity recorded yet</p>
          )}
        </div>

        {/* By Category Today */}
        <div className={panelClass}>
          <h2 className="text-lg font-semibold mb-4">By category</h2>
          {(() => {
            const categoryBreakdown = getCategoryBreakdown();
            if (categoryBreakdown.length === 0) {
              return <p className="py-8 text-center text-muted-foreground">No activity recorded yet</p>;
            }
            const maxCategoryTime = categoryBreakdown[0]?.time || 1;
            return (
              <div className="space-y-3">
                {categoryBreakdown.slice(0, 5).map(({ category, time }) => {
                  const info = getCategoryInfo(category);
                  const barWidth = (time / maxCategoryTime) * 100;
                  return (
                    <div key={category} className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${info.color}`} />
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium">{info.name}</span>
                          <span className="text-sm text-muted-foreground tabular-nums">{formatTime(time)}</span>
                        </div>
                        <div className={barTrackClass}>
                          <div
                            className={`h-full ${info.color} transition-[width] duration-300 ease-out`}
                            style={{ width: `${barWidth}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      </div>

      {/* Limits Approaching Warning */}
      {(() => {
        const approaching = getLimitsApproaching();
        if (approaching.length === 0) return null;
        return (
          <div className="mb-6 rounded-2xl bg-amber-50 p-4 shadow-[0_0_0_1px_rgba(245,158,11,0.24),0_10px_28px_-24px_rgba(245,158,11,0.6)] dark:bg-amber-900/20 dark:shadow-[0_0_0_1px_rgba(251,191,36,0.24)]">
            <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-300 mb-2">Limits approaching</h3>
            <div className="space-y-2">
              {approaching.map(({ limit, timeSpent, percent }) => (
                <div key={limit.id} className="flex items-center gap-3">
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-amber-900 dark:text-amber-200">{limit.pattern}</span>
                      <span className="text-xs text-amber-700 dark:text-amber-400 tabular-nums">
                        {formatTime(timeSpent)} / {formatTime(limit.limitSeconds)}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-amber-100 dark:bg-amber-900/50">
                      <div
                        className={`h-full rounded-full transition-[width] duration-300 ease-out ${
                          percent >= 90 ? 'bg-orange-500' : 'bg-amber-500'
                        }`}
                        style={{ width: `${Math.min(100, percent)}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-xs font-medium text-amber-600 tabular-nums">
                    {percent.toFixed(0)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* YouTube Channels - only shown when tracking is enabled */}
      {settings?.youtubeTrackingEnabled && (
        <div className={`${panelClass} mb-6`}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Video className="w-5 h-5 text-red-600" />
              YouTube channels
            </h2>
            <Link to="/metrics#youtube-channels" className={linkClass}>
              View all
            </Link>
          </div>
          {(() => {
            const youtubeSessions = (todayStats?.youtubeSessions || {}) as CompactYouTubeSessions;
            if (Object.keys(youtubeSessions).length === 0) {
              return (
                <p className="py-8 text-center text-muted-foreground">
                  No YouTube activity recorded today
                </p>
              );
            }
            const channelStats = computeYouTubeStatsWithUrls(youtubeSessions);

            // Build a map of channel URLs from active sessions (for channels without URLs in recorded sessions)
            const activeUrls: Record<string, string> = {};
            for (const session of Object.values(activeYoutubeSessions)) {
              if (session.channelUrl && session.channelName) {
                activeUrls[session.channelName] = session.channelUrl;
              }
            }

            const sortedChannels = Object.entries(channelStats)
              .sort((a, b) => b[1].time - a[1].time)
              .slice(0, 5);
            const maxChannelTime = sortedChannels[0]?.[1].time || 1;

            return (
              <div className="space-y-3">
                {sortedChannels.map(([channel, stats]) => {
                  const barWidth = (stats.time / maxChannelTime) * 100;
                  // Use URL from recorded sessions, or fall back to active session URL
                  const channelUrl = stats.url || activeUrls[channel];
                  return (
                    <div key={channel}>
                      <div className="flex justify-between text-sm mb-1">
                        {channelUrl ? (
                          <a
                            href={channelUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="truncate font-medium transition-colors duration-150 ease-out hover:text-red-600 hover:underline"
                          >
                            {channel}
                          </a>
                        ) : (
                          <span className="font-medium truncate">{channel}</span>
                        )}
                        <span className="text-muted-foreground tabular-nums">{formatTime(stats.time)}</span>
                      </div>
                      <div className={barTrackClass}>
                        <div
                          className="h-full rounded-full bg-red-500 transition-[width] duration-300 ease-out"
                          style={{ width: `${barWidth}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
                {Object.keys(channelStats).length > 5 && (
                  <p className="pt-2 text-center text-sm text-muted-foreground tabular-nums">
                    +{Object.keys(channelStats).length - 5} more channels
                  </p>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* Blocked Sites */}
      <div className={panelClass}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Blocked sites</h2>
          <Link to="/blocked" className={linkClass}>
            Manage
          </Link>
        </div>
        {blockedSites.length > 0 ? (
          <div className="grid grid-cols-2 gap-2">
            {blockedSites.slice(0, 6).map((site) => (
              <div
                key={site.id}
                className="flex items-center justify-between rounded-xl bg-muted px-3 py-2"
              >
                <span className="text-sm font-medium truncate">{site.pattern}</span>
                <span
                  className={`text-xs px-2 py-1 rounded-full flex-shrink-0 ${
                    site.enabled
                      ? 'bg-red-100 dark:bg-red-700/80 text-red-700 dark:text-red-200'
                      : 'bg-gray-200 dark:bg-gray-600/80 text-gray-600 dark:text-gray-300'
                  }`}
                >
                  {site.enabled ? 'On' : 'Off'}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="py-8 text-center text-muted-foreground">No blocked sites configured</p>
        )}
        {blockedSites.length > 6 && (
          <p className="pt-3 text-center text-sm text-muted-foreground tabular-nums">
            +{blockedSites.length - 6} more
          </p>
        )}
      </div>
    </div>
  );
}
