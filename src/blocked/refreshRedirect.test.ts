import { describe, expect, it } from 'vitest';
import { getRefreshRedirect, parseBlockedPageParams } from './refreshRedirect';

const currentUrl =
  'chrome-extension://extension-id/blocked.html?site=old-rule&returnUrl=https%3A%2F%2Fexample.com';
const returnUrl = 'https://example.com/';

describe('getRefreshRedirect', () => {
  it('returns to the requested website when it is no longer blocked', () => {
    expect(getRefreshRedirect(currentUrl, returnUrl, { blocked: false })).toBe(returnUrl);
  });

  it('switches to the current blocking rule when it has changed', () => {
    const redirectUrl =
      'chrome-extension://extension-id/blocked.html?site=new-rule&returnUrl=https%3A%2F%2Fexample.com';

    expect(
      getRefreshRedirect(currentUrl, returnUrl, { blocked: true, redirectUrl })
    ).toBe(redirectUrl);
  });

  it('stays on the page when the same rule still blocks the website', () => {
    expect(
      getRefreshRedirect(currentUrl, returnUrl, {
        blocked: true,
        redirectUrl: currentUrl,
      })
    ).toBeNull();
  });

  it('fails closed when the block check has no response', () => {
    expect(getRefreshRedirect(currentUrl, returnUrl, undefined)).toBeNull();
  });
});

describe('parseBlockedPageParams', () => {
  it('reads existing query-string redirects', () => {
    expect(parseBlockedPageParams(
      '?site=site-1&returnUrl=https%3A%2F%2Fexample.com%2Fpath',
      ''
    )).toEqual({
      type: null,
      siteId: 'site-1',
      limitId: null,
      returnUrl: 'https://example.com/path',
    });
  });

  it('preserves a complete DNR return URL in the hash', () => {
    expect(parseBlockedPageParams(
      '',
      '#site=site-2&returnUrl=https://example.com/path?first=1&second=2#details'
    )).toEqual({
      type: null,
      siteId: 'site-2',
      limitId: null,
      returnUrl: 'https://example.com/path?first=1&second=2#details',
    });
  });
});
