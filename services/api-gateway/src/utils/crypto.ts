import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from 'crypto';

const ENCRYPTED_PREFIX = 'enc:';
const IV_LENGTH = 12;
const MIN_MASTER_KEY_LENGTH = 16;

export function normalizeMasterKey(key: string): Buffer {
  if (!key || key.trim().length < MIN_MASTER_KEY_LENGTH) {
    throw new Error(`MASTER_KEY must be at least ${MIN_MASTER_KEY_LENGTH} characters`);
  }
  return createHash('sha256').update(key, 'utf8').digest();
}

export function encrypt(value: string, masterKey: string): string {
  if (!masterKey) {
    throw new Error('MASTER_KEY is required for encryption');
  }

  if (value.startsWith(ENCRYPTED_PREFIX)) {
    return value;
  }

  const iv = randomBytes(IV_LENGTH);
  const key = normalizeMasterKey(masterKey);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf-8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${ENCRYPTED_PREFIX}${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
}

export function decrypt(encryptedValue: string, masterKey: string): string {
  if (!masterKey) {
    throw new Error('MASTER_KEY is required for decryption');
  }

  if (!encryptedValue.startsWith(ENCRYPTED_PREFIX)) {
    return encryptedValue;
  }

  const parts = encryptedValue.slice(ENCRYPTED_PREFIX.length).split(':');
  if (parts.length < 2 || parts.length > 3) {
    throw new Error('Invalid encrypted value format: expected enc:<iv>:<tag>:<ciphertext>');
  }

  const [ivB64, tagB64, ciphertextB64 = ''] = parts;
  if (!ivB64 || !tagB64) {
    throw new Error('Invalid encrypted value format: missing iv or tag');
  }

  let iv: Buffer;
  let tag: Buffer;
  let ciphertext: Buffer;

  try {
    iv = Buffer.from(ivB64, 'base64');
    tag = Buffer.from(tagB64, 'base64');
    ciphertext = Buffer.from(ciphertextB64, 'base64');
  } catch {
    throw new Error('Invalid encrypted value format: invalid base64 encoding');
  }

  if (iv.length !== IV_LENGTH) {
    throw new Error(`Invalid IV length: expected ${IV_LENGTH} bytes, got ${iv.length}`);
  }

  const key = normalizeMasterKey(masterKey);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);

  try {
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return decrypted.toString('utf-8');
  } catch {
    throw new Error('Decryption failed: authentication tag verification failed');
  }
}

export function maskSecret(value: string, visibleChars: number = 4): string {
  if (!value || value.length === 0) {
    return '';
  }

  if (visibleChars <= 0) {
    return '*'.repeat(value.length);
  }

  if (visibleChars >= value.length) {
    return value;
  }

  const maskedLength = value.length - visibleChars;
  const visiblePart = value.slice(-visibleChars);
  return '*'.repeat(maskedLength) + visiblePart;
}

export function maskApiKey(value: string): string {
  if (!value || value.length === 0) {
    return '';
  }

  if (value.length <= 4) {
    return maskSecret(value, 0);
  }

  const prefixLength = Math.min(8, Math.floor(value.length / 4));
  const visibleLength = Math.min(4, Math.floor(value.length / 8));

  if (visibleLength === 0 || value.length <= prefixLength + visibleLength) {
    return maskSecret(value, Math.min(2, value.length));
  }

  const prefix = value.slice(0, prefixLength);
  const visiblePart = value.slice(-visibleLength);
  const maskedLength = value.length - prefixLength - visibleLength;

  return `${prefix}${'*'.repeat(maskedLength)}${visiblePart}`;
}

export function maskWebhookUrl(value: string): string {
  if (!value || value.length === 0) {
    return '';
  }

  try {
    const url = new URL(value);
    const protocol = url.protocol;
    const hostname = url.hostname;
    const pathname = url.pathname;

    let maskedPath = pathname;
    const pathParts = pathname.split('/').filter((part) => part.length > 0);

    if (pathParts.length > 0) {
      const lastPart = pathParts[pathParts.length - 1];
      if (lastPart.length > 8) {
        const maskedLastPart = maskSecret(lastPart, 4);
        maskedPath = pathname.slice(0, pathname.lastIndexOf(lastPart)) + maskedLastPart;
      }
    }

    let maskedUrl = `${protocol}//${hostname}${maskedPath}`;

    if (url.search) {
      const searchParams = new URLSearchParams(url.search);
      const maskedParams: string[] = [];

      for (const [key, val] of searchParams.entries()) {
        if (/token|key|secret|password|auth|api/i.test(key)) {
          maskedParams.push(`${key}=${maskSecret(val, 0)}`);
        } else {
          maskedParams.push(`${key}=${val}`);
        }
      }

      maskedUrl += `?${maskedParams.join('&')}`;
    }

    return maskedUrl;
  } catch {
    return maskSecret(value, 4);
  }
}

export function isEncrypted(value: string): boolean {
  if (!value || typeof value !== 'string') {
    return false;
  }
  return value.startsWith(ENCRYPTED_PREFIX);
}

export function generateSecureToken(length: number = 32): string {
  if (length <= 0) {
    throw new Error('Token length must be greater than 0');
  }

  const bytes = randomBytes(length);
  return bytes.toString('base64url');
}

export function verifyEncryptedValue(
  encryptedValue: string,
  originalValue: string,
  masterKey: string
): boolean {
  if (!masterKey) {
    throw new Error('MASTER_KEY is required for decryption');
  }

  if (!encryptedValue.startsWith(ENCRYPTED_PREFIX)) {
    return timingSafeEqual(Buffer.from(encryptedValue), Buffer.from(originalValue));
  }

  try {
    const decrypted = decrypt(encryptedValue, masterKey);
    return timingSafeEqual(Buffer.from(decrypted), Buffer.from(originalValue));
  } catch {
    return false;
  }
}
