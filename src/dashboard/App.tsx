import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { Routes, Route, NavLink, useLocation } from 'react-router-dom';
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
      try {
        await pendingAction();
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : 'The requested change failed',
        };
      }
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
  const { pathname } = useLocation();
  const mainRef = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    mainRef.current?.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [pathname]);

  return (
    <LockdownProvider>
      <LockdownModal />
      <div className="flex h-screen overflow-hidden bg-background text-foreground">
      {/* Sidebar */}
      <nav className="flex h-full w-16 shrink-0 flex-col overflow-y-auto sm:w-56 border-r border-[var(--sidebar-border)] bg-[var(--sidebar)] p-2 sm:p-4 text-[var(--sidebar-foreground)]">
        <div
          className="mb-8 grid min-h-11 cursor-default grid-cols-[36px] sm:grid-cols-[36px_1fr] items-center gap-3"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          <div className="flex size-9 items-center justify-center bg-primary shadow-[var(--shadow-border)]">
            <Shield className="size-5 text-primary-foreground" />
          </div>
          <div className="hidden min-w-0 sm:block">
            <div className="relative h-6 overflow-hidden font-bold">
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
            </div>
            <p className="text-xs text-muted-foreground">Focus & Productivity</p>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              aria-label={label}
              title={label}
              className={({ isActive }) =>
                cn(
                  'grid min-h-11 grid-cols-[36px] sm:grid-cols-[36px_1fr] items-center gap-3 border-l-2 px-0 text-sm font-medium transition-[background-color,color,box-shadow,border-color] duration-150 ease-out',
                  isActive
                    ? 'border-primary bg-primary text-primary-foreground shadow-[var(--shadow-border)]'
                    : 'border-transparent text-muted-foreground hover:border-[var(--sidebar-primary)] hover:bg-[var(--sidebar-accent)] hover:text-[var(--sidebar-accent-foreground)]'
                )
              }
            >
              <span className="-ml-0.5 flex size-9 items-center justify-center"><Icon className="size-5" /></span>
              <span className="hidden sm:inline">{label}</span>
            </NavLink>
          ))}
        </div>

        <div className="mt-auto flex flex-col gap-2 pt-4">
          <Separator />
          <NavLink
            to="/changelog"
            aria-label="What’s New"
            title="What’s New"
            className={({ isActive }) =>
              cn(
                'grid min-h-11 grid-cols-[36px] sm:grid-cols-[36px_1fr] items-center gap-3 border-l-2 px-0 text-sm transition-[background-color,color,box-shadow,border-color] duration-150 ease-out',
                isActive
                  ? 'border-primary bg-primary text-primary-foreground shadow-[var(--shadow-border)]'
                  : 'border-transparent text-muted-foreground hover:border-[var(--sidebar-primary)] hover:bg-[var(--sidebar-accent)] hover:text-[var(--sidebar-accent-foreground)]'
              )
            }
          >
            <span className="-ml-0.5 flex size-9 items-center justify-center"><Sparkles className="size-4" /></span>
            <span className="hidden sm:inline">What’s New</span>
          </NavLink>
          <NavLink
            to="/settings"
            aria-label="Settings"
            title="Settings"
            className={({ isActive }) =>
              cn(
                'grid min-h-11 grid-cols-[36px] sm:grid-cols-[36px_1fr] items-center gap-3 border-l-2 px-0 text-sm transition-[background-color,color,box-shadow,border-color] duration-150 ease-out',
                isActive
                  ? 'border-primary bg-primary text-primary-foreground shadow-[var(--shadow-border)]'
                  : 'border-transparent text-muted-foreground hover:border-[var(--sidebar-primary)] hover:bg-[var(--sidebar-accent)] hover:text-[var(--sidebar-accent-foreground)]'
              )
            }
          >
            <span className="-ml-0.5 flex size-9 items-center justify-center"><Settings className="size-4" /></span>
            <span className="hidden sm:inline">Settings</span>
          </NavLink>
          <p className="hidden text-center text-xs sm:block text-muted-foreground tabular-nums">v{CURRENT_VERSION}</p>
        </div>
      </nav>

      {/* Main content */}
      <main ref={mainRef} className="min-w-0 flex-1 overflow-auto p-4 md:p-8">
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
