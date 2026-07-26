import { BlockedSite, DailyLimit } from '../shared/types';

export function blockedSiteMutationRequiresAuth(
  current: BlockedSite,
  next: BlockedSite
): boolean {
  return (current.enabled && !next.enabled) ||
    current.pattern !== next.pattern ||
    current.unlockType !== next.unlockType ||
    current.passwordHash !== next.passwordHash ||
    current.timerDuration !== next.timerDuration ||
    JSON.stringify(current.schedule) !== JSON.stringify(next.schedule);
}

export function blockedSitesMutationRequiresAuth(
  currentSites: BlockedSite[],
  nextSites: BlockedSite[]
): boolean {
  const currentById = new Map(currentSites.map(site => [site.id, site]));
  const nextIds = new Set(nextSites.map(site => site.id));

  return currentSites.some(site => !nextIds.has(site.id)) ||
    nextSites.some(site => {
      const current = currentById.get(site.id);
      return current ? blockedSiteMutationRequiresAuth(current, site) : false;
    });
}

export function dailyLimitMutationRequiresAuth(
  current: DailyLimit,
  next: DailyLimit
): boolean {
  return (current.enabled && !next.enabled) ||
    current.pattern !== next.pattern ||
    current.limitSeconds !== next.limitSeconds ||
    current.bypassType !== next.bypassType ||
    current.passwordHash !== next.passwordHash ||
    current.cooldownSeconds !== next.cooldownSeconds;
}
