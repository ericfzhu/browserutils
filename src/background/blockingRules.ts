import { BlockedSite } from '../shared/types';
import { matchesPattern } from '../shared/storage';
import { isTimeWithinScheduleWindow } from '../shared/time';

export interface BlockingContext {
  now: number;
  globalFocusActive: boolean;
  activeFocusFolderIds: ReadonlySet<string>;
}

export function isSiteRuleActive(site: BlockedSite, context: BlockingContext): boolean {
  if (
    context.globalFocusActive ||
    (site.folderId !== undefined && context.activeFocusFolderIds.has(site.folderId))
  ) {
    return true;
  }

  if (!site.enabled) return false;
  if (site.unlockedUntil && context.now < site.unlockedUntil) return false;

  if (site.unlockType === 'timer') {
    return !!site.timerBlockedUntil && context.now < site.timerBlockedUntil;
  }

  if (site.unlockType === 'schedule') {
    return isTimeWithinScheduleWindow(site.schedule, new Date(context.now));
  }

  return true;
}

export function findBlockingSite(
  url: string,
  sites: BlockedSite[],
  context: BlockingContext
): BlockedSite | undefined {
  return sites.find(site => matchesPattern(url, site.pattern) && isSiteRuleActive(site, context));
}
