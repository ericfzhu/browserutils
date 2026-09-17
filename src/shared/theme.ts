import { Settings } from './types';

type ThemeSetting = Settings['theme'];
type ColorThemeSetting = NonNullable<Settings['colorTheme']>;
type EffectiveTheme = 'light' | 'dark';

let currentTheme: ThemeSetting = 'system';
let currentColor: ColorThemeSetting = 'monochrome';
let mediaQuery: MediaQueryList | null = null;
let initialized = false;

export function getEffectiveTheme(setting: ThemeSetting): EffectiveTheme {
  return setting === 'system'
    ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : setting;
}

export function applyTheme(setting: ThemeSetting, colorTheme: ColorThemeSetting = 'monochrome'): void {
  currentTheme = setting;
  currentColor = colorTheme;
  document.documentElement.classList.toggle('dark', getEffectiveTheme(setting) === 'dark');
  document.documentElement.dataset.colorTheme = colorTheme;
  if (setting === 'system') watchSystemTheme();
  else unwatchSystemTheme();
}

function onSystemThemeChange(): void {
  if (currentTheme === 'system') applyTheme(currentTheme, currentColor);
}

export function watchSystemTheme(): void {
  if (mediaQuery) return;
  mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  mediaQuery.addEventListener('change', onSystemThemeChange);
}

export function unwatchSystemTheme(): void {
  mediaQuery?.removeEventListener('change', onSystemThemeChange);
  mediaQuery = null;
}

function applySettings(settings?: Settings): void {
  applyTheme(settings?.theme ?? 'system', settings?.colorTheme ?? 'monochrome');
}

export async function initTheme(): Promise<void> {
  if (initialized) return;
  initialized = true;
  // Paint a system-appropriate canvas while persisted preferences load.
  applySettings();
  try {
    let changedDuringLoad = false;
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && changes.settings) {
        changedDuringLoad = true;
        applySettings(changes.settings.newValue as Settings | undefined);
      }
    });
    const result = await chrome.storage.local.get('settings');
    if (!changedDuringLoad) applySettings(result.settings as Settings | undefined);
  } catch {
    applySettings();
  }
}
