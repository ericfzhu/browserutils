import { describe, expect, it } from 'vitest';
import { getRefreshRedirect } from './refreshRedirect';

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
