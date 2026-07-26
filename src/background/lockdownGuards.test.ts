import { describe, expect, it } from 'vitest';
import { BlockedSite, DailyLimit } from '../shared/types';
import {
  blockedSiteMutationRequiresAuth,
  blockedSitesMutationRequiresAuth,
  dailyLimitMutationRequiresAuth,
} from './lockdownGuards';

const site: BlockedSite = {
  id: 'site-1',
  pattern: 'example.com',
  enabled: false,
  unlockType: 'none',
  createdAt: 1,
};

const limit: DailyLimit = {
  id: 'limit-1',
  pattern: 'example.com',
  limitSeconds: 3600,
  enabled: false,
  bypassType: 'none',
};

describe('Lockdown mutation guards', () => {
  it('allows enabling a blocked site without authentication', () => {
    expect(blockedSiteMutationRequiresAuth(site, { ...site, enabled: true })).toBe(false);
  });

  it('requires authentication to disable a blocked site', () => {
    const enabledSite = { ...site, enabled: true };
    expect(blockedSiteMutationRequiresAuth(enabledSite, { ...enabledSite, enabled: false })).toBe(true);
  });

  it('allows a bulk enable while preserving protection for bulk disables', () => {
    expect(blockedSitesMutationRequiresAuth([site], [{ ...site, enabled: true }])).toBe(false);

    const enabledSite = { ...site, enabled: true };
    expect(blockedSitesMutationRequiresAuth([enabledSite], [{ ...enabledSite, enabled: false }])).toBe(true);
  });

  it('still protects site removal and blocking-rule changes', () => {
    expect(blockedSitesMutationRequiresAuth([site], [])).toBe(true);
    expect(blockedSiteMutationRequiresAuth(site, { ...site, pattern: 'other.example' })).toBe(true);
  });

  it('allows enabling a daily limit but protects disabling it', () => {
    expect(dailyLimitMutationRequiresAuth(limit, { ...limit, enabled: true })).toBe(false);

    const enabledLimit = { ...limit, enabled: true };
    expect(dailyLimitMutationRequiresAuth(enabledLimit, { ...enabledLimit, enabled: false })).toBe(true);
  });
});
