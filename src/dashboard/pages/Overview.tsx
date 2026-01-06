import { useEffect, useState } from 'react';
import { Clock, Globe, Shield, TrendingUp } from 'lucide-react';
import { DailyStats, BlockedSite } from '../../shared/types';

function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

export default function Overview() {
  const [todayStats, setTodayStats] = useState<DailyStats | null>(null);
  const [blockedSites, setBlockedSites] = useState<BlockedSite[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const now = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
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
