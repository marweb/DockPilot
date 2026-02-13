import * as argon2 from 'argon2';

export interface PasswordHashOptions {
  memoryCost?: number;
  timeCost?: number;
  parallelism?: number;
  hashLength?: number;
  saltLength?: number;
}

// Secure default configuration for Argon2id
const DEFAULT_OPTIONS: Required<PasswordHashOptions> = {
  memoryCost: 65536, // 64 MB
  timeCost: 3, // 3 iterations
  parallelism: 4, // 4 parallel threads
  hashLength: 32, // 32 bytes output
  saltLength: 16, // 16 bytes salt
};

/**
 * Hash a password using Argon2id
 * @param password - Plain text password to hash
 * @param options - Optional configuration for Argon2
 * @returns Promise resolving to the hashed password
 */
export async function hashPassword(
  password: string,
  options: PasswordHashOptions = {}
): Promise<string> {
  const config = { ...DEFAULT_OPTIONS, ...options };

  try {
    // Keep options minimal for broad runtime compatibility across native argon2 builds.
    const hash = await argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: config.memoryCost,
      timeCost: config.timeCost,
      parallelism: config.parallelism,
    });

    return hash;
  } catch (error) {
    throw new Error(`Failed to hash password: ${(error as Error).message}`);
  }
}

/**
 * Verify a password against a hash
 * @param password - Plain text password to verify
 * @param hash - Hash to verify against
 * @returns Promise resolving to true if password matches, false otherwise
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch (error) {
    // Invalid hash format or verification error
    return false;
  }
}

/**
 * Verify a password and rehash if needed
 * Useful when upgrading Argon2 parameters
 * @param password - Plain text password
 * @param hash - Current hash
 * @param options - New hashing options
 * @returns Object with valid flag and newHash if rehashing was needed
 */
export async function verifyAndRehash(
  password: string,
  hash: string,
  options: PasswordHashOptions = {}
): Promise<{ valid: boolean; newHash?: string }> {
  const valid = await verifyPassword(password, hash);

  if (!valid) {
    return { valid: false };
  }

  // Check if rehashing is needed
  const needsRehash = argon2.needsRehash(hash, {
    type: argon2.argon2id,
    memoryCost: DEFAULT_OPTIONS.memoryCost,
    timeCost: DEFAULT_OPTIONS.timeCost,
    parallelism: DEFAULT_OPTIONS.parallelism,
  });

  if (needsRehash) {
    const newHash = await hashPassword(password, options);
    return { valid: true, newHash };
  }

  return { valid: true };
}

/**
 * Generate a secure random password
 * @param length - Length of the password (default: 16)
 * @returns Random password string
 */
export function generateRandomPassword(length = 16): string {
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);

  let password = '';
  for (let i = 0; i < length; i++) {
    password += charset[array[i] % charset.length];
  }

  return password;
}

/**
 * Validate password strength
 * @param password - Password to validate
 * @returns Object with isValid flag and array of error messages
 */
export function validatePasswordStrength(password: string): {
  isValid: boolean;
  errors: string[];
  score: number;
} {
  const errors: string[] = [];
  let score = 0;

  // Length check
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  } else if (password.length >= 12) {
    score += 2;
  } else {
    score += 1;
  }

  // Uppercase check
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  } else {
    score += 1;
  }

  // Lowercase check
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  } else {
    score += 1;
  }

  // Number check
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  } else {
    score += 1;
  }

  // Special character check
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('Password must contain at least one special character');
  } else {
    score += 1;
  }

  return {
    isValid: errors.length === 0,
    errors,
    score,
  };
}

/**
 * Check if a password has been compromised using haveibeenpwned API
 * Note: This requires network access and should be used sparingly
 * @param password - Password to check
 * @returns Promise resolving to true if password is compromised
 */
export async function isPasswordCompromised(password: string): Promise<boolean> {
  // This is a placeholder - in production, you might want to implement
  // the k-anonymity API from haveibeenpwned.com
  // For now, just check against common passwords
  const commonPasswords = [
    'password',
    '123456',
    '12345678',
    'qwerty',
    'abc123',
    'password123',
    'admin',
    'letmein',
    'welcome',
    'monkey',
  ];

  return commonPasswords.includes(password.toLowerCase());
}

/**
 * Get current Argon2 configuration
 * @returns Current configuration object
 */
export function getArgon2Config(): Required<PasswordHashOptions> {
  return { ...DEFAULT_OPTIONS };
}
