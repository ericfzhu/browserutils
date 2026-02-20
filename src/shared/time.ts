import { BlockedSite } from './types';

export interface DailyIntervalSegment {
  date: string;
  startSec: number;
  endSec: number;
}

export function getLocalDateString(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Split a time interval into per-day segments using local time boundaries.
export function splitIntervalByLocalDay(startTime: number, endTime: number): DailyIntervalSegment[] {
  if (endTime <= startTime) return [];

  const segments: DailyIntervalSegment[] = [];
  let cursor = startTime;

  while (cursor < endTime) {
    const current = new Date(cursor);
    const dayStart = new Date(current.getFullYear(), current.getMonth(), current.getDate()).getTime();
    const nextDayStart = dayStart + 24 * 60 * 60 * 1000;
    const segmentEnd = Math.min(endTime, nextDayStart);

    const startSec = Math.floor(cursor / 1000);
    const endSec = Math.floor(segmentEnd / 1000);
    if (endSec > startSec) {
      segments.push({
        date: getLocalDateString(current),
        startSec,
        endSec,
      });
    }

    cursor = segmentEnd;
  }

  return segments;
}

function parseTimeToMinutes(time: string): number | null {
  const [h, m] = time.split(':').map(Number);
  if (!Number.isInteger(h) || !Number.isInteger(m) || h < 0 || h > 23 || m < 0 || m > 59) {
    return null;
  }
  return h * 60 + m;
}

// Determines whether "now" falls within a schedule window.
// Overnight windows are supported (e.g. 23:00-06:00).
export function isTimeWithinScheduleWindow(
  schedule: BlockedSite['schedule'],
  nowDate: Date = new Date()
): boolean {
  if (!schedule || schedule.days.length === 0) return false;

  const startMinutes = parseTimeToMinutes(schedule.startTime);
  const endMinutes = parseTimeToMinutes(schedule.endTime);
  if (startMinutes === null || endMinutes === null) return false;

  const nowMinutes = nowDate.getHours() * 60 + nowDate.getMinutes();
  const day = nowDate.getDay();
  const previousDay = (day + 6) % 7;

  if (startMinutes === endMinutes) {
    return schedule.days.includes(day);
  }

  if (startMinutes < endMinutes) {
    return schedule.days.includes(day) && nowMinutes >= startMinutes && nowMinutes <= endMinutes;
  }

  return (
    (schedule.days.includes(day) && nowMinutes >= startMinutes) ||
    (schedule.days.includes(previousDay) && nowMinutes <= endMinutes)
  );
}
