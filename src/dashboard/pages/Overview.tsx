import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Clock, Globe, Shield, TrendingUp, Layers, Youtube } from 'lucide-react';
import { DailyStats, BlockedSite, SiteSession, DailyLimit, Settings, ActiveYouTubeSession } from '../../shared/types';
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
      <div className="text-center py-6 text-gray-500 dark:text-gray-400">
        No activity recorded yet today
      </div>
    );
  }

  if (sortedSites.length > 0 && sessions.length === 0) {
    return (
      <div className="text-center py-6 text-gray-500 dark:text-gray-400">
        <p>Timeline data will appear as you browse.</p>
        <p className="text-xs mt-1">Session tracking has just been enabled.</p>
      </div>
    );
  }

  return (
    <div>
      {/* Time axis header */}
      <div className="relative h-5 mb-2 ml-32">
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

      {/* Timeline rows */}
      <div className="space-y-1.5">
        {displayedSites.map(([domain, totalTime]) => {
          const domainIntervals = sessionsByDomain.get(domain) || [];
          const color = getDomainColor(domain);
          // Check if original sessions had multiple windows
          const originalSessions = sessions.filter(s => s.domain === domain);
          const windowIds = new Set(originalSessions.map(s => s.windowId));
          const hasMultipleWindows = windowIds.size > 1;

          return (
            <div key={domain} className="flex items-center gap-2">
              <div className="w-28 flex-shrink-0">
                <div className="flex items-center gap-1">
                  <a
                    href={`https://${domain}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-medium truncate hover:text-blue-600 hover:underline"
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
                <span className="text-xs text-gray-400">{formatTime(totalTime)}</span>
              </div>

              <div className="flex-1 relative h-5 bg-gray-100 dark:bg-gray-700 rounded overflow-hidden">
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
                      className={`absolute top-0.5 bottom-0.5 ${color} rounded-sm opacity-80`}
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
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center pt-2">
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

  // Get limits that are approaching (>70% used)
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
      .filter(item => item.percent >= 70)
      .sort((a, b) => b.percent - a.percent);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
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
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">Overview</h1>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
              <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <span className="text-sm text-gray-500 dark:text-gray-400">Time today</span>
          </div>
          <p className="text-2xl font-bold">{formatTime(todayStats?.totalTime || 0)}</p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-green-100 dark:bg-green-900/50 rounded-lg">
              <Globe className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <span className="text-sm text-gray-500 dark:text-gray-400">Sites visited</span>
          </div>
          <p className="text-2xl font-bold">{Object.keys(todayStats?.sites || {}).length}</p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-red-100 dark:bg-red-900/50 rounded-lg">
              <Shield className="w-5 h-5 text-red-600 dark:text-red-400" />
            </div>
            <span className="text-sm text-gray-500 dark:text-gray-400">Blocks today</span>
          </div>
          <p className="text-2xl font-bold">{todayStats?.blockedAttempts || 0}</p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/50 rounded-lg">
              <TrendingUp className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <span className="text-sm text-gray-500 dark:text-gray-400">Active blocks</span>
          </div>
          <p className="text-2xl font-bold">{blockedSites.filter(s => s.enabled).length}</p>
        </div>
      </div>

      {/* Activity Timeline Preview */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Today's activity</h2>
          <Link to="/metrics#activity-timeline" className="text-sm text-blue-600 hover:text-blue-700">
            View all
          </Link>
        </div>
        <TimelinePreview
          sessions={todayStats?.sessions || []}
          sites={todayStats?.sites || {}}
        />
      </div>

      <div className="grid grid-cols-2 gap-6 mb-6">
        {/* Top Sites Today */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold mb-4">Top sites today</h2>
          {topSites.length > 0 ? (
            <div className="space-y-3">
              {(() => {
                const maxSiteTime = topSites[0]?.[1] || 1;
                return topSites.map(([domain, time], index) => (
                  <div key={domain} className="flex items-center gap-3">
                    <span className="text-sm text-gray-400 dark:text-gray-500 w-4">{index + 1}</span>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <a
                          href={`https://${domain}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-medium truncate hover:text-blue-600 hover:underline"
                        >
                          {domain}
                        </a>
                        <span className="text-sm text-gray-500 dark:text-gray-400">{formatTime(time)}</span>
                      </div>
                      <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-600 rounded-full"
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
            <p className="text-gray-500 dark:text-gray-400 text-center py-8">No activity recorded yet</p>
          )}
        </div>

        {/* By Category Today */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold mb-4">By category</h2>
          {(() => {
            const categoryBreakdown = getCategoryBreakdown();
            if (categoryBreakdown.length === 0) {
              return <p className="text-gray-500 dark:text-gray-400 text-center py-8">No activity recorded yet</p>;
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
                          <span className="text-sm text-gray-500 dark:text-gray-400">{formatTime(time)}</span>
                        </div>
                        <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${info.color} transition-all`}
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
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 mb-6">
            <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-300 mb-2">Limits approaching</h3>
            <div className="space-y-2">
              {approaching.map(({ limit, timeSpent, percent }) => (
                <div key={limit.id} className="flex items-center gap-3">
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-amber-900 dark:text-amber-200">{limit.pattern}</span>
                      <span className="text-xs text-amber-700 dark:text-amber-400">
                        {formatTime(timeSpent)} / {formatTime(limit.limitSeconds)}
                      </span>
                    </div>
                    <div className="h-2 bg-amber-100 dark:bg-amber-900/50 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          percent >= 100 ? 'bg-red-500' : percent >= 90 ? 'bg-orange-500' : 'bg-amber-500'
                        }`}
                        style={{ width: `${Math.min(100, percent)}%` }}
                      />
                    </div>
                  </div>
                  <span className={`text-xs font-medium ${percent >= 100 ? 'text-red-600' : 'text-amber-600'}`}>
                    {percent >= 100 ? 'Exceeded' : `${percent.toFixed(0)}%`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* YouTube Channels - only shown when tracking is enabled */}
      {settings?.youtubeTrackingEnabled && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Youtube className="w-5 h-5 text-red-600" />
              YouTube channels
            </h2>
            <Link to="/metrics#youtube-channels" className="text-sm text-blue-600 hover:text-blue-700">
              View all
            </Link>
          </div>
          {(() => {
            const youtubeSessions = todayStats?.youtubeSessions || [];
            if (youtubeSessions.length === 0) {
              return (
                <p className="text-gray-500 dark:text-gray-400 text-center py-8">
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
                            className="font-medium truncate hover:text-red-600 hover:underline"
                          >
                            {channel}
                          </a>
                        ) : (
                          <span className="font-medium truncate">{channel}</span>
                        )}
                        <span className="text-gray-500 dark:text-gray-400">{formatTime(stats.time)}</span>
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
                {Object.keys(channelStats).length > 5 && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 text-center pt-2">
                    +{Object.keys(channelStats).length - 5} more channels
                  </p>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* Blocked Sites */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Blocked sites</h2>
          <Link to="/blocked" className="text-sm text-blue-600 hover:text-blue-700">
            Manage
          </Link>
        </div>
        {blockedSites.length > 0 ? (
          <div className="grid grid-cols-2 gap-2">
            {blockedSites.slice(0, 6).map((site) => (
              <div
                key={site.id}
                className="flex items-center justify-between py-2 px-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
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
          <p className="text-gray-500 dark:text-gray-400 text-center py-8">No blocked sites configured</p>
        )}
        {blockedSites.length > 6 && (
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center pt-3">
            +{blockedSites.length - 6} more
          </p>
        )}
      </div>
    </div>
  );
}
