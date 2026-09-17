import { describe, expect, it } from 'vitest';
import { BlockedSite } from '../shared/types';
import { applyBlockedSiteRuleSettings } from './blockedSiteRules';

const site: BlockedSite = {
  id: 'site-1',
  pattern: 'example.com',
  enabled: false,
  unlockType: 'password',
  passwordHash: 'old-hash',
  unlockedUntil: 100,
  timerDuration: 15,
  timerBlockedUntil: 200,
  schedule: {
    days: [1, 2],
    startTime: '09:00',
    endTime: '17:00',
  },
  createdAt: 1,
  folderId: 'folder-1',
  order: 3,
};

describe('applyBlockedSiteRuleSettings', () => {
  it('preserves site identity, placement, and enabled state', () => {
    const result = applyBlockedSiteRuleSettings(site, { unlockType: 'none' });

    expect(result).toMatchObject({
      id: 'site-1',
      pattern: 'example.com',
      enabled: false,
      folderId: 'folder-1',
      order: 3,
      createdAt: 1,
    });
  });

  it('removes stale settings when applying always blocked', () => {
    expect(applyBlockedSiteRuleSettings(site, { unlockType: 'none' })).toEqual({
      id: 'site-1',
      pattern: 'example.com',
      enabled: false,
      unlockType: 'none',
      createdAt: 1,
      folderId: 'folder-1',
      order: 3,
    });
  });

  it('applies a shared password and clears other unlock state', () => {
    const result = applyBlockedSiteRuleSettings(site, {
      unlockType: 'password',
      passwordHash: 'new-hash',
    });

    expect(result.passwordHash).toBe('new-hash');
    expect(result.unlockedUntil).toBeUndefined();
    expect(result.timerDuration).toBeUndefined();
    expect(result.timerBlockedUntil).toBeUndefined();
    expect(result.schedule).toBeUndefined();
  });

  it('applies a timer without carrying over an active timer block', () => {
    const result = applyBlockedSiteRuleSettings(site, {
      unlockType: 'timer',
      timerDuration: 45,
    });

    expect(result.unlockType).toBe('timer');
    expect(result.timerDuration).toBe(45);
    expect(result.timerBlockedUntil).toBeUndefined();
    expect(result.passwordHash).toBeUndefined();
    expect(result.schedule).toBeUndefined();
  });

  it('copies schedule days so sites do not share a mutable array', () => {
    const days = [1, 3, 5];
    const result = applyBlockedSiteRuleSettings(site, {
      unlockType: 'schedule',
      schedule: { days, startTime: '08:30', endTime: '18:00' },
    });

    expect(result.schedule).toEqual({ days, startTime: '08:30', endTime: '18:00' });
    expect(result.schedule?.days).not.toBe(days);
    expect(result.passwordHash).toBeUndefined();
    expect(result.timerDuration).toBeUndefined();
  });
});
