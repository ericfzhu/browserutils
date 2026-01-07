import { useState } from 'react';
import { Routes, Route, NavLink, Link } from 'react-router-dom';
import { BarChart3, Shield, Settings, LayoutDashboard, Sparkles, Timer } from 'lucide-react';
import Overview from './pages/Overview';
import BlockedSites from './pages/BlockedSites';
import Limits from './pages/Limits';
import Metrics from './pages/Metrics';
import SettingsPage from './pages/Settings';
import Changelog, { CURRENT_VERSION } from './pages/Changelog';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Overview' },
  { to: '/blocked', icon: Shield, label: 'Blocked Sites' },
  { to: '/limits', icon: Timer, label: 'Daily Limits' },
  { to: '/metrics', icon: BarChart3, label: 'Metrics' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export default function App() {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <nav className="w-64 bg-white border-r border-gray-200 p-4 flex flex-col h-screen sticky top-0">
        <div
          className="flex items-center gap-2 mb-8 cursor-default"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-gray-900 relative overflow-hidden h-6">
              <span
                className={`inline-block transition-all duration-300 ${
                  isHovered ? 'opacity-0 -translate-y-full' : 'opacity-100 translate-y-0'
                }`}
              >
                BrowserUtils
              </span>
              <span
                className={`absolute left-0 top-0 transition-all duration-300 ${
                  isHovered ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-full'
                }`}
              >
                Boyoung😘Utils
              </span>
            </h1>
            <p className="text-xs text-gray-500">Focus & Productivity</p>
          </div>
        </div>

        <div className="space-y-1">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`
              }
            >
              <Icon className="w-5 h-5" />
              {label}
            </NavLink>
          ))}
        </div>

        <div className="mt-auto pt-4 border-t space-y-2">
          <Link
            to="/changelog"
            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-blue-50 hover:text-blue-700 rounded-lg transition-colors"
          >
            <Sparkles className="w-4 h-4" />
            What's New
          </Link>
          <p className="text-xs text-gray-400 text-center">v{CURRENT_VERSION}</p>
        </div>
      </nav>

      {/* Main content */}
      <main className="flex-1 p-8 overflow-auto">
        <Routes>
          <Route path="/" element={<Overview />} />
          <Route path="/blocked" element={<BlockedSites />} />
          <Route path="/limits" element={<Limits />} />
          <Route path="/metrics" element={<Metrics />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/changelog" element={<Changelog />} />
        </Routes>
      </main>
    </div>
  );
}
