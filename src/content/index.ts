// Content script for accurate time tracking
// Sends heartbeats and visibility changes to background

const HEARTBEAT_INTERVAL = 15000; // 15 seconds

let heartbeatTimer: number | null = null;
let lastVisibilityState = !document.hidden;

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
function init() {
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
