import type { Settings } from '../shared/types';

export const OPTIONAL_CONTENT_SCRIPTS = [
  {
    id: 'browserutils-force-paste',
    setting: 'forcePasteEnabled' as const,
    feature: 'forcePaste',
    file: 'force-paste.js',
  },
  {
    id: 'browserutils-blob-video-downloader',
    setting: 'blobVideoDownloaderEnabled' as const,
    feature: 'blobVideoDownloader',
    file: 'blob-video-downloader.js',
  },
] as const;

export async function syncOptionalContentScripts(settings: Settings): Promise<void> {
  const ids = OPTIONAL_CONTENT_SCRIPTS.map(script => script.id);
  const registered = await chrome.scripting.getRegisteredContentScripts({ ids });
  const registeredIds = new Set(registered.map(script => script.id));
  const removeIds = OPTIONAL_CONTENT_SCRIPTS
    .filter(script => !settings[script.setting] && registeredIds.has(script.id))
    .map(script => script.id);
  if (removeIds.length > 0) {
    await chrome.scripting.unregisterContentScripts({ ids: removeIds });
  }

  const additions = OPTIONAL_CONTENT_SCRIPTS
    .filter(script => settings[script.setting] && !registeredIds.has(script.id))
    .map(script => ({
      id: script.id,
      matches: ['http://*/*', 'https://*/*'],
      js: [script.file],
      runAt: 'document_start' as const,
      allFrames: true,
      persistAcrossSessions: true,
    }));
  if (additions.length > 0) {
    await chrome.scripting.registerContentScripts(additions);
  }
}

export async function updateOptionalFeatureInOpenTabs(
  feature: typeof OPTIONAL_CONTENT_SCRIPTS[number]['feature'],
  enabled: boolean
): Promise<void> {
  const script = OPTIONAL_CONTENT_SCRIPTS.find(candidate => candidate.feature === feature);
  if (!script) return;

  const tabs = await chrome.tabs.query({ url: ['http://*/*', 'https://*/*'] });
  await Promise.all(tabs.map(async tab => {
    if (tab.id === undefined) return;
    try {
      if (enabled) {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id, allFrames: true },
          files: [script.file],
        });
        return;
      }

      const frames = await chrome.webNavigation.getAllFrames({ tabId: tab.id });
      await Promise.all((frames || []).map(frame =>
        chrome.tabs.sendMessage(tab.id!, {
          type: 'OPTIONAL_FEATURE_STATE',
          feature,
          enabled: false,
        }, { frameId: frame.frameId }).catch(() => undefined)
      ));
    } catch {
      // Restricted pages and tabs navigating between documents cannot be injected.
    }
  }));
}

