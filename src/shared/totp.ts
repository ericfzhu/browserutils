const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function generateTotpSecret(length = 32): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  let secret = '';
  for (let i = 0; i < bytes.length; i++) {
    secret += BASE32_ALPHABET[bytes[i] % BASE32_ALPHABET.length];
  }
  return secret;
}

function base32ToBytes(input: string): Uint8Array {
  const sanitized = input.toUpperCase().replace(/=+$/g, '').replace(/[^A-Z2-7]/g, '');
  let bits = '';

  for (const char of sanitized) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index === -1) {
      throw new Error('Invalid base32 secret');
    }
    bits += index.toString(2).padStart(5, '0');
  }

  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  return new Uint8Array(bytes);
}

function counterToBytes(counter: number): Uint8Array {
  const bytes = new Uint8Array(8);
  let value = counter;
  for (let i = 7; i >= 0; i--) {
    bytes[i] = value & 0xff;
    value = Math.floor(value / 256);
  }
  return bytes;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

export function buildOtpAuthUri(secret: string, issuer: string, accountName: string): string {
  const label = encodeURIComponent(`${issuer}:${accountName}`);
  const issuerParam = encodeURIComponent(issuer);
  const secretParam = encodeURIComponent(secret);
  return `otpauth://totp/${label}?secret=${secretParam}&issuer=${issuerParam}&algorithm=SHA1&digits=6&period=30`;
}

export async function generateTotpCode(secret: string, timestamp = Date.now()): Promise<string> {
  const counter = Math.floor(timestamp / 30000);
  const secretBytes = base32ToBytes(secret);
  const counterBytes = counterToBytes(counter);
  const key = await crypto.subtle.importKey(
    'raw',
    toArrayBuffer(secretBytes),
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    toArrayBuffer(counterBytes)
  );
  const hmac = new Uint8Array(signature);
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return String(binary % 1000000).padStart(6, '0');
}

export async function verifyTotpCode(secret: string, code: string, timestamp = Date.now(), window = 1): Promise<boolean> {
  const normalized = code.replace(/\s+/g, '');
  if (!/^\d{6}$/.test(normalized)) {
    return false;
  }

  for (let offset = -window; offset <= window; offset++) {
    const expected = await generateTotpCode(secret, timestamp + offset * 30000);
    if (expected === normalized) {
      return true;
    }
  }

  return false;
}
