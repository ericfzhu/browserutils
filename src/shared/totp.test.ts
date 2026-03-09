import { describe, expect, it } from 'vitest';
import { buildOtpAuthUri, generateTotpCode, verifyTotpCode } from './totp';

describe('totp', () => {
  it('generates stable codes for a known secret and timestamp', async () => {
    const code = await generateTotpCode('JBSWY3DPEHPK3PXP', 0);
    expect(code).toBe('282760');
  });

  it('verifies current and adjacent time windows', async () => {
    const timestamp = 30000;
    const code = await generateTotpCode('JBSWY3DPEHPK3PXP', timestamp);
    await expect(verifyTotpCode('JBSWY3DPEHPK3PXP', code, timestamp)).resolves.toBe(true);
    await expect(verifyTotpCode('JBSWY3DPEHPK3PXP', code, timestamp + 30000)).resolves.toBe(true);
    await expect(verifyTotpCode('JBSWY3DPEHPK3PXP', '123456', timestamp)).resolves.toBe(false);
  });

  it('builds an otpauth uri', () => {
    expect(buildOtpAuthUri('SECRET', 'BrowserUtils', 'Lockdown')).toContain('otpauth://totp/');
    expect(buildOtpAuthUri('SECRET', 'BrowserUtils', 'Lockdown')).toContain('secret=SECRET');
  });
});
