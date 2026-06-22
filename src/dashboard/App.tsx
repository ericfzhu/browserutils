import { useState, useEffect } from 'react';
import { Routes, Route, NavLink, Link } from 'react-router-dom';
import { BarChart3, Shield, Settings, LayoutDashboard, Sparkles, Timer, Tag } from 'lucide-react';
import Overview from './pages/Overview';
import BlockedSites from './pages/BlockedSites';
import Limits from './pages/Limits';
import Metrics from './pages/Metrics';
import Categories from './pages/Categories';
import SettingsPage from './pages/Settings';
import Changelog, { CURRENT_VERSION } from './pages/Changelog';
import { LockdownProvider, useLockdown } from './hooks/useLockdown';
import LockdownAuthModal from '../shared/components/LockdownAuthModal';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Overview' },
  { to: '/blocked', icon: Shield, label: 'Blocked Sites' },
  { to: '/limits', icon: Timer, label: 'Daily Limits' },
  { to: '/metrics', icon: BarChart3, label: 'Metrics' },
  { to: '/categories', icon: Tag, label: 'Categories' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

// Component that handles the lockdown password modal
function LockdownModal() {
  const { status, showAuthModal, setShowAuthModal, authenticate, pendingAction, clearSession } = useLockdown();

  // Clear session when dashboard is closed
  useEffect(() => {
    const handleBeforeUnload = () => {
      clearSession();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [clearSession]);

  async function handleAuthSubmit(credential: string) {
    const result = await authenticate(credential);
    if (result.success && pendingAction) {
      // Execute the pending action after successful authentication
      await pendingAction();
    }
    return result;
  }

  return (
    <LockdownAuthModal
      isOpen={showAuthModal}
      onClose={() => setShowAuthModal(false)}
      onSubmit={handleAuthSubmit}
      authMethod={status?.authMethod ?? 'password'}
    />
  );
}

export default function App() {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <LockdownProvider>
      <LockdownModal />
      <div className="flex min-h-screen bg-background text-foreground">
      {/* Sidebar */}
      <nav className="sticky top-0 flex h-screen w-64 flex-col bg-[var(--sidebar)] p-4 text-[var(--sidebar-foreground)] shadow-[inset_-1px_0_0_rgba(0,0,0,0.08),8px_0_24px_-24px_rgba(0,0,0,0.55)] backdrop-blur dark:shadow-[inset_-1px_0_0_rgba(255,255,255,0.12),8px_0_28px_-24px_rgba(0,0,0,0.9)]">
        <div
          className="mb-8 flex cursor-default items-center gap-3 rounded-2xl p-2"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary shadow-[var(--shadow-border)]">
            <Shield className="size-6 text-primary-foreground" />
          </div>
          <div className="min-w-0">
            <h1 className="relative h-6 overflow-hidden font-bold">
              <span
                className={`inline-block transition-[transform,opacity] duration-300 ease-out ${
                  isHovered ? 'opacity-0 -translate-y-full' : 'opacity-100 translate-y-0'
                }`}
              >
                BrowserUtils
              </span>
              <span
                className={`absolute left-0 top-0 transition-[transform,opacity] duration-300 ease-out ${
                  isHovered ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-full'
                }`}
              >
                Boyoung😘Utils
              </span>
            </h1>
            <p className="text-xs text-muted-foreground">Focus & Productivity</p>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  'flex min-h-10 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-[background-color,color,box-shadow,transform] duration-150 ease-out active:scale-[0.96]',
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-[var(--shadow-border)]'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )
              }
            >
              <Icon className="size-5" />
              {label}
            </NavLink>
          ))}
        </div>

        <div className="mt-auto flex flex-col gap-2 pt-4">
          <Separator />
          <Link
            to="/changelog"
            className="flex min-h-10 items-center gap-2 rounded-xl px-3 text-sm text-muted-foreground transition-[background-color,color,transform] duration-150 ease-out hover:bg-muted hover:text-foreground active:scale-[0.96]"
          >
            <Sparkles className="size-4" />
            What's New
          </Link>
          <p className="text-center text-xs text-muted-foreground tabular-nums">v{CURRENT_VERSION}</p>
        </div>
      </nav>

      {/* Main content */}
      <main className="flex-1 overflow-auto p-8">
        <div className="mx-auto max-w-6xl">
        <Routes>
          <Route path="/" element={<Overview />} />
          <Route path="/blocked" element={<BlockedSites />} />
          <Route path="/limits" element={<Limits />} />
          <Route path="/metrics" element={<Metrics />} />
          <Route path="/categories" element={<Categories />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/changelog" element={<Changelog />} />
        </Routes>
        </div>
      </main>
    </div>
    </LockdownProvider>
  );
}
