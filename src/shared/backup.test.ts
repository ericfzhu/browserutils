import { describe, expect, it } from 'vitest';
import { decryptBackup, encryptBackup, isEncryptedBackup, validateImportData } from './backup';

describe('encrypted backups', () => {
  it('round trips complete extension data', async () => {
    const data = {
      settings: { passwordHash: 'secret-hash', lockdownTotpSecret: 'totp-secret' },
      blockedSites: [{ id: 'site-1', passwordHash: 'site-secret' }],
      'dailyStats:2026-08-09': { date: '2026-08-09', sessions: {} },
    };

    const backup = await encryptBackup(data, 'backup password');
    expect(isEncryptedBackup(backup)).toBe(true);
    await expect(decryptBackup(backup, 'backup password')).resolves.toEqual(data);
  });

  it('rejects the wrong password', async () => {
    const backup = await encryptBackup({ settings: {} }, 'correct');
    await expect(decryptBackup(backup, 'wrong')).rejects.toThrow('Incorrect backup password');
  });

  it('rejects unsupported fields before import', () => {
    expect(validateImportData({ settings: {}, unexpected: true })).toBe(
      'Unsupported backup field: unexpected'
    );
  });
});
