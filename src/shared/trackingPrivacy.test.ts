import { describe, expect, it } from 'vitest';
import { isTrackingExcluded, normalizeExcludedDomains, validateHistoryRange } from './trackingPrivacy';
describe('tracking privacy', () => {
  it('normalizes domains and matches exact domains and subdomains only', () => {
    const excludedDomains = normalizeExcludedDomains(['Example.COM', 'https://example.com/', '', 'private.test']);
    expect(excludedDomains).toEqual(['example.com', 'private.test']);
    expect(isTrackingExcluded('https://sub.example.com/path', { excludedDomains })).toBe(true);
    expect(isTrackingExcluded('https://notexample.com', { excludedDomains })).toBe(false);
    expect(isTrackingExcluded('https://example.com.attacker.test', { excludedDomains })).toBe(false);
  });
  it.each(['example.com/path', '*.example.com', 'https://user:pass@example.com', 'file:///tmp/test'])('rejects non-domain exclusion %s', value => {
    expect(() => normalizeExcludedDomains([value])).toThrow();
  });
  it('validates local calendar dates and range ordering', () => {
    expect(() => validateHistoryRange('2026-02-30', '2026-03-01')).toThrow();
    expect(() => validateHistoryRange('2026-09-19', '2026-09-18')).toThrow();
    expect(() => validateHistoryRange('2026-09-18', '2026-09-18')).not.toThrow();
  });
});
