import { getSettings, getActiveYouTubeSessions, addActiveYouTubeSession, removeActiveYouTubeSession, recordYouTubeSession } from '../shared/storage';
import { isSessionFresh } from './sessionTiming';

// Handle YouTube channel update from content script
export async function handleYouTubeChannelUpdate(
  payload: { channelName: string; channelId?: string; channelUrl?: string; url: string; timestamp: number },
  sender?: chrome.runtime.MessageSender
): Promise<void> {

  if (!sender?.tab?.id) {
    return;
  }

  const settings = await getSettings();
  if (!settings.youtubeTrackingEnabled) {
    return;
  }

  const tabId = sender.tab.id;
  const windowId = sender.tab.windowId ?? 0;
  const now = Date.now();

  // Get existing YouTube session for this tab
  const activeYoutubeSessions = await getActiveYouTubeSessions();
  const existingSession = activeYoutubeSessions[tabId];

  if (existingSession) {
    // Compare by name primarily, only use channelId if both have it
    const nameChanged = existingSession.channelName !== payload.channelName;
    const idChanged = existingSession.channelId && payload.channelId &&
                      existingSession.channelId !== payload.channelId;
    const sessionStale = !isSessionFresh(existingSession, now);
    const channelChanged = nameChanged || idChanged || sessionStale;
    if (channelChanged) {
      await endYouTubeSession(tabId);
      await addActiveYouTubeSession(tabId, {
        channelName: payload.channelName,
        channelId: payload.channelId,
        channelUrl: payload.channelUrl,
        startTime: now,
        lastActiveTime: now,
        tabId,
        windowId,
      });
    } else {
      // Same channel - update lastActiveTime and channelId/channelUrl if needed
      await addActiveYouTubeSession(tabId, {
        ...existingSession,
        lastActiveTime: now,
        channelId: payload.channelId || existingSession.channelId,
        channelUrl: payload.channelUrl || existingSession.channelUrl,
      });
    }
    // Same channel - just keep the session alive, don't record yet
    // Session will be recorded when user leaves or channel changes
    return;
  }

  // No existing session - start new one
  await addActiveYouTubeSession(tabId, {
    channelName: payload.channelName,
    channelId: payload.channelId,
    channelUrl: payload.channelUrl,
    startTime: now,
    lastActiveTime: now,
    tabId,
    windowId,
  });
}

// Handle YouTube visibility change
export async function handleYouTubeVisibilityChange(
  payload: { visible: boolean; channelName?: string; channelId?: string; channelUrl?: string; url: string; timestamp: number },
  sender?: chrome.runtime.MessageSender
): Promise<void> {

  if (!sender?.tab?.id) {
    return;
  }

  const settings = await getSettings();
  if (!settings.youtubeTrackingEnabled) {
    return;
  }

  const tabId = sender.tab.id;

  if (!payload.visible) {
    // Page became hidden - end YouTube session
    await endYouTubeSession(tabId);
  }
}

// End a YouTube session and record it
export async function endYouTubeSession(tabId: number): Promise<void> {
  const session = await removeActiveYouTubeSession(tabId);

  if (session && session.startTime) {
    const now = Date.now();
    // Cap end time at lastActiveTime + 30 seconds to prevent over-recording
    const maxEndTime = session.lastActiveTime ? session.lastActiveTime + 30000 : now;
    const endTime = Math.min(now, maxEndTime);
    const duration = Math.round((endTime - session.startTime) / 1000);
    if (duration > 0) {
      await recordYouTubeSession({
        channelName: session.channelName,
        channelId: session.channelId,
        channelUrl: session.channelUrl,
        startTime: session.startTime,
        endTime,
        windowId: session.windowId,
      });
    } else {
    }
  }
}

// End all active YouTube sessions
export async function endAllYouTubeSessions(): Promise<void> {
  const activeYoutubeSessions = await getActiveYouTubeSessions();

  // Use removeActiveYouTubeSession for each to prevent race conditions
  // (if endYouTubeSession is called concurrently, we won't double-record)
  for (const [tabIdStr] of Object.entries(activeYoutubeSessions)) {
    await endYouTubeSession(parseInt(tabIdStr));
  }
}

