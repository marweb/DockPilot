import { describe, expect, it } from 'vitest';
import {
  encrypt,
  decrypt,
  maskSecret,
  maskApiKey,
  maskWebhookUrl,
  isEncrypted,
  normalizeMasterKey,
  generateSecureToken,
  verifyEncryptedValue,
} from '../../src/utils/crypto.js';

const TEST_MASTER_KEY = 'test-master-key-with-at-least-16-chars';
const SHORT_MASTER_KEY = 'short';
const LONG_MASTER_KEY = 'another-test-key-with-at-least-16-chars-for-testing';

describe('crypto', () => {
  describe('normalizeMasterKey', () => {
    it('should normalize a valid master key', () => {
      const key = normalizeMasterKey(TEST_MASTER_KEY);
      expect(key).toBeInstanceOf(Buffer);
      expect(key.length).toBe(32);
    });

    it('should throw error for short master key', () => {
      expect(() => normalizeMasterKey(SHORT_MASTER_KEY)).toThrow(
        'MASTER_KEY must be at least 16 characters'
      );
    });

    it('should throw error for empty master key', () => {
      expect(() => normalizeMasterKey('')).toThrow('MASTER_KEY must be at least 16 characters');
    });

    it('should throw error for whitespace-only master key', () => {
      expect(() => normalizeMasterKey('   ')).toThrow('MASTER_KEY must be at least 16 characters');
    });

    it('should produce consistent output for same input', () => {
      const key1 = normalizeMasterKey(TEST_MASTER_KEY);
      const key2 = normalizeMasterKey(TEST_MASTER_KEY);
      expect(key1.equals(key2)).toBe(true);
    });

    it('should produce different output for different inputs', () => {
      const key1 = normalizeMasterKey(TEST_MASTER_KEY);
      const key2 = normalizeMasterKey(LONG_MASTER_KEY);
      expect(key1.equals(key2)).toBe(false);
    });
  });

  describe('encrypt/decrypt', () => {
    it('should encrypt and decrypt a simple string', () => {
      const original = 'my-secret-value';
      const encrypted = encrypt(original, TEST_MASTER_KEY);
      const decrypted = decrypt(encrypted, TEST_MASTER_KEY);
      expect(decrypted).toBe(original);
    });

    it('should produce different ciphertexts for same plaintext', () => {
      const original = 'my-secret-value';
      const encrypted1 = encrypt(original, TEST_MASTER_KEY);
      const encrypted2 = encrypt(original, TEST_MASTER_KEY);
      expect(encrypted1).not.toBe(encrypted2);
      expect(encrypted1.startsWith('enc:')).toBe(true);
      expect(encrypted2.startsWith('enc:')).toBe(true);
    });

    it('should return same value if already encrypted', () => {
      const original = 'my-secret-value';
      const encrypted = encrypt(original, TEST_MASTER_KEY);
      const doubleEncrypted = encrypt(encrypted, TEST_MASTER_KEY);
      expect(doubleEncrypted).toBe(encrypted);
    });

    it('should encrypt empty string', () => {
      const original = '';
      const encrypted = encrypt(original, TEST_MASTER_KEY);
      expect(encrypted.startsWith('enc:')).toBe(true);
      const decrypted = decrypt(encrypted, TEST_MASTER_KEY);
      expect(decrypted).toBe(original);
    });

    it('should encrypt long strings', () => {
      const original = 'a'.repeat(10000);
      const encrypted = encrypt(original, TEST_MASTER_KEY);
      const decrypted = decrypt(encrypted, TEST_MASTER_KEY);
      expect(decrypted).toBe(original);
    });

    it('should encrypt strings with special characters', () => {
      const original = '!@#$%^&*()_+-=[]{}|;:,.<>?~`ñáéíóúÜÑ';
      const encrypted = encrypt(original, TEST_MASTER_KEY);
      const decrypted = decrypt(encrypted, TEST_MASTER_KEY);
      expect(decrypted).toBe(original);
    });

    it('should encrypt unicode strings', () => {
      const original = '🎉🔐💻🚀💪🏻🌍🌟';
      const encrypted = encrypt(original, TEST_MASTER_KEY);
      const decrypted = decrypt(encrypted, TEST_MASTER_KEY);
      expect(decrypted).toBe(original);
    });

    it('should throw error when encrypting without master key', () => {
      expect(() => encrypt('value', '')).toThrow('MASTER_KEY is required for encryption');
    });

    it('should throw error when decrypting without master key', () => {
      const encrypted = encrypt('value', TEST_MASTER_KEY);
      expect(() => decrypt(encrypted, '')).toThrow('MASTER_KEY is required for decryption');
    });

    it('should throw error for invalid encrypted format', () => {
      expect(() => decrypt('enc:invalid', TEST_MASTER_KEY)).toThrow(
        'Invalid encrypted value format'
      );
    });

    it('should throw error for missing parts in encrypted value', () => {
      expect(() => decrypt('enc:iv:tag', TEST_MASTER_KEY)).toThrow('Invalid IV length');
    });

    it('should throw error for invalid base64 in encrypted value', () => {
      expect(() => decrypt('enc:not-valid-base64:tag:data', TEST_MASTER_KEY)).toThrow(
        /Invalid (encrypted value format|IV length|authentication tag)/
      );
    });

    it('should throw error when decrypting with wrong key', () => {
      const original = 'my-secret-value';
      const encrypted = encrypt(original, TEST_MASTER_KEY);
      expect(() => decrypt(encrypted, LONG_MASTER_KEY)).toThrow(
        'Decryption failed: authentication tag verification failed'
      );
    });

    it('should throw error for tampered ciphertext', () => {
      const original = 'my-secret-value';
      const encrypted = encrypt(original, TEST_MASTER_KEY);
      const parts = encrypted.split(':');
      parts[3] = Buffer.from('tampered').toString('base64');
      const tampered = parts.join(':');
      expect(() => decrypt(tampered, TEST_MASTER_KEY)).toThrow(
        'Decryption failed: authentication tag verification failed'
      );
    });

    it('should throw error for tampered IV', () => {
      const original = 'my-secret-value';
      const encrypted = encrypt(original, TEST_MASTER_KEY);
      const parts = encrypted.split(':');
      parts[1] = Buffer.from('wrong-iv-123').toString('base64');
      const tampered = parts.join(':');
      expect(() => decrypt(tampered, TEST_MASTER_KEY)).toThrow(
        'Decryption failed: authentication tag verification failed'
      );
    });

    it('should throw error for tampered auth tag', () => {
      const original = 'my-secret-value';
      const encrypted = encrypt(original, TEST_MASTER_KEY);
      const parts = encrypted.split(':');
      parts[2] = Buffer.from('wrong-tag-12').toString('base64');
      const tampered = parts.join(':');
      expect(() => decrypt(tampered, TEST_MASTER_KEY)).toThrow(
        'Decryption failed: authentication tag verification failed'
      );
    });

    it('should return original value when decrypting non-encrypted string', () => {
      const original = 'not-encrypted-value';
      const decrypted = decrypt(original, TEST_MASTER_KEY);
      expect(decrypted).toBe(original);
    });
  });

  describe('maskSecret', () => {
    it('should mask all but last 4 characters by default', () => {
      const value = 'my-secret-password';
      expect(maskSecret(value)).toBe('**************word');
    });

    it('should mask all but last N characters when specified', () => {
      const value = 'my-secret-password';
      expect(maskSecret(value, 6)).toBe('************ssword');
    });

    it('should return empty string for empty input', () => {
      expect(maskSecret('')).toBe('');
    });

    it('should return original value when visibleChars is greater than length', () => {
      const value = 'short';
      expect(maskSecret(value, 10)).toBe('short');
    });

    it('should mask all characters when visibleChars is 0', () => {
      const value = 'secret';
      expect(maskSecret(value, 0)).toBe('******');
    });

    it('should mask all characters when visibleChars is negative', () => {
      const value = 'secret';
      expect(maskSecret(value, -1)).toBe('******');
    });

    it('should handle single character', () => {
      expect(maskSecret('a')).toBe('a');
      expect(maskSecret('a', 0)).toBe('*');
    });

    it('should handle exact visibleChars match', () => {
      const value = 'abcd';
      expect(maskSecret(value, 4)).toBe('abcd');
    });
  });

  describe('maskApiKey', () => {
    it('should show prefix and last 4 characters', () => {
      const key = 'sk_test_PLACEHOLDER_KEY_NOT_REAL_12345';
      const masked = maskApiKey(key);
      expect(masked.startsWith('sk_test_')).toBe(true);
      expect(masked.endsWith('2345')).toBe(true);
      expect(masked.includes('***')).toBe(true);
    });

    it('should return empty string for empty input', () => {
      expect(maskApiKey('')).toBe('');
    });

    it('should handle short API keys', () => {
      const key = 'abc';
      const masked = maskApiKey(key);
      expect(masked.includes('*')).toBe(true);
      expect(masked.length).toBe(3);
    });

    it('should handle medium length API keys', () => {
      const key = 'abcdefgh';
      const masked = maskApiKey(key);
      expect(masked.startsWith('ab')).toBe(true);
      expect(masked.length).toBe(8);
    });
  });

  describe('maskWebhookUrl', () => {
    it('should mask webhook token in URL', () => {
      const url = 'https://hooks.example.com/webhook/secret-token-12345';
      const masked = maskWebhookUrl(url);
      expect(masked).toContain('hooks.example.com');
      expect(masked).toContain('****2345');
    });

    it('should mask sensitive query parameters', () => {
      const url = 'https://api.example.com/webhook?token=secret123&key=api-key-abc&other=value';
      const masked = maskWebhookUrl(url);
      expect(masked).toContain('token=*******');
      expect(masked).toContain('key=***********');
      expect(masked).toContain('other=value');
    });

    it('should return empty string for empty input', () => {
      expect(maskWebhookUrl('')).toBe('');
    });

    it('should mask invalid URLs as secrets', () => {
      const invalid = 'not-a-valid-url-string';
      const masked = maskWebhookUrl(invalid);
      expect(masked).toContain('****');
    });

    it('should handle URLs without query parameters', () => {
      const url = 'https://api.example.com/webhook/endpoint';
      const masked = maskWebhookUrl(url);
      expect(masked).toBe(url);
    });

    it('should mask sensitive parts of webhook URLs', () => {
      const url = 'https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX';
      const masked = maskWebhookUrl(url);
      // Should keep domain but mask the token
      expect(masked).toContain('hooks.slack.com');
      expect(masked).toContain('***');
      // The actual token should be masked
      expect(masked).not.toBe(url);
    });
  });

  describe('isEncrypted', () => {
    it('should return true for encrypted values', () => {
      const encrypted = encrypt('test', TEST_MASTER_KEY);
      expect(isEncrypted(encrypted)).toBe(true);
    });

    it('should return false for plain text', () => {
      expect(isEncrypted('plain-text')).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(isEncrypted('')).toBe(false);
    });

    it('should return false for strings starting with similar prefix', () => {
      expect(isEncrypted('encrypted:value')).toBe(false);
      expect(isEncrypted('enc')).toBe(false);
      expect(isEncrypted('encoding:test')).toBe(false);
    });

    it('should return false for non-string values', () => {
      expect(isEncrypted(null as any)).toBe(false);
      expect(isEncrypted(undefined as any)).toBe(false);
      expect(isEncrypted(123 as any)).toBe(false);
    });
  });

  describe('generateSecureToken', () => {
    it('should generate token of default length', () => {
      const token = generateSecureToken();
      expect(token).toBeTruthy();
      expect(token.length).toBeGreaterThan(0);
    });

    it('should generate token of specified length', () => {
      const token = generateSecureToken(64);
      expect(token).toBeTruthy();
      expect(token.length).toBeGreaterThan(0);
    });

    it('should generate unique tokens', () => {
      const token1 = generateSecureToken();
      const token2 = generateSecureToken();
      expect(token1).not.toBe(token2);
    });

    it('should throw error for length 0', () => {
      expect(() => generateSecureToken(0)).toThrow('Token length must be greater than 0');
    });

    it('should throw error for negative length', () => {
      expect(() => generateSecureToken(-1)).toThrow('Token length must be greater than 0');
    });

    it('should use base64url encoding', () => {
      const token = generateSecureToken(32);
      expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    });
  });

  describe('verifyEncryptedValue', () => {
    it('should return true for matching values', () => {
      const original = 'test-value';
      const encrypted = encrypt(original, TEST_MASTER_KEY);
      expect(verifyEncryptedValue(encrypted, original, TEST_MASTER_KEY)).toBe(true);
    });

    it('should return false for non-matching values', () => {
      const original = 'test-value';
      const encrypted = encrypt(original, TEST_MASTER_KEY);
      expect(verifyEncryptedValue(encrypted, 'different-value', TEST_MASTER_KEY)).toBe(false);
    });

    it('should return true for matching plain text', () => {
      const value = 'plain-text';
      expect(verifyEncryptedValue(value, value, TEST_MASTER_KEY)).toBe(true);
    });

    it('should return false for non-matching plain text', () => {
      expect(verifyEncryptedValue('value1', 'value2', TEST_MASTER_KEY)).toBe(false);
    });

    it('should throw error without master key for encrypted value', () => {
      const encrypted = encrypt('test', TEST_MASTER_KEY);
      expect(() => verifyEncryptedValue(encrypted, 'test', '')).toThrow(
        'MASTER_KEY is required for decryption'
      );
    });

    it('should return false for tampered encrypted value', () => {
      const original = 'test-value';
      const encrypted = encrypt(original, TEST_MASTER_KEY);
      const parts = encrypted.split(':');
      parts[3] = Buffer.from('tampered').toString('base64');
      const tampered = parts.join(':');
      expect(verifyEncryptedValue(tampered, original, TEST_MASTER_KEY)).toBe(false);
    });
  });
});
