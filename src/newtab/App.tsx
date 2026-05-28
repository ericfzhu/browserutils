import { useEffect, useState } from 'react';
import { Plus, X, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { DailyStats, Settings as SettingsType, QuickLink } from '../shared/types';

function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

function getGreeting(): string {
  const now = new Date();
  const hour = now.getHours();

  // Get day of year (1-366) as a seed for deterministic selection
  const startOfYear = new Date(now.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((now.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24));

  // Select phrase based on day of year (same day = same phrase for each time period)
  const selectPhrase = (phrases: string[]) => phrases[dayOfYear % phrases.length];

  // Late night / early morning (12am - 4am)
  if (hour >= 0 && hour < 4) {
    return selectPhrase(['Hello, night owl', 'Burning the midnight oil', 'The night is still young', 'Late night thoughts']);
  }

  // Early morning (4am - 7am)
  if (hour >= 4 && hour < 7) {
    return selectPhrase(['Early bird', 'Rise and shine', 'Up before the sun', 'Fresh start']);
  }

  // Morning (7am - 12pm)
  if (hour >= 7 && hour < 12) {
    return selectPhrase(['Good morning', 'Morning', 'Hello there', 'Ready for today']);
  }

  // Afternoon (12pm - 5pm)
  if (hour >= 12 && hour < 17) {
    return selectPhrase(['Good afternoon', 'Afternoon', 'Hey there', 'How\'s your day going']);
  }

  // Evening (5pm - 9pm)
  if (hour >= 17 && hour < 21) {
    return selectPhrase(['Good evening', 'Evening', 'Winding down', 'Hope you had a good day']);
  }

  // Night (9pm - 12am)
  return selectPhrase(['Good night', 'Getting late', 'Evening thoughts', 'Night time']);
}

function formatClock(): string {
  return new Date().toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function formatDate(): string {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

function getFaviconUrl(url: string): string {
  try {
    const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
    return `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=64`;
  } catch {
    return '';
  }
}

function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
    // Remove www. prefix and return hostname
    return urlObj.hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export default function App() {
  const [time, setTime] = useState(formatClock());
  const [greeting] = useState(getGreeting());
  const [settings, setSettings] = useState<SettingsType | null>(null);
  const [stats, setStats] = useState<DailyStats | null>(null);
  const [showAddLink, setShowAddLink] = useState(false);
  const [newLinkUrl, setNewLinkUrl] = useState('');

  useEffect(() => {
    loadData();

    // Update clock every second
    const interval = setInterval(() => {
      setTime(formatClock());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  async function loadData() {
    try {
      const now = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const [settingsRes, statsRes] = await Promise.all([
        chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }),
        chrome.runtime.sendMessage({ type: 'GET_STATS', payload: { date: today } }),
      ]);
      setSettings(settingsRes);
      setStats(statsRes);
    } catch (err) {
      console.error('Failed to load data:', err);
    }
  }

  async function addQuickLink() {
    if (!settings || !newLinkUrl) return;

    const fullUrl = newLinkUrl.startsWith('http') ? newLinkUrl : `https://${newLinkUrl}`;
    const domain = extractDomain(newLinkUrl);

    const link: QuickLink = {
      id: crypto.randomUUID(),
      name: domain.split('.')[0].charAt(0).toUpperCase() + domain.split('.')[0].slice(1), // Capitalize first part of domain
      url: fullUrl,
    };

    const updatedSettings = {
      ...settings,
      quickLinks: [...settings.quickLinks, link],
    };

    await chrome.runtime.sendMessage({
      type: 'UPDATE_SETTINGS',
      payload: { quickLinks: updatedSettings.quickLinks },
    });

    setSettings(updatedSettings);
    setNewLinkUrl('');
    setShowAddLink(false);
  }

  async function removeQuickLink(id: string) {
    if (!settings) return;

    const updatedLinks = settings.quickLinks.filter((l) => l.id !== id);
    await chrome.runtime.sendMessage({
      type: 'UPDATE_SETTINGS',
      payload: { quickLinks: updatedLinks },
    });

    setSettings({ ...settings, quickLinks: updatedLinks });
  }

  function openDashboard() {
    window.location.href = chrome.runtime.getURL('dashboard.html');
  }

  const topSites = stats
    ? Object.entries(stats.sites)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
    : [];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-4xl mx-auto px-4 py-16">
        {/* Header with settings */}
        <div className="absolute top-4 right-4">
          <Button
            onClick={openDashboard}
            variant="ghost"
            size="icon"
            title="Open Dashboard"
          >
            <Settings />
          </Button>
        </div>

        {/* Greeting & Time */}
        <div className="text-center mb-12">
          <h1 className="mb-2 text-4xl font-light text-muted-foreground">
            {greeting}
            {settings?.displayName && (
              <span className="text-primary">, {settings.displayName}</span>
            )}
          </h1>
          <div className="mb-2 text-6xl font-extralight tracking-tight">{time}</div>
          <p className="text-muted-foreground">{formatDate()}</p>
        </div>

        {/* Quick Links */}
        <div className="mb-12">
          <div className="flex flex-wrap justify-center gap-4">
            {settings?.quickLinks.map((link) => (
              <a
                key={link.id}
                href={link.url}
                className="group relative flex min-w-[100px] flex-col items-center gap-2 rounded-2xl border bg-card p-4 text-card-foreground shadow-sm transition-colors hover:bg-muted"
              >
                <Button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    removeQuickLink(link.id);
                  }}
                  className="absolute -right-2 -top-2 opacity-0 transition-opacity group-hover:opacity-100"
                  variant="destructive"
                  size="icon-xs"
                >
                  <X />
                </Button>
                <div className="flex size-12 items-center justify-center overflow-hidden rounded-xl bg-muted">
                  <img
                    src={getFaviconUrl(link.url)}
                    alt={link.name}
                    className="size-8"
                    onError={(e) => {
                      // Fallback to first letter if favicon fails
                      e.currentTarget.style.display = 'none';
                      e.currentTarget.parentElement!.innerHTML = `<span class="text-2xl text-muted-foreground">${link.name.charAt(0).toUpperCase()}</span>`;
                    }}
                  />
                </div>
                <span className="text-sm text-muted-foreground">{link.name}</span>
              </a>
            ))}

            {/* Add Link Button */}
            <Button
              onClick={() => setShowAddLink(true)}
              variant="outline"
              className="flex h-auto min-w-[100px] flex-col items-center gap-2 rounded-2xl border-dashed p-4"
            >
              <div className="flex size-12 items-center justify-center rounded-xl">
                <Plus className="size-6 text-muted-foreground" />
              </div>
              <span className="text-sm text-muted-foreground">Add</span>
            </Button>
          </div>
        </div>

        {/* Today's Stats */}
        <div className="max-w-sm mx-auto">
          <Card className="rounded-2xl shadow-sm">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">Today</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Browsing time</span>
                <span className="font-medium">{formatTime(stats?.totalTime || 0)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Sites visited</span>
                <span className="font-medium">{Object.keys(stats?.sites || {}).length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Distractions blocked</span>
                <span className="font-medium">{stats?.blockedAttempts || 0}</span>
              </div>

              {topSites.length > 0 && (
                <>
                  <Separator className="my-3" />
                  <p className="mb-2 text-xs text-muted-foreground">Top sites</p>
                  {topSites.map(([domain, siteTime]) => (
                    <div key={domain} className="flex items-center justify-between text-sm">
                      <span className="truncate text-muted-foreground">{domain}</span>
                      <span className="text-muted-foreground">{formatTime(siteTime)}</span>
                    </div>
                  ))}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Add Link Modal */}
      <Dialog open={showAddLink} onOpenChange={setShowAddLink}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Quick Link</DialogTitle>
            <DialogDescription>Favicon and name will be auto-detected.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
              <div>
                <Input
                  type="text"
                  value={newLinkUrl}
                  onChange={(e) => setNewLinkUrl(e.target.value)}
                  placeholder="Enter URL (e.g., github.com)"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newLinkUrl) {
                      addQuickLink();
                    }
                  }}
                />
              </div>
              <DialogFooter>
                <Button
                  onClick={() => {
                    setShowAddLink(false);
                    setNewLinkUrl('');
                  }}
                  variant="outline"
                >
                  Cancel
                </Button>
                <Button
                  onClick={addQuickLink}
                  disabled={!newLinkUrl}
                >
                  Add
                </Button>
              </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
