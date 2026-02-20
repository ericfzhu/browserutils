import { describe, expect, it } from 'vitest';
import { isTimeWithinScheduleWindow, splitIntervalByLocalDay } from './time';

describe('splitIntervalByLocalDay', () => {
  it('returns a single segment when interval stays within one day', () => {
    const start = new Date('2026-02-19T10:00:00').getTime();
    const end = new Date('2026-02-19T10:30:00').getTime();
    const segments = splitIntervalByLocalDay(start, end);

    expect(segments).toHaveLength(1);
    expect(segments[0].date).toBe('2026-02-19');
    expect(segments[0].endSec - segments[0].startSec).toBe(1800);
  });

  it('splits intervals that cross midnight into separate day segments', () => {
    const start = new Date('2026-02-19T23:50:00').getTime();
    const end = new Date('2026-02-20T00:10:00').getTime();
    const segments = splitIntervalByLocalDay(start, end);

    expect(segments).toHaveLength(2);
    expect(segments[0].date).toBe('2026-02-19');
    expect(segments[1].date).toBe('2026-02-20');
    expect(segments[0].endSec - segments[0].startSec).toBe(600);
    expect(segments[1].endSec - segments[1].startSec).toBe(600);
  });
});

describe('isTimeWithinScheduleWindow', () => {
  it('matches same-day schedules', () => {
    const schedule = { days: [4], startTime: '09:00', endTime: '17:00' }; // Thursday
    const inWindow = new Date('2026-02-19T10:30:00'); // Thu
    const outWindow = new Date('2026-02-19T18:00:00'); // Thu

    expect(isTimeWithinScheduleWindow(schedule, inWindow)).toBe(true);
    expect(isTimeWithinScheduleWindow(schedule, outWindow)).toBe(false);
  });

  it('matches overnight schedules on the start day late night', () => {
    const schedule = { days: [4], startTime: '23:00', endTime: '06:00' }; // Thu -> Fri
    const thursdayLate = new Date('2026-02-19T23:30:00'); // Thu

    expect(isTimeWithinScheduleWindow(schedule, thursdayLate)).toBe(true);
  });

  it('matches overnight schedules on the next day early morning', () => {
    const schedule = { days: [4], startTime: '23:00', endTime: '06:00' }; // Thu -> Fri
    const fridayEarly = new Date('2026-02-20T05:30:00'); // Fri
    const fridayAfter = new Date('2026-02-20T07:00:00'); // Fri

    expect(isTimeWithinScheduleWindow(schedule, fridayEarly)).toBe(true);
    expect(isTimeWithinScheduleWindow(schedule, fridayAfter)).toBe(false);
  });
});
