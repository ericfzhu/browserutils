import type { Settings } from './types';
import { getLocalDateString } from './time';

export function normalizeExcludedDomains(values: string[]): string[] {
  if (!Array.isArray(values) || values.some(value => typeof value !== 'string')) throw new Error('Enter one domain per line.');
  return [...new Set(values.filter(value => value.trim()).map(value => {
    const url = new URL(value.includes('://') ? value.trim() : `https://${value.trim()}`);
    if (!['http:', 'https:'].includes(url.protocol) || url.pathname !== '/' || url.search || url.hash || url.username || url.password || url.port || url.hostname.includes('*')) {
      throw new Error('Use domains such as example.com, without paths, ports or wildcards.');
    }
    return url.hostname.toLowerCase().replace(/\.$/, '');
  }))].sort();
}

export function isTrackingExcluded(urlOrDomain: string, settings: Pick<Settings, 'excludedDomains'>): boolean {
  let domain: string;
  try { domain = new URL(urlOrDomain.includes('://') ? urlOrDomain : `https://${urlOrDomain}`).hostname.toLowerCase().replace(/\.$/, ''); }
  catch { return false; }
  return (settings.excludedDomains ?? []).some(excluded => domain === excluded || domain.endsWith(`.${excluded}`));
}

export function validateHistoryRange(startDate: string, endDate: string): void {
  for (const value of [startDate, endDate]) {
    const date = new Date(`${value}T00:00:00`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(date.getTime()) || getLocalDateString(date) !== value) {
      throw new Error('Choose valid start and end dates.');
    }
  }
  if (startDate > endDate) throw new Error('The end date must be on or after the start date.');
}
