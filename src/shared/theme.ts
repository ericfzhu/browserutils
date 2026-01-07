import { Settings } from './types';

type ThemeSetting = Settings['theme'];
type EffectiveTheme = 'light' | 'dark';

// Get the effective theme based on setting and system preference
export function getEffectiveTheme(setting: ThemeSetting): EffectiveTheme {
  if (setting === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return setting;
}

// Apply theme by adding/removing 'dark' class on <html>
export function applyTheme(setting: ThemeSetting): void {
  const effectiveTheme = getEffectiveTheme(setting);
  if (effectiveTheme === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
}

// Initialize theme on page load
export async function initTheme(): Promise<void> {
  try {
    const result = await chrome.storage.local.get('settings');
    const settings = result.settings as Settings | undefined;
    const theme = settings?.theme || 'system';
    applyTheme(theme);

    // If using system theme, listen for changes
    if (theme === 'system') {
      watchSystemTheme();
    }
  } catch {
    // Default to system theme if storage access fails
    applyTheme('system');
    watchSystemTheme();
  }
}

// Watch for system theme changes
let mediaQuery: MediaQueryList | null = null;

export function watchSystemTheme(): void {
  if (mediaQuery) return; // Already watching

  mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  mediaQuery.addEventListener('change', (e) => {
    // Only apply if current setting is 'system'
    chrome.storage.local.get('settings').then((result) => {
      const settings = result.settings as Settings | undefined;
      if (!settings?.theme || settings.theme === 'system') {
        if (e.matches) {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      }
    });
  });
}

// Stop watching system theme
export function unwatchSystemTheme(): void {
  mediaQuery = null;
}
