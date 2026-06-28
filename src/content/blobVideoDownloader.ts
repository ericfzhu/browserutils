type BlobVideoMessage =
  | {
      source: 'browserutils:blob-video';
      type: 'object-url-created';
      url: string;
      objectKind?: string;
      mimeType?: string;
      size?: number;
      blob?: Blob;
    }
  | {
      source: 'browserutils:blob-video';
      type: 'object-url-revoked';
      url: string;
    };

interface BlobVideoRecord {
  blob: Blob;
  createdAt: number;
  mimeType: string;
  size: number;
}

const MESSAGE_SOURCE = 'browserutils:blob-video';
const MAX_RECORDS = 50;
const MAX_RECORD_AGE_MS = 30 * 60 * 1000;
const overlayButtons = new WeakMap<HTMLVideoElement, HTMLButtonElement>();
const trackedVideos = new Set<HTMLVideoElement>();
const blobRecords = new Map<string, BlobVideoRecord>();
const pendingFetches = new Set<string>();

let blobVideoDownloaderEnabled = false;
let scanTimer: number | null = null;
let updateTimer: number | null = null;

async function loadBlobVideoSetting() {
  try {
    const result = await chrome.storage.local.get('settings');
    blobVideoDownloaderEnabled = !!result.settings?.blobVideoDownloaderEnabled;
    scheduleScan();
  } catch {
    blobVideoDownloaderEnabled = false;
  }
}

loadBlobVideoSetting();

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'local' || !changes.settings) {
    return;
  }

  blobVideoDownloaderEnabled = !!changes.settings.newValue?.blobVideoDownloaderEnabled;
  scheduleScan();
});

function isBlobVideoMessage(value: unknown): value is BlobVideoMessage {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const message = value as { source?: unknown; type?: unknown; url?: unknown };
  return message.source === MESSAGE_SOURCE &&
    typeof message.type === 'string' &&
    typeof message.url === 'string';
}

function rememberBlob(url: string, blob: Blob) {
  blobRecords.set(url, {
    blob,
    createdAt: Date.now(),
    mimeType: blob.type,
    size: blob.size,
  });
  pruneRecords();
  scheduleScan();
}

function pruneRecords() {
  const now = Date.now();

  for (const [url, record] of blobRecords) {
    if (now - record.createdAt > MAX_RECORD_AGE_MS) {
      blobRecords.delete(url);
    }
  }

  while (blobRecords.size > MAX_RECORDS) {
    const oldestUrl = blobRecords.keys().next().value as string | undefined;
    if (!oldestUrl) {
      break;
    }
    blobRecords.delete(oldestUrl);
  }
}

window.addEventListener('message', (event) => {
  if (event.source !== window || !isBlobVideoMessage(event.data)) {
    return;
  }

  if (event.data.type === 'object-url-revoked') {
    blobRecords.delete(event.data.url);
    scheduleScan();
    return;
  }

  if (event.data.blob instanceof Blob && event.data.blob.size > 0) {
    rememberBlob(event.data.url, event.data.blob);
  }
});

function getVideoUrl(video: HTMLVideoElement): string {
  return video.currentSrc || video.src;
}

async function fetchBlobUrl(url: string) {
  if (pendingFetches.has(url) || blobRecords.has(url)) {
    return;
  }

  pendingFetches.add(url);
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    if (blob.size > 0) {
      rememberBlob(url, blob);
    }
  } catch {
    // MediaSource and DRM-backed blob URLs usually land here.
  } finally {
    pendingFetches.delete(url);
  }
}

function recordForVideo(video: HTMLVideoElement): BlobVideoRecord | null {
  const url = getVideoUrl(video);
  if (!url.startsWith('blob:')) {
    return null;
  }

  const record = blobRecords.get(url);
  if (record) {
    return record;
  }

  void fetchBlobUrl(url);
  return null;
}

function getExtension(mimeType: string): string {
  switch (mimeType) {
    case 'video/mp4':
      return 'mp4';
    case 'video/webm':
      return 'webm';
    case 'video/ogg':
      return 'ogv';
    case 'video/quicktime':
      return 'mov';
    case 'video/x-matroska':
      return 'mkv';
    default:
      return 'webm';
  }
}

function makeFilename(record: BlobVideoRecord): string {
  const base = (document.title || window.location.hostname || 'video')
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80) || 'video';

  return `${base}.${getExtension(record.mimeType)}`;
}

function downloadRecord(record: BlobVideoRecord) {
  const url = URL.createObjectURL(record.blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = makeFilename(record);
  link.rel = 'noopener';
  link.style.display = 'none';

  document.documentElement.append(link);
  link.click();
  link.remove();

  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function createButton(video: HTMLVideoElement): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = 'Download';
  button.title = 'Download blob video';
  button.style.cssText = [
    'position: fixed',
    'z-index: 2147483647',
    'width: 84px',
    'height: 30px',
    'border: 1px solid rgba(255,255,255,0.35)',
    'border-radius: 6px',
    'background: rgba(17,24,39,0.88)',
    'color: white',
    'font: 12px/1 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    'box-shadow: 0 6px 18px rgba(0,0,0,0.24)',
    'cursor: pointer',
    'opacity: 0.72',
    'transition: opacity 120ms ease, transform 120ms ease',
  ].join(';');

  button.addEventListener('mouseenter', () => {
    button.style.opacity = '1';
  });
  button.addEventListener('mouseleave', () => {
    button.style.opacity = '0.72';
  });
  button.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();

    const record = recordForVideo(video);
    if (record) {
      downloadRecord(record);
    }
  });

  document.documentElement.append(button);
  return button;
}

function hideButton(button: HTMLButtonElement) {
  button.style.display = 'none';
}

function updateVideoButton(video: HTMLVideoElement) {
  let button = overlayButtons.get(video);
  const record = blobVideoDownloaderEnabled ? recordForVideo(video) : null;
  const rect = video.getBoundingClientRect();
  const isVisible = rect.width >= 120 &&
    rect.height >= 80 &&
    rect.bottom > 0 &&
    rect.right > 0 &&
    rect.top < window.innerHeight &&
    rect.left < window.innerWidth;

  if (!record || !isVisible || !video.isConnected) {
    if (button) {
      hideButton(button);
    }
    return;
  }

  if (!button) {
    button = createButton(video);
    overlayButtons.set(video, button);
    trackedVideos.add(video);
  }

  button.style.display = 'block';
  button.style.left = `${Math.max(8, rect.right - 92)}px`;
  button.style.top = `${Math.max(8, rect.top + 8)}px`;
}

function scanVideos() {
  scanTimer = null;
  pruneRecords();

  const videos = Array.from(document.querySelectorAll('video'));
  const currentVideos = new Set(videos);

  for (const video of trackedVideos) {
    if (!video.isConnected || !currentVideos.has(video)) {
      overlayButtons.get(video)?.remove();
      trackedVideos.delete(video);
    }
  }

  for (const video of videos) {
    updateVideoButton(video);
  }
}

function scheduleScan() {
  if (scanTimer !== null) {
    return;
  }

  scanTimer = window.setTimeout(scanVideos, 100);
}

function updateOverlayPositions() {
  updateTimer = null;
  for (const video of document.querySelectorAll('video')) {
    updateVideoButton(video);
  }
}

function schedulePositionUpdate() {
  if (updateTimer !== null) {
    return;
  }

  updateTimer = window.setTimeout(updateOverlayPositions, 50);
}

const observer = new MutationObserver(scheduleScan);

function startObserver() {
  if (!document.documentElement) {
    document.addEventListener('DOMContentLoaded', startObserver, { once: true });
    return;
  }

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['src'],
  });
  scheduleScan();
}

startObserver();
window.addEventListener('resize', schedulePositionUpdate, { passive: true });
window.addEventListener('scroll', schedulePositionUpdate, { passive: true, capture: true });
