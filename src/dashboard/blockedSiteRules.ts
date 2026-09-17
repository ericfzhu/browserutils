import { BlockedSite } from '../shared/types';

export type BlockedSiteRuleSettings =
  | { unlockType: 'none' }
  | { unlockType: 'password'; passwordHash: string }
  | { unlockType: 'timer'; timerDuration: number }
  | {
      unlockType: 'schedule';
      schedule: NonNullable<BlockedSite['schedule']>;
    };

export function applyBlockedSiteRuleSettings(
  site: BlockedSite,
  settings: BlockedSiteRuleSettings
): BlockedSite {
  const {
    passwordHash: _passwordHash,
    unlockedUntil: _unlockedUntil,
    timerDuration: _timerDuration,
    timerBlockedUntil: _timerBlockedUntil,
    schedule: _schedule,
    ...unchangedSite
  } = site;

  if (settings.unlockType === 'password') {
    return {
      ...unchangedSite,
      unlockType: settings.unlockType,
      passwordHash: settings.passwordHash,
    };
  }

  if (settings.unlockType === 'timer') {
    return {
      ...unchangedSite,
      unlockType: settings.unlockType,
      timerDuration: settings.timerDuration,
    };
  }

  if (settings.unlockType === 'schedule') {
    return {
      ...unchangedSite,
      unlockType: settings.unlockType,
      schedule: {
        ...settings.schedule,
        days: [...settings.schedule.days],
      },
    };
  }

  return { ...unchangedSite, unlockType: 'none' };
}
