import { describe, expect, it } from 'vitest';
import { BlockedSite } from '../shared/types';
import { findBlockingSite, isSiteRuleActive } from './blockingRules';

const now = new Date('2026-08-09T18:00:00').getTime();

function site(overrides: Partial<BlockedSite>): BlockedSite {
  return {
    id: overrides.id || crypto.randomUUID(),
    pattern: 'example.com',
    enabled: true,
    unlockType: 'none',
    createdAt: now,
    ...overrides,
  };
}

const context = {
  now,
  globalFocusActive: false,
  activeFocusFolderIds: new Set<string>(),
};

describe('blocking rule evaluation', () => {
  it('continues past an inactive matching rule to an active overlapping rule', () => {
    const inactive = site({
      id: 'inactive',
      unlockType: 'timer',
      timerBlockedUntil: now - 1,
    });
    const active = site({ id: 'active', pattern: '*.example.com' });

    expect(findBlockingSite('https://example.com/path', [inactive, active], context)?.id).toBe('active');
  });

  it('does not let an unlocked exact rule override an active wildcard rule', () => {
    const unlocked = site({ id: 'unlocked', unlockedUntil: now + 60_000 });
    const active = site({ id: 'active', pattern: '*.example.com' });

    expect(findBlockingSite('https://www.example.com/', [unlocked, active], context)?.id).toBe('active');
  });

  it('lets focus sessions activate disabled rules', () => {
    const focused = site({ id: 'focused', enabled: false, folderId: 'work' });
    expect(isSiteRuleActive(focused, {
      ...context,
      activeFocusFolderIds: new Set(['work']),
    })).toBe(true);
  });

  it('returns no block when every matching rule is inactive', () => {
    const disabled = site({ enabled: false });
    const expiredTimer = site({ unlockType: 'timer', timerBlockedUntil: now - 1 });
    expect(findBlockingSite('https://example.com/', [disabled, expiredTimer], context)).toBeUndefined();
  });
});
