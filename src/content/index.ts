// Content script for accurate time tracking and blocking fallback
// Sends heartbeats and visibility changes to background
// Also handles blocking for sites that bypass declarativeNetRequest (e.g., service workers)

const HEARTBEAT_INTERVAL = 15000; // 15 seconds

let heartbeatTimer: number | null = null;
let lastVisibilityState = !document.hidden;

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

    // Start/stop heartbeat based on visibility
    if (isVisible) {
      startHeartbeat();
    } else {
      stopHeartbeat();
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

  // Send initial state
  sendMessage('CONTENT_SCRIPT_READY', {
    visible: !document.hidden,
    url: window.location.href,
    timestamp: Date.now(),
  });
}

// Run
init();
