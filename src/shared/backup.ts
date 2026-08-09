const BACKUP_FORMAT = 'browserutils-encrypted-backup';
const BACKUP_VERSION = 1;
const BACKUP_KDF_ITERATIONS = 250_000;
const MAX_IMPORT_BYTES = 9 * 1024 * 1024;
const BACKUP_CONTEXT = new TextEncoder().encode(`${BACKUP_FORMAT}:${BACKUP_VERSION}`);

export interface EncryptedBackup {
  format: typeof BACKUP_FORMAT;
  version: typeof BACKUP_VERSION;
  exportedAt: string;
  kdf: {
    name: 'PBKDF2';
    hash: 'SHA-256';
    iterations: number;
    salt: string;
  };
  cipher: {
    name: 'AES-GCM';
    iv: string;
    data: string;
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, character => character.charCodeAt(0));
}

async function deriveBackupKey(password: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey({
    name: 'PBKDF2',
    hash: 'SHA-256',
    salt: Uint8Array.from(salt).buffer,
    iterations,
  }, material, {
    name: 'AES-GCM',
    length: 256,
  }, false, ['encrypt', 'decrypt']);
}

export function isEncryptedBackup(value: unknown): value is EncryptedBackup {
  if (!isRecord(value) || value.format !== BACKUP_FORMAT || value.version !== BACKUP_VERSION) return false;
  return isRecord(value.kdf) &&
    value.kdf.name === 'PBKDF2' &&
    value.kdf.hash === 'SHA-256' &&
    typeof value.kdf.iterations === 'number' &&
    typeof value.kdf.salt === 'string' &&
    isRecord(value.cipher) &&
    value.cipher.name === 'AES-GCM' &&
    typeof value.cipher.iv === 'string' &&
    typeof value.cipher.data === 'string';
}

export async function encryptBackup(
  data: Record<string, unknown>,
  password: string
): Promise<EncryptedBackup> {
  if (!password) throw new Error('A backup password is required');
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveBackupKey(password, salt, BACKUP_KDF_ITERATIONS);
  const plaintext = new TextEncoder().encode(JSON.stringify(data));
  const encrypted = await crypto.subtle.encrypt({
    name: 'AES-GCM',
    iv: Uint8Array.from(iv).buffer,
    additionalData: BACKUP_CONTEXT,
  }, key, plaintext);

  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    kdf: {
      name: 'PBKDF2',
      hash: 'SHA-256',
      iterations: BACKUP_KDF_ITERATIONS,
      salt: bytesToBase64(salt),
    },
    cipher: {
      name: 'AES-GCM',
      iv: bytesToBase64(iv),
      data: bytesToBase64(new Uint8Array(encrypted)),
    },
  };
}

export async function decryptBackup(
  backup: EncryptedBackup,
  password: string
): Promise<Record<string, unknown>> {
  if (!password) throw new Error('A backup password is required');
  if (!isEncryptedBackup(backup)) throw new Error('Unsupported backup format');

  try {
    const salt = base64ToBytes(backup.kdf.salt);
    const iv = base64ToBytes(backup.cipher.iv);
    const key = await deriveBackupKey(password, salt, backup.kdf.iterations);
    const decrypted = await crypto.subtle.decrypt({
      name: 'AES-GCM',
      iv: Uint8Array.from(iv).buffer,
      additionalData: BACKUP_CONTEXT,
    }, key, Uint8Array.from(base64ToBytes(backup.cipher.data)).buffer);
    const value = JSON.parse(new TextDecoder().decode(decrypted));
    if (!isRecord(value)) throw new Error('Backup payload is invalid');
    return value;
  } catch (error) {
    if (error instanceof Error && error.message === 'Backup payload is invalid') throw error;
    throw new Error('Incorrect backup password or corrupted backup');
  }
}

export function validateImportData(data: unknown): string | null {
  if (!isRecord(data)) return 'Import data must be an object';
  if (new TextEncoder().encode(JSON.stringify(data)).byteLength > MAX_IMPORT_BYTES) {
    return 'Backup is too large for extension storage';
  }

  const arrayKeys = new Set([
    'blockedSites',
    'blockedSiteFolders',
    'dailyLimits',
    'customCategories',
    'focusSessions',
  ]);
  const objectKeys = new Set([
    'settings',
    'dailyStats',
    'domainCategories',
    'builtInCategoryOverrides',
  ]);
  const scalarKeys = new Set(['sessionFormatMigrated', 'storageSchemaVersion']);

  for (const [key, value] of Object.entries(data)) {
    if (key === 'activeSessions' || key === 'activeYouTubeSessions') continue;
    if (key.startsWith('dailyStats:')) {
      if (!isRecord(value)) return `Invalid daily history entry: ${key}`;
      continue;
    }
    if (arrayKeys.has(key)) {
      if (!Array.isArray(value)) return `Invalid ${key} value`;
      continue;
    }
    if (objectKeys.has(key)) {
      if (!isRecord(value)) return `Invalid ${key} value`;
      continue;
    }
    if (!scalarKeys.has(key)) return `Unsupported backup field: ${key}`;
  }

  return null;
}
