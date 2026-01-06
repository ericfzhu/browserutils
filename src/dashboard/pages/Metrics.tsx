import { useEffect, useState } from 'react';
import { Calendar, Clock, TrendingDown, TrendingUp } from 'lucide-react';
import { DailyStats } from '../../shared/types';

function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
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

export default function Metrics() {
  const [allStats, setAllStats] = useState<Record<string, DailyStats>>({});
  const [selectedPeriod, setSelectedPeriod] = useState<'week' | 'month'>('week');
  const [loading, setLoading] = useState(true);
  const [hoveredSegment, setHoveredSegment] = useState<{ date: string; domain: string; time: number; percent: number } | null>(null);

  useEffect(() => {
    loadStats();
  }, []);

  async function loadStats() {
    try {
      const result = await chrome.runtime.sendMessage({ type: 'GET_STATS' });
      setAllStats(result);
    } catch (err) {
      console.error('Failed to load stats:', err);
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

  // Get dates for selected period
  const today = new Date();
  const periodDays = selectedPeriod === 'week' ? 7 : 30;
  const dates: string[] = [];
  for (let i = periodDays - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    dates.push(date.toISOString().split('T')[0]);
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
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    prevDates.push(date.toISOString().split('T')[0]);
  }
  const prevStats = prevDates.map((date) => allStats[date] || { totalTime: 0 });
  const prevTotalTime = prevStats.reduce((sum, s) => sum + s.totalTime, 0);
  const timeChange = prevTotalTime > 0 ? ((totalTime - prevTotalTime) / prevTotalTime) * 100 : 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Metrics</h1>
        <div className="flex bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setSelectedPeriod('week')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              selectedPeriod === 'week' ? 'bg-white shadow text-gray-900' : 'text-gray-600'
            }`}
          >
            Week
          </button>
          <button
            onClick={() => setSelectedPeriod('month')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              selectedPeriod === 'month' ? 'bg-white shadow text-gray-900' : 'text-gray-600'
            }`}
          >
            Month
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-500">Total Time</span>
            <Clock className="w-5 h-5 text-gray-400" />
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

        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-500">Daily Average</span>
            <Calendar className="w-5 h-5 text-gray-400" />
          </div>
          <p className="text-2xl font-bold">{formatTime(avgDailyTime)}</p>
          <p className="text-sm text-gray-500 mt-1">per day</p>
        </div>

        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-500">Sites Blocked</span>
            <TrendingDown className="w-5 h-5 text-gray-400" />
          </div>
          <p className="text-2xl font-bold">{totalBlocks}</p>
          <p className="text-sm text-gray-500 mt-1">distractions avoided</p>
        </div>
      </div>

      {/* Top Sites - Full Width */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Top Sites ({selectedPeriod})</h2>
        {topSites.length > 0 ? (
          <div className="grid grid-cols-2 gap-x-8 gap-y-3">
            {topSites.map(([domain, time], index) => (
              <div key={domain} className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${DOMAIN_COLORS[index % DOMAIN_COLORS.length]}`} />
                <span className="text-sm text-gray-400 w-4">{index + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium truncate">{domain}</span>
                    <span className="text-sm text-gray-500 ml-2">{formatTime(time)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-center py-8">No data for this period</p>
        )}
      </div>

      {/* Daily Breakdown Chart */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
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
                <span className="text-xs text-gray-500 w-20">{formatDate(stats.date)}</span>
                <div className="flex-1 h-8 bg-gray-100 rounded-lg overflow-hidden flex">
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
                    <div className="flex-1 flex items-center justify-center text-xs text-gray-400">
                      No activity
                    </div>
                  )}
                </div>
                <span className="text-xs text-gray-600 w-14 text-right">
                  {formatTime(stats.totalTime)}
                </span>
              </div>
            );
          })}
        </div>
        <p className="text-xs text-gray-400 mt-4">
          Hover over segments to see domain details. Colors match the top sites list above.
        </p>
      </div>
    </div>
  );
}
