import { describe, expect, it, vi } from 'vitest';
import { getBlockRedirect } from './blockRedirect';

describe('content block redirect', () => {
  it('returns the canonical blocked page destination', async () => {
    const sendMessage = vi.fn(async () => ({
      blocked: true,
      redirectUrl: 'chrome-extension://id/blocked.html?site=one',
    }));
    await expect(getBlockRedirect('https://example.com', sendMessage)).resolves.toBe(
      'chrome-extension://id/blocked.html?site=one'
    );
    expect(sendMessage).toHaveBeenCalledWith({
      type: 'CHECK_SITE_WITH_REDIRECT',
      payload: { url: 'https://example.com' },
    });
  });

  it('leaves the page intact when the background worker is unavailable', async () => {
    const sendMessage = vi.fn(async () => { throw new Error('Context invalidated'); });
    await expect(getBlockRedirect('https://example.com', sendMessage)).resolves.toBeNull();
  });
});
