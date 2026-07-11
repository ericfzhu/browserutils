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
  kind: 'blob';
  blob: Blob;
  createdAt: number;
  mimeType: string;
  size: number;
}

interface RedditVideoData {
  fallback_url?: string;
  dash_url?: string;
  hls_url?: string;
}

interface RedditVideoRecord {
  kind: 'reddit';
  postId: string;
  title: string;
  videoUrl: string;
  audioUrl?: string;
  createdAt: number;
}

interface DashMediaSource {
  url: string;
  bandwidth: number;
  width: number;
  height: number;
}

type DownloadRecord = BlobVideoRecord | RedditVideoRecord;

const MESSAGE_SOURCE = 'browserutils:blob-video';
const MAX_RECORDS = 50;
const MAX_RECORD_AGE_MS = 30 * 60 * 1000;
const overlayButtons = new WeakMap<HTMLVideoElement, HTMLButtonElement>();
const trackedVideos = new Set<HTMLVideoElement>();
const blobRecords = new Map<string, BlobVideoRecord>();
const pendingFetches = new Set<string>();
const redditRecords = new Map<string, RedditVideoRecord>();
const redditFetches = new Set<string>();

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
    kind: 'blob',
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

  for (const [postId, record] of redditRecords) {
    if (now - record.createdAt > MAX_RECORD_AGE_MS) {
      redditRecords.delete(postId);
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

function isRedditHost(): boolean {
  return /(^|\.)reddit\.com$/i.test(window.location.hostname);
}

function postIdFromUrl(url: string): string | null {
  const match = url.match(/\/comments\/([a-z0-9]+)/i);
  return match?.[1] ?? null;
}

function findRedditPostId(video: HTMLVideoElement): string | null {
  if (!isRedditHost()) {
    return null;
  }

  const pagePostId = postIdFromUrl(window.location.href);
  if (pagePostId) {
    return pagePostId;
  }

  let element: Element | null = video;
  for (let depth = 0; element && depth < 12; depth += 1) {
    const attributeId =
      element.getAttribute('post-id') ||
      element.getAttribute('data-post-id') ||
      element.getAttribute('data-fullname') ||
      element.getAttribute('thingid');

    if (attributeId) {
      const normalized = attributeId.replace(/^t3_/i, '');
      if (/^[a-z0-9]+$/i.test(normalized)) {
        return normalized;
      }
    }

    const permalink = element.getAttribute('permalink');
    if (permalink) {
      const postId = postIdFromUrl(permalink);
      if (postId) {
        return postId;
      }
    }

    const commentsLink = element.querySelector?.('a[href*="/comments/"]');
    if (commentsLink instanceof HTMLAnchorElement) {
      const postId = postIdFromUrl(commentsLink.href);
      if (postId) {
        return postId;
      }
    }

    element = element.parentElement;
  }

  return null;
}

function titleFromRedditData(data: unknown): string {
  if (data && typeof data === 'object' && 'title' in data) {
    const title = (data as { title?: unknown }).title;
    if (typeof title === 'string' && title.trim()) {
      return title;
    }
  }

  return document.title || 'reddit-video';
}

function findRedditVideo(value: unknown, seen = new Set<unknown>()): { video: RedditVideoData; title: string } | null {
  if (!value || typeof value !== 'object' || seen.has(value)) {
    return null;
  }
  seen.add(value);

  const object = value as Record<string, unknown>;
  const redditVideo = object.reddit_video;
  if (redditVideo && typeof redditVideo === 'object') {
    const video = redditVideo as RedditVideoData;
    if (video.fallback_url || video.dash_url || video.hls_url) {
      return {
        video,
        title: titleFromRedditData(object),
      };
    }
  }

  for (const child of Object.values(object)) {
    if (typeof child !== 'object') {
      continue;
    }

    if (Array.isArray(child)) {
      for (const item of child) {
        const found = findRedditVideo(item, seen);
        if (found) {
          return found;
        }
      }
      continue;
    }

    const found = findRedditVideo(child, seen);
    if (found) {
      return found;
    }
  }

  return null;
}

function absoluteUrl(path: string, base: string): string {
  return new URL(path, base).href;
}

function sourceFromRepresentation(representation: Element, manifestUrl: string): DashMediaSource | null {
  const baseUrl = representation.querySelector('BaseURL')?.textContent?.trim();
  if (!baseUrl) {
    return null;
  }

  return {
    url: absoluteUrl(baseUrl, manifestUrl),
    bandwidth: Number(representation.getAttribute('bandwidth') || 0),
    width: Number(representation.getAttribute('width') || 0),
    height: Number(representation.getAttribute('height') || 0),
  };
}

function bestSource(sources: DashMediaSource[], mode: 'audio' | 'video'): DashMediaSource | null {
  if (sources.length === 0) {
    return null;
  }

  return [...sources].sort((a: DashMediaSource, b: DashMediaSource) => {
    if (mode === 'video') {
      return (b.height - a.height) || (b.width - a.width) || (b.bandwidth - a.bandwidth);
    }
    return b.bandwidth - a.bandwidth;
  })[0];
}

async function parseDashManifest(dashUrl: string): Promise<{ videoUrl?: string; audioUrl?: string }> {
  const response = await fetch(dashUrl);
  const text = await response.text();
  const document = new DOMParser().parseFromString(text, 'application/xml');
  const videoSources: DashMediaSource[] = [];
  const audioSources: DashMediaSource[] = [];

  for (const adaptationSet of Array.from(document.querySelectorAll('AdaptationSet'))) {
    const type = [
      adaptationSet.getAttribute('contentType'),
      adaptationSet.getAttribute('mimeType'),
    ].join(' ');

    for (const representation of Array.from(adaptationSet.querySelectorAll('Representation'))) {
      const source = sourceFromRepresentation(representation, dashUrl);
      if (!source) {
        continue;
      }

      if (/audio/i.test(type) || /audio/i.test(source.url)) {
        audioSources.push(source);
      } else if (/video/i.test(type) || /DASH_\d+/i.test(source.url)) {
        videoSources.push(source);
      }
    }
  }

  return {
    videoUrl: bestSource(videoSources, 'video')?.url,
    audioUrl: bestSource(audioSources, 'audio')?.url,
  };
}

function derivedRedditAudioCandidates(dashUrl: string): string[] {
  const base = dashUrl.slice(0, dashUrl.lastIndexOf('/') + 1);
  return [
    absoluteUrl('DASH_AUDIO_128.mp4', base),
    absoluteUrl('DASH_AUDIO_64.mp4', base),
    absoluteUrl('audio', base),
  ];
}

async function firstReachableUrl(urls: string[]): Promise<string | undefined> {
  for (const url of urls) {
    try {
      const response = await fetch(url, { method: 'HEAD' });
      if (response.ok) {
        return url;
      }
    } catch {
      // Try the next derived candidate.
    }
  }

  return undefined;
}

async function fetchRedditRecord(postId: string) {
  if (redditFetches.has(postId) || redditRecords.has(postId)) {
    return;
  }

  redditFetches.add(postId);
  try {
    const response = await fetch(`https://www.reddit.com/comments/${postId}.json?raw_json=1`);
    const json = await response.json();
    const found = findRedditVideo(json);
    if (!found) {
      return;
    }

    const dashUrls: { videoUrl?: string; audioUrl?: string } = found.video.dash_url
      ? await parseDashManifest(found.video.dash_url).catch(() => ({}))
      : {};
    const videoUrl = dashUrls.videoUrl || found.video.fallback_url;
    const audioUrl = dashUrls.audioUrl ||
      (found.video.dash_url ? await firstReachableUrl(derivedRedditAudioCandidates(found.video.dash_url)) : undefined);

    if (!videoUrl) {
      return;
    }

    redditRecords.set(postId, {
      kind: 'reddit',
      postId,
      title: found.title,
      videoUrl,
      audioUrl,
      createdAt: Date.now(),
    });
    scheduleScan();
  } catch {
    // Reddit pages without native video or blocked metadata land here.
  } finally {
    redditFetches.delete(postId);
  }
}

function redditRecordForVideo(video: HTMLVideoElement): RedditVideoRecord | null {
  const postId = findRedditPostId(video);
  if (!postId) {
    return null;
  }

  const record = redditRecords.get(postId);
  if (record) {
    return record;
  }

  void fetchRedditRecord(postId);
  return null;
}

function recordForVideo(video: HTMLVideoElement): DownloadRecord | null {
  const url = getVideoUrl(video);

  if (url.startsWith('blob:')) {
    const record = blobRecords.get(url);
    if (record) {
      return record;
    }

    void fetchBlobUrl(url);
  }

  return redditRecordForVideo(video);
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

function sanitizeFilename(value: string): string {
  return value
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80) || 'video';
}

function makeBlobFilename(record: BlobVideoRecord): string {
  const base = sanitizeFilename(document.title || window.location.hostname || 'video');
  return `${base}.${getExtension(record.mimeType)}`;
}

function makeRedditFilename(record: RedditVideoRecord, part: 'audio' | 'video'): string {
  const base = sanitizeFilename(record.title || `reddit-${record.postId}`);
  return part === 'video' ? `${base}.mp4` : `${base}.audio.mp4`;
}

async function downloadUrl(url: string, filename: string) {
  try {
    await chrome.runtime.sendMessage({
      type: 'DOWNLOAD_URL',
      payload: { url, filename },
    });
  } catch {
    window.open(url, '_blank', 'noopener');
  }
}

function downloadBlobRecord(record: BlobVideoRecord) {
  const url = URL.createObjectURL(record.blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = makeBlobFilename(record);
  link.rel = 'noopener';
  link.style.display = 'none';

  document.documentElement.append(link);
  link.click();
  link.remove();

  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function downloadRedditRecord(record: RedditVideoRecord) {
  void downloadUrl(record.videoUrl, makeRedditFilename(record, 'video'));
  if (record.audioUrl && record.audioUrl !== record.videoUrl) {
    window.setTimeout(() => {
      void downloadUrl(record.audioUrl!, makeRedditFilename(record, 'audio'));
    }, 300);
  }
}

function downloadRecord(record: DownloadRecord) {
  if (record.kind === 'blob') {
    downloadBlobRecord(record);
    return;
  }

  downloadRedditRecord(record);
}

function createButton(video: HTMLVideoElement): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = 'Download';
  button.title = 'Download video';
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
