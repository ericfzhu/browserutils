// Content script for accurate time tracking and blocking fallback
// Sends heartbeats and visibility changes to background
// Also handles blocking for sites that bypass declarativeNetRequest (e.g., service workers)

const HEARTBEAT_INTERVAL = 15000; // 15 seconds

let heartbeatTimer: number | null = null;
let lastVisibilityState = !document.hidden;

// YouTube tracking state
let lastYouTubeChannel: { name: string; id?: string } | null = null;
let youtubeCheckTimer: number | null = null;
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
function getYouTubeChannelInfo(): { name: string; id?: string } | null {
  if (!isYouTubeVideoPage()) return null;

  // First, try Media Session API - most reliable when video is playing
  // YouTube sets the channel name as the "artist" in media metadata
  console.log('[YouTube Content] Media Session metadata:', navigator.mediaSession?.metadata);
  if (navigator.mediaSession?.metadata?.artist) {
    const name = navigator.mediaSession.metadata.artist;
    console.log('[YouTube Content] Got channel from Media Session:', name);
    // Try to get channel ID from DOM as a bonus
    const channelLink = document.querySelector('ytd-channel-name#channel-name #text a, #owner #channel-name a') as HTMLAnchorElement | null;
    let id: string | undefined;
    if (channelLink?.href) {
      const handleMatch = channelLink.href.match(/\/@([^/]+)/);
      const channelMatch = channelLink.href.match(/\/channel\/([^/]+)/);
      id = handleMatch?.[1] || channelMatch?.[1];
    }
    return { name, id };
  }

  // Fallback: DOM scraping for when video isn't playing yet
  console.log('[YouTube Content] Media Session not available, trying DOM scraping');
  let channelElement: Element | null = null;

  if (window.location.pathname === '/watch') {
    // Regular video page - channel name in the video description area
    channelElement = document.querySelector(
      'ytd-channel-name#channel-name #text a, ' +
      'ytd-video-owner-renderer #channel-name #text a, ' +
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

  console.log('[YouTube Content] DOM channel element found:', !!channelElement);
  if (channelElement) {
    const name = channelElement.textContent?.trim();
    const href = channelElement.getAttribute('href');
    console.log('[YouTube Content] DOM channel name:', name, 'href:', href);
    let id: string | undefined;
    if (href) {
      const handleMatch = href.match(/\/@([^/]+)/);
      const channelMatch = href.match(/\/channel\/([^/]+)/);
      id = handleMatch?.[1] || channelMatch?.[1];
    }
    if (name) {
      return { name, id };
    }
  }

  console.log('[YouTube Content] Could not find channel info');
  return null;
}

// Handle YouTube video play event - start tracking
function handleYouTubePlay() {
  console.log('[YouTube Content] Play event fired');
  if (!isYouTubeVideoPage()) {
    console.log('[YouTube Content] Not on video page, ignoring');
    return;
  }

  isYouTubePlaying = true;
  const channelInfo = getYouTubeChannelInfo();
  console.log('[YouTube Content] Channel info:', channelInfo);

  if (channelInfo) {
    lastYouTubeChannel = channelInfo;
    console.log('[YouTube Content] Sending YOUTUBE_CHANNEL_UPDATE for:', channelInfo.name);
    sendMessage('YOUTUBE_CHANNEL_UPDATE', {
      channelName: channelInfo.name,
      channelId: channelInfo.id,
      url: window.location.href,
      timestamp: Date.now(),
    });
  } else {
    console.log('[YouTube Content] Could not get channel info');
  }
}

// Handle YouTube video pause event - end current segment
function handleYouTubePause() {
  console.log('[YouTube Content] Pause/ended event fired, isYouTubePlaying:', isYouTubePlaying);
  if (!isYouTubePlaying) return;

  isYouTubePlaying = false;

  // End the current segment by sending visibility change
  if (lastYouTubeChannel) {
    console.log('[YouTube Content] Sending YOUTUBE_VISIBILITY_CHANGE (pause) for:', lastYouTubeChannel.name);
    sendMessage('YOUTUBE_VISIBILITY_CHANGE', {
      visible: false,
      channelName: lastYouTubeChannel.name,
      channelId: lastYouTubeChannel.id,
      url: window.location.href,
      timestamp: Date.now(),
    });
  }
}

// Set up listeners on the YouTube video element
function setupVideoListeners() {
  // Find the video element
  const video = document.querySelector('video.html5-main-video, video.video-stream') as HTMLVideoElement | null;
  console.log('[YouTube Content] setupVideoListeners, found video:', !!video, 'current:', !!currentVideoElement);

  if (video && video !== currentVideoElement) {
    console.log('[YouTube Content] Setting up new video element listeners');
    // Remove listeners from old video if any
    if (currentVideoElement) {
      currentVideoElement.removeEventListener('play', handleYouTubePlay);
      currentVideoElement.removeEventListener('pause', handleYouTubePause);
      currentVideoElement.removeEventListener('ended', handleYouTubePause);
    }

    // Add listeners to new video
    currentVideoElement = video;
    video.addEventListener('play', handleYouTubePlay);
    video.addEventListener('pause', handleYouTubePause);
    video.addEventListener('ended', handleYouTubePause);

    // Check if already playing
    console.log('[YouTube Content] Video state - paused:', video.paused, 'ended:', video.ended);
    if (!video.paused && !video.ended) {
      console.log('[YouTube Content] Video already playing, triggering play handler');
      handleYouTubePlay();
    }
  }
}

// Send YouTube channel update to background (used for heartbeats)
// Note: We don't check document.hidden here because YouTube can play in background
function sendYouTubeChannelUpdate() {
  if (!isYouTubeVideoPage()) return;

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
          url: window.location.href,
          timestamp: Date.now(),
        });
      }
      lastYouTubeChannel = channelInfo;
    }

    sendMessage('YOUTUBE_CHANNEL_UPDATE', {
      channelName: channelInfo.name,
      channelId: channelInfo.id,
      url: window.location.href,
      timestamp: Date.now(),
    });
  }
}

// Handle YouTube SPA navigation
function handleYouTubeNavigation() {
  // End any current segment when navigating
  if (isYouTubePlaying && lastYouTubeChannel) {
    sendMessage('YOUTUBE_VISIBILITY_CHANGE', {
      visible: false,
      channelName: lastYouTubeChannel.name,
      channelId: lastYouTubeChannel.id,
      url: window.location.href,
      timestamp: Date.now(),
    });
  }

  // Reset state for new page
  isYouTubePlaying = false;
  currentVideoElement = null;
  lastYouTubeChannel = null;

  if (isYouTubeVideoPage()) {
    // On a video page - set up video listeners with retries (video element loads async)
    setTimeout(setupVideoListeners, 500);
    setTimeout(setupVideoListeners, 1500);
    setTimeout(setupVideoListeners, 3000);
  }
}

// Start YouTube channel detection (polls for channel info since it loads dynamically)
function startYouTubeTracking() {
  // Always set up navigation listeners when on YouTube (even if not on video page yet)
  // User might navigate to a video page later via SPA navigation
  document.addEventListener('yt-navigate-finish', handleYouTubeNavigation);

  // Also handle popstate for back/forward navigation
  window.addEventListener('popstate', () => {
    setTimeout(handleYouTubeNavigation, 100);
  });

  // If already on a video page, set up video listeners
  if (isYouTubeVideoPage()) {
    // Retry a few times in case the video element isn't loaded yet
    setupVideoListeners();
    setTimeout(setupVideoListeners, 1000);
    setTimeout(setupVideoListeners, 3000);
  }
}

// Stop YouTube tracking
function stopYouTubeTracking() {
  if (youtubeCheckTimer) {
    clearInterval(youtubeCheckTimer);
    youtubeCheckTimer = null;
  }
  stopYouTubeBackgroundTracking();
  document.removeEventListener('yt-navigate-finish', handleYouTubeNavigation);

  // Remove video element listeners
  if (currentVideoElement) {
    currentVideoElement.removeEventListener('play', handleYouTubePlay);
    currentVideoElement.removeEventListener('pause', handleYouTubePause);
    currentVideoElement.removeEventListener('ended', handleYouTubePause);
    currentVideoElement = null;
  }

  // Send final update if we were tracking a channel
  if (isYouTubePlaying && lastYouTubeChannel) {
    sendMessage('YOUTUBE_VISIBILITY_CHANGE', {
      visible: false,
      channelName: lastYouTubeChannel.name,
      channelId: lastYouTubeChannel.id,
      url: window.location.href,
      timestamp: Date.now(),
    });
  }
  lastYouTubeChannel = null;
  isYouTubePlaying = false;
}

// Start YouTube background tracking (when tab is hidden but video may still be playing)
function startYouTubeBackgroundTracking() {
  if (youtubeBackgroundTimer) return;

  // Check every 15 seconds if video is still playing via Media Session
  youtubeBackgroundTimer = window.setInterval(() => {
    if (isYouTubeVideoPage()) {
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

// Check if current site is blocked and show block page if necessary
// This is a fallback for sites with service workers that bypass declarativeNetRequest
async function checkIfBlocked(): Promise<boolean> {
  try {
    const response = await chrome.runtime.sendMessage({
      type: 'CHECK_SITE',
      payload: { url: window.location.href },
    });

    if (response?.blocked && response?.site) {
      // Increment blocked attempt counter
      chrome.runtime.sendMessage({
        type: 'INCREMENT_BLOCKED_ATTEMPT',
        payload: { domain: response.site.pattern },
      });
      showBlockedPage(response.site.pattern, response.site.id);
      return true;
    }
  } catch {
    // Extension context invalidated
  }
  return false;
}

// Show a blocked page overlay instead of redirecting
function showBlockedPage(pattern: string, _siteId: string) {
  // Stop the page from loading further
  window.stop();

  // Wait for document to be ready enough to modify
  const showBlock = () => {
    document.documentElement.innerHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Site Blocked - BrowserUtils</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            background: linear-gradient(135deg, #fef2f2 0%, #fff7ed 100%);
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            padding: 20px;
          }
          .container {
            background: white;
            border-radius: 16px;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
            max-width: 400px;
            width: 100%;
            padding: 32px;
            text-align: center;
          }
          .icon {
            width: 64px;
            height: 64px;
            background: #fee2e2;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 16px;
          }
          .icon svg {
            width: 32px;
            height: 32px;
            color: #dc2626;
          }
          h1 {
            font-size: 24px;
            font-weight: 700;
            color: #111827;
            margin-bottom: 8px;
          }
          .pattern {
            color: #6b7280;
            margin-bottom: 24px;
          }
          .pattern strong {
            color: #374151;
          }
          .message {
            color: #6b7280;
            margin-bottom: 24px;
          }
          .back-btn {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            color: #6b7280;
            text-decoration: none;
            padding: 8px 16px;
            border-radius: 8px;
            transition: background 0.2s;
            cursor: pointer;
            border: none;
            background: none;
            font-size: 14px;
          }
          .back-btn:hover {
            background: #f3f4f6;
            color: #111827;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="icon">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <h1>Site Blocked</h1>
          <p class="pattern"><strong>${pattern}</strong> is blocked</p>
          <p class="message">This site has been blocked by BrowserUtils.</p>
          <button class="back-btn" onclick="history.back()">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Go Back
          </button>
        </div>
      </body>
      </html>
    `;
  };

  if (document.documentElement) {
    showBlock();
  } else {
    document.addEventListener('DOMContentLoaded', showBlock);
  }
}

// Send message to background
function sendMessage(type: string, payload?: Record<string, unknown>) {
  try {
    chrome.runtime.sendMessage({ type, payload });
  } catch {
    // Extension context invalidated (e.g., extension reloaded)
    cleanup();
  }
}

// Send heartbeat if page is visible
function sendHeartbeat() {
  if (!document.hidden) {
    sendMessage('HEARTBEAT', {
      url: window.location.href,
      timestamp: Date.now(),
    });

    // Also send YouTube channel update if on video page
    if (isYouTubeVideoPage()) {
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
    sendMessage('VISIBILITY_CHANGE', {
      visible: isVisible,
      url: window.location.href,
      timestamp: Date.now(),
    });

    // Note: We DON'T end YouTube sessions on visibility change
    // because YouTube can play audio in the background and we want to track that
    // YouTube sessions only end when navigating away or closing the tab

    // Start/stop heartbeat based on visibility
    if (isVisible) {
      startHeartbeat();
      // Stop background tracking since regular heartbeat takes over
      stopYouTubeBackgroundTracking();
    } else {
      stopHeartbeat();
      // But keep YouTube tracking alive via separate mechanism
      if (isYouTubeVideoPage()) {
        startYouTubeBackgroundTracking();
      }
    }
  }
}

// Start heartbeat timer
function startHeartbeat() {
  if (heartbeatTimer) return;

  // Send initial heartbeat
  sendHeartbeat();

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

// Cleanup function
function cleanup() {
  stopHeartbeat();
  stopYouTubeTracking();
  document.removeEventListener('visibilitychange', handleVisibilityChange);
}

// Initialize
async function init() {
  // First check if this site should be blocked
  // This is a fallback for sites with service workers that bypass declarativeNetRequest
  const blocked = await checkIfBlocked();
  if (blocked) {
    return; // Don't initialize tracking if redirecting to blocked page
  }

  // Listen for visibility changes
  document.addEventListener('visibilitychange', handleVisibilityChange);

  // Start heartbeat if page is currently visible
  if (!document.hidden) {
    startHeartbeat();
  }

  // Start YouTube tracking if on YouTube
  if (window.location.hostname === 'www.youtube.com') {
    startYouTubeTracking();
  }

  // Send initial state
  sendMessage('CONTENT_SCRIPT_READY', {
    visible: !document.hidden,
    url: window.location.href,
    timestamp: Date.now(),
  });
}

// Run
init();
