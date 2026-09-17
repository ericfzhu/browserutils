import type { ActiveSession } from '../shared/types';

// Session freshness: content heartbeats are every 15s, so allow a small buffer
// before considering a session stale.
const HEARTBEAT_STALE_MS = 45000;

export function isSessionFresh(session: Pick<ActiveSession, 'lastActiveTime'>, now: number = Date.now()): boolean {
  return now - session.lastActiveTime <= HEARTBEAT_STALE_MS;
}

