import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Clock, Globe, Shield, TrendingUp, Layers, ArrowRight } from 'lucide-react';
import { DailyStats, BlockedSite, SiteSession } from '../../shared/types';

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

  // Group sessions by domain
  const sessionsByDomain = new Map<string, SiteSession[]>();
  sessions.forEach(session => {
    const existing = sessionsByDomain.get(session.domain) || [];
    existing.push(session);
    sessionsByDomain.set(session.domain, existing);
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
      <div className="text-center py-6 text-gray-500">
        No activity recorded yet today
      </div>
    );
  }

  if (sortedSites.length > 0 && sessions.length === 0) {
    return (
      <div className="text-center py-6 text-gray-500">
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
          const domainSessions = sessionsByDomain.get(domain) || [];
          const color = getDomainColor(domain);
          const windowIds = new Set(domainSessions.map(s => s.windowId));
          const hasMultipleWindows = windowIds.size > 1;

          return (
            <div key={domain} className="flex items-center gap-2">
              <div className="w-28 flex-shrink-0">
                <div className="flex items-center gap-1">
                  <span className="text-xs font-medium truncate" title={domain}>
                    {domain.replace(/^www\./, '')}
                  </span>
                  {hasMultipleWindows && (
                    <span title="Multiple windows">
                      <Layers className="w-3 h-3 text-gray-400 flex-shrink-0" />
                    </span>
                  )}
                </div>
                <span className="text-xs text-gray-400">{formatTime(totalTime)}</span>
              </div>

              <div className="flex-1 relative h-5 bg-gray-100 rounded overflow-hidden">
                {hourMarkers.map(marker => (
                  <div
                    key={marker.hour}
                    className="absolute top-0 bottom-0 w-px bg-gray-200"
                    style={{ left: `${marker.position}%` }}
                  />
                ))}

                {domainSessions.map((session, idx) => {
                  const startPos = Math.max(0, ((session.startTime - minTime) / timeRange) * 100);
                  const endPos = Math.min(100, ((session.endTime - minTime) / timeRange) * 100);
                  const width = Math.max(0.5, endPos - startPos);

                  return (
                    <div
                      key={idx}
                      className={`absolute top-0.5 bottom-0.5 ${color} rounded-sm opacity-80`}
                      style={{ left: `${startPos}%`, width: `${width}%` }}
                      title={`${formatTimeOfDay(session.startTime)} - ${formatTimeOfDay(session.endTime)}`}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Link to full timeline */}
      {sortedSites.length > DISPLAY_COUNT && (
        <Link
          to="/metrics"
          className="mt-3 flex items-center justify-center gap-1 text-sm text-blue-600 hover:text-blue-700"
        >
          View all {sortedSites.length} sites
          <ArrowRight className="w-4 h-4" />
        </Link>
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
  const [loading, setLoading] = useState(true);

  const today = getDateString(new Date());

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [stats, sites] = await Promise.all([
        chrome.runtime.sendMessage({ type: 'GET_STATS', payload: { date: today } }),
        chrome.runtime.sendMessage({ type: 'GET_BLOCKED_SITES' }),
      ]);
      setTodayStats(stats);
      setBlockedSites(sites);
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setLoading(false);
    }
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
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Overview</h1>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Clock className="w-5 h-5 text-blue-600" />
            </div>
            <span className="text-sm text-gray-500">Time Today</span>
          </div>
          <p className="text-2xl font-bold">{formatTime(todayStats?.totalTime || 0)}</p>
        </div>

        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-green-100 rounded-lg">
              <Globe className="w-5 h-5 text-green-600" />
            </div>
            <span className="text-sm text-gray-500">Sites Visited</span>
          </div>
          <p className="text-2xl font-bold">{Object.keys(todayStats?.sites || {}).length}</p>
        </div>

        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-red-100 rounded-lg">
              <Shield className="w-5 h-5 text-red-600" />
            </div>
            <span className="text-sm text-gray-500">Blocks Today</span>
          </div>
          <p className="text-2xl font-bold">{todayStats?.blockedAttempts || 0}</p>
        </div>

        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-purple-100 rounded-lg">
              <TrendingUp className="w-5 h-5 text-purple-600" />
            </div>
            <span className="text-sm text-gray-500">Active Blocks</span>
          </div>
          <p className="text-2xl font-bold">{blockedSites.filter(s => s.enabled).length}</p>
        </div>
      </div>

      {/* Activity Timeline Preview */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Today's Activity</h2>
          <Link to="/metrics" className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1">
            Full timeline
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
        <TimelinePreview
          sessions={todayStats?.sessions || []}
          sites={todayStats?.sites || {}}
        />
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Top Sites Today */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold mb-4">Top Sites Today</h2>
          {topSites.length > 0 ? (
            <div className="space-y-3">
              {topSites.map(([domain, time], index) => (
                <div key={domain} className="flex items-center gap-3">
                  <span className="text-sm text-gray-400 w-4">{index + 1}</span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium truncate">{domain}</span>
                      <span className="text-sm text-gray-500">{formatTime(time)}</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-600 rounded-full"
                        style={{
                          width: `${Math.min(100, (time / (todayStats?.totalTime || 1)) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">No activity recorded yet</p>
          )}
        </div>

        {/* Blocked Sites */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold mb-4">Blocked Sites</h2>
          {blockedSites.length > 0 ? (
            <div className="space-y-2">
              {blockedSites.slice(0, 5).map((site) => (
                <div
                  key={site.id}
                  className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg"
                >
                  <span className="text-sm font-medium">{site.pattern}</span>
                  <span
                    className={`text-xs px-2 py-1 rounded-full ${
                      site.enabled
                        ? 'bg-red-100 text-red-700'
                        : 'bg-gray-200 text-gray-600'
                    }`}
                  >
                    {site.enabled ? 'Blocking' : 'Disabled'}
                  </span>
                </div>
              ))}
              {blockedSites.length > 5 && (
                <p className="text-sm text-gray-500 text-center pt-2">
                  +{blockedSites.length - 5} more
                </p>
              )}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">No blocked sites configured</p>
          )}
        </div>
      </div>
    </div>
  );
}
