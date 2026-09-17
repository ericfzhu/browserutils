import { getBlockRedirect } from './blockRedirect';
import type { TrackingState } from '../shared/types';

// Content script for accurate time tracking and blocking fallback
// Sends heartbeats and visibility changes to background
// Also handles blocking for sites that bypass declarativeNetRequest (e.g., service workers)

const HEARTBEAT_INTERVAL = 15000; // 15 seconds

let trackingEnabled = false;
let youtubeTrackingEnabled = false;
let disposed = false;
let initialized = false;
let stateReceived = false;
const youtubeTimeouts = new Set<number>();

let heartbeatTimer: number | null = null;
let lastVisibilityState = !document.hidden;

// YouTube tracking state
let lastYouTubeChannel: { name: string; id?: string; url?: string } | null = null;
let youtubeBackgroundTimer: number | null = null;
let isYouTubePlaying = false;
let currentVideoElement: HTMLVideoElement | null = null;

// Check if we're on a YouTube video or shorts page
function isYouTubeVideoPage(): boolean {
  return window.location.hostname === 'www.youtube.com' &&
         (window.location.pathname === '/watch' ||
          window.location.pathname.startsWith('/shorts/'));
}

// Extract YouTube channel info from the page
function getYouTubeChannelInfo(): { name: string; id?: string; url?: string } | null {
  if (!isYouTubeVideoPage()) return null;

  // First, try Media Session API - most reliable when video is playing
  // YouTube sets the channel name as the "artist" in media metadata
  if (navigator.mediaSession?.metadata?.artist) {
    const name = navigator.mediaSession.metadata.artist;
    // Try to get channel ID and URL from DOM as a bonus
    const channelLink = document.querySelector('ytd-channel-name #text a, #owner ytd-channel-name a, #owner #channel-name a') as HTMLAnchorElement | null;
    let id: string | undefined;
    let url: string | undefined;
    if (channelLink?.href) {
      url = channelLink.href;
      const handleMatch = channelLink.href.match(/\/@([^/]+)/);
      const channelMatch = channelLink.href.match(/\/channel\/([^/]+)/);
      id = handleMatch?.[1] || channelMatch?.[1];
    }
    return { name, id, url };
  }

  // Fallback: DOM scraping for when video isn't playing yet
  let channelElement: Element | null = null;

  if (window.location.pathname === '/watch') {
    // Regular video page - channel name in the video description area
    channelElement = document.querySelector(
      'ytd-channel-name #text a, ' +
      '#owner ytd-channel-name a, ' +
      'ytd-video-owner-renderer ytd-channel-name a, ' +
      '#owner #channel-name a'
    );
  } else if (window.location.pathname.startsWith('/shorts/')) {
    // Shorts page - channel name in the shorts player
    channelElement = document.querySelector(
      'ytd-reel-video-renderer[is-active] #channel-name a, ' +
      'ytd-reel-video-renderer[is-active] ytd-channel-name a, ' +
      '#shorts-container ytd-channel-name a, ' +
      'ytd-shorts .ytd-channel-name a'
    );
  }

  if (channelElement) {
    const name = channelElement.textContent?.trim();
    const href = channelElement.getAttribute('href');
    let id: string | undefined;
    let url: string | undefined;
    if (href) {
      // Convert relative href to absolute URL
      url = href.startsWith('http') ? href : `https://www.youtube.com${href}`;
      const handleMatch = href.match(/\/@([^/]+)/);
      const channelMatch = href.match(/\/channel\/([^/]+)/);
      id = handleMatch?.[1] || channelMatch?.[1];
    }
    if (name) {
      return { name, id, url };
    }
  }

  return null;
}

// Handle YouTube video play event - start tracking
function handleYouTubePlay() {
  if (disposed || isYouTubePlaying || !youtubeTrackingEnabled || !isYouTubeVideoPage()) {
    return;
  }

  isYouTubePlaying = true;
  if (document.hidden) startYouTubeBackgroundTracking();
  const channelInfo = getYouTubeChannelInfo();

  if (channelInfo) {
    lastYouTubeChannel = channelInfo;
    sendMessage('YOUTUBE_CHANNEL_UPDATE', {
      channelName: channelInfo.name,
      channelId: channelInfo.id,
      channelUrl: channelInfo.url,
      url: window.location.href,
      timestamp: Date.now(),
    });
  }
}

// Handle YouTube video pause event - end current segment
function handleYouTubePause() {
  if (!isYouTubePlaying) return;

  isYouTubePlaying = false;
  stopYouTubeBackgroundTracking();

  // End the current segment by sending visibility change
  if (lastYouTubeChannel) {
    sendMessage('YOUTUBE_VISIBILITY_CHANGE', {
      visible: false,
      channelName: lastYouTubeChannel.name,
      channelId: lastYouTubeChannel.id,
      channelUrl: lastYouTubeChannel.url,
      url: window.location.href,
      timestamp: Date.now(),
    });
  }
}

// Set up listeners on the YouTube video element
function setupVideoListeners() {
  if (!youtubeTrackingEnabled || disposed || !isYouTubeVideoPage()) return;
  // Find the video element
  const video = document.querySelector('video.html5-main-video, video.video-stream') as HTMLVideoElement | null;

  if (video && video !== currentVideoElement) {
    // Remove listeners from old video if any
    if (currentVideoElement) handleYouTubePause();
    detachVideoListeners();

    // Add listeners to new video
    currentVideoElement = video;
    video.addEventListener('play', handleYouTubePlay);
    video.addEventListener('pause', handleYouTubePause);
    video.addEventListener('ended', handleYouTubePause);

    // Check if already playing
    if (!video.paused && !video.ended) {
      handleYouTubePlay();
    }
  }
}

// Send YouTube channel update to background (used for heartbeats)
// Note: We don't check document.hidden here because YouTube can play in background
function sendYouTubeChannelUpdate() {
  if (!youtubeTrackingEnabled || !isYouTubeVideoPage()) return;

  // Set up video listeners if not already done
  setupVideoListeners();

  // Only send update if video is playing
  if (!isYouTubePlaying) return;

  const channelInfo = getYouTubeChannelInfo();
  if (channelInfo) {
    // Update channel if changed
    if (!lastYouTubeChannel ||
        lastYouTubeChannel.name !== channelInfo.name ||
        lastYouTubeChannel.id !== channelInfo.id) {
      // Channel changed - end previous segment and start new one
      if (lastYouTubeChannel) {
        sendMessage('YOUTUBE_VISIBILITY_CHANGE', {
          visible: false,
          channelName: lastYouTubeChannel.name,
          channelId: lastYouTubeChannel.id,
          channelUrl: lastYouTubeChannel.url,
          url: window.location.href,
          timestamp: Date.now(),
        });
      }
      lastYouTubeChannel = channelInfo;
    }

    sendMessage('YOUTUBE_CHANNEL_UPDATE', {
      channelName: channelInfo.name,
      channelId: channelInfo.id,
      channelUrl: channelInfo.url,
      url: window.location.href,
      timestamp: Date.now(),
    });
  }
}

// Handle YouTube SPA navigation
function handleYouTubeNavigation() {
  if (!youtubeTrackingEnabled || disposed) return;
  cancelYouTubeRetries();
  detachVideoListeners();
  stopYouTubeBackgroundTracking();
  // End any current segment when navigating
  if (isYouTubePlaying && lastYouTubeChannel) {
    sendMessage('YOUTUBE_VISIBILITY_CHANGE', {
      visible: false,
      channelName: lastYouTubeChannel.name,
      channelId: lastYouTubeChannel.id,
      channelUrl: lastYouTubeChannel.url,
      url: window.location.href,
      timestamp: Date.now(),
    });
  }

  // Reset state for new page
  isYouTubePlaying = false;
  lastYouTubeChannel = null;

  if (isYouTubeVideoPage()) {
    // On a video page - set up video listeners with retries (video element loads async)
    scheduleYouTubeRetry(setupVideoListeners, 500);
    scheduleYouTubeRetry(setupVideoListeners, 1500);
    scheduleYouTubeRetry(setupVideoListeners, 3000);
  }
}

// Start YouTube channel detection (polls for channel info since it loads dynamically)
function startYouTubeTracking() {
  // Always set up navigation listeners when on YouTube (even if not on video page yet)
  // User might navigate to a video page later via SPA navigation
  document.addEventListener('yt-navigate-finish', handleYouTubeNavigation);
  document.addEventListener('play', handleVideoDiscovery, true);

  // Also handle popstate for back/forward navigation
  window.addEventListener('popstate', handleYouTubePopstate);

  // If already on a video page, set up video listeners
  if (isYouTubeVideoPage()) {
    // Retry a few times in case the video element isn't loaded yet
    setupVideoListeners();
    scheduleYouTubeRetry(setupVideoListeners, 1000);
    scheduleYouTubeRetry(setupVideoListeners, 3000);
  }
}

// A video can appear after discovery retries finish, even in a hidden tab.
// Capture its first play event without a permanent DOM observer or paused poll.
function handleVideoDiscovery(event: Event) {
  if (event.target !== currentVideoElement &&
      (event.target as Element | null)?.matches?.('video.html5-main-video, video.video-stream')) {
    setupVideoListeners();
  }
}

function scheduleYouTubeRetry(callback: () => void, delay: number) {
  if (disposed || !youtubeTrackingEnabled) return;
  const id = window.setTimeout(() => {
    youtubeTimeouts.delete(id);
    if (youtubeTrackingEnabled && !disposed) callback();
  }, delay);
  youtubeTimeouts.add(id);
}

function cancelYouTubeRetries() {
  for (const id of youtubeTimeouts) window.clearTimeout(id);
  youtubeTimeouts.clear();
}

function handleYouTubePopstate() {
  scheduleYouTubeRetry(handleYouTubeNavigation, 100);
}

function detachVideoListeners() {
  if (!currentVideoElement) return;
  currentVideoElement.removeEventListener('play', handleYouTubePlay);
  currentVideoElement.removeEventListener('pause', handleYouTubePause);
  currentVideoElement.removeEventListener('ended', handleYouTubePause);
  currentVideoElement = null;
}

// Stop YouTube tracking, including pending navigation/video discovery retries.
function stopYouTubeTracking() {
  cancelYouTubeRetries();
  stopYouTubeBackgroundTracking();
  document.removeEventListener('yt-navigate-finish', handleYouTubeNavigation);
  document.removeEventListener('play', handleVideoDiscovery, true);
  window.removeEventListener('popstate', handleYouTubePopstate);
  detachVideoListeners();

  // Send final update if we were tracking a channel
  if (isYouTubePlaying && lastYouTubeChannel) {
    sendMessage('YOUTUBE_VISIBILITY_CHANGE', {
      visible: false,
      channelName: lastYouTubeChannel.name,
      channelId: lastYouTubeChannel.id,
      channelUrl: lastYouTubeChannel.url,
      url: window.location.href,
      timestamp: Date.now(),
    });
  }
  lastYouTubeChannel = null;
  isYouTubePlaying = false;
}

// Start YouTube background tracking (when tab is hidden but video may still be playing)
function startYouTubeBackgroundTracking() {
  if (youtubeBackgroundTimer || !youtubeTrackingEnabled || !isYouTubePlaying) return;

  // Check every 15 seconds if video is still playing via Media Session
  youtubeBackgroundTimer = window.setInterval(() => {
    if (youtubeTrackingEnabled && isYouTubeVideoPage()) {
      sendYouTubeChannelUpdate();
    }
  }, HEARTBEAT_INTERVAL);
}

// Stop YouTube background tracking
function stopYouTubeBackgroundTracking() {
  if (youtubeBackgroundTimer) {
    clearInterval(youtubeBackgroundTimer);
    youtubeBackgroundTimer = null;
  }
}

// Check if current site is blocked and redirect to the canonical block page.
// This is a fallback for sites with service workers that bypass declarativeNetRequest
async function checkIfBlocked(): Promise<boolean> {
  const redirectUrl = await getBlockRedirect(
    window.location.href,
    message => chrome.runtime.sendMessage(message)
  );
  if (!redirectUrl) return false;
  window.location.replace(redirectUrl);
  return true;
}

// Send message to background
function sendMessage(type: string, payload?: Record<string, unknown>) {
  try {
    if (disposed) return;
    chrome.runtime.sendMessage({ type, payload }).catch(cleanup);
  } catch {
    // Extension context invalidated (e.g., extension reloaded)
    cleanup();
  }
}

// Send heartbeat if page is visible
function sendHeartbeat() {
  if (!document.hidden) {
    if (trackingEnabled) sendMessage('HEARTBEAT', {
      url: window.location.href,
      timestamp: Date.now(),
    });

    // Also send YouTube channel update if on video page
    if (youtubeTrackingEnabled && isYouTubeVideoPage()) {
      sendYouTubeChannelUpdate();
    }
  }
}

// Handle visibility changes
function handleVisibilityChange() {
  const isVisible = !document.hidden;

  // Only send if state actually changed
  if (isVisible !== lastVisibilityState) {
    lastVisibilityState = isVisible;
    if (trackingEnabled) sendMessage('VISIBILITY_CHANGE', {
      visible: isVisible,
      url: window.location.href,
      timestamp: Date.now(),
    });

    syncTrackingTimers();
  }
}

function syncTrackingTimers() {
  if (!document.hidden && (trackingEnabled || youtubeTrackingEnabled)) startHeartbeat();
  else stopHeartbeat();
  if (document.hidden && youtubeTrackingEnabled && isYouTubePlaying) startYouTubeBackgroundTracking();
  else stopYouTubeBackgroundTracking();
}

// Start heartbeat timer
function startHeartbeat() {
  if (heartbeatTimer) return;

  // Send initial heartbeat
  sendHeartbeat();

  if (disposed) return;
  // Set up interval
  heartbeatTimer = window.setInterval(sendHeartbeat, HEARTBEAT_INTERVAL);
}

// Stop heartbeat timer
function stopHeartbeat() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

function applyTrackingState(state: TrackingState) {
  if (disposed) return;
  const wasTracking = trackingEnabled;
  const wasYouTubeTracking = youtubeTrackingEnabled;
  trackingEnabled = state.trackingEnabled;
  youtubeTrackingEnabled = state.youtubeTrackingEnabled && window.location.hostname === 'www.youtube.com';

  if (wasYouTubeTracking && !youtubeTrackingEnabled) stopYouTubeTracking();
  if (disposed) return;
  if (!wasYouTubeTracking && youtubeTrackingEnabled) startYouTubeTracking();
  document.removeEventListener('visibilitychange', handleVisibilityChange);
  lastVisibilityState = !document.hidden;
  if (trackingEnabled || youtubeTrackingEnabled) {
    document.addEventListener('visibilitychange', handleVisibilityChange);
  }
  syncTrackingTimers();
  if (!wasTracking && trackingEnabled) {
    sendMessage('CONTENT_SCRIPT_READY', {
      visible: !document.hidden, url: window.location.href, timestamp: Date.now(),
    });
  }
}

function handleTrackingStateMessage(message: { type?: string; payload?: TrackingState }) {
  if (message.type !== 'TRACKING_STATE_CHANGED' || !message.payload) return;
  stateReceived = true;
  if (initialized) applyTrackingState(message.payload);
  else pendingState = message.payload;
}

let pendingState: TrackingState | null = null;

// Context teardown must not send a final message recursively into an invalid runtime.
function cleanup() {
  if (disposed) return;
  disposed = true;
  stopHeartbeat();
  stopYouTubeTracking();
  document.removeEventListener('visibilitychange', handleVisibilityChange);
  chrome.runtime.onMessage.removeListener(handleTrackingStateMessage);
}

async function init() {
  // Blocking remains independent of both tracking preferences.
  if (await checkIfBlocked()) return;
  chrome.runtime.onMessage.addListener(handleTrackingStateMessage);
  try {
    const state: TrackingState = await chrome.runtime.sendMessage({ type: 'GET_TRACKING_STATE' });
    initialized = true;
    // A settings broadcast may arrive while the initial request is in flight.
    applyTrackingState(stateReceived && pendingState ? pendingState : state);
    pendingState = null;
  } catch {
    cleanup();
  }
}

void init();
