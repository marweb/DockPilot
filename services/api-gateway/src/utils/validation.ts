/**
 * Validation utilities for system settings
 */

// Timezone validation - using Intl API (built-in, no external dependencies)
export function isValidTimezone(tz: string): boolean {
  if (!tz || typeof tz !== 'string') return false;

  try {
    // Test if the timezone is valid by creating a DateTimeFormat
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

// IPv4 validation
export function isValidIPv4(ip: string): boolean {
  if (!ip || typeof ip !== 'string') return true; // Allow empty/undefined
  if (ip.trim() === '') return true; // Allow empty string

  const ipv4Regex =
    /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  return ipv4Regex.test(ip.trim());
}

// IPv6 validation - comprehensive approach
export function isValidIPv6(ip: string): boolean {
  if (!ip || typeof ip !== 'string') return true; // Allow empty/undefined
  if (ip.trim() === '') return true; // Allow empty string

  const trimmed = ip.trim();

  // Quick check for valid IPv6 characters
  if (!/^[0-9a-fA-F:]+$/.test(trimmed)) {
    // Check for IPv4-mapped IPv6
    if (!trimmed.includes('.')) return false;
  }

  // Check for exactly one :: at most
  const doubleColonMatches = trimmed.match(/::/g);
  if (doubleColonMatches && doubleColonMatches.length > 1) return false;

  // Split by ::
  const parts = trimmed.split('::');
  if (parts.length > 2) return false;

  // Validate parts before and after ::
  const validatePart = (part: string): boolean => {
    if (!part) return true; // Empty part is valid
    const segments = part.split(':');
    // Each segment must be 1-4 hex digits
    return segments.every((seg) => /^[0-9a-fA-F]{1,4}$/.test(seg));
  };

  if (!validatePart(parts[0])) return false;
  if (parts[1] && !validatePart(parts[1])) return false;

  // Count total segments
  let segmentCount = 0;
  if (parts[0]) {
    segmentCount += parts[0] ? parts[0].split(':').filter(Boolean).length : 0;
  }
  if (parts[1]) {
    segmentCount += parts[1].split(':').filter(Boolean).length;
  }

  // With :: we can have up to 7 explicit segments (8 total - the compressed part)
  // Without :: we need exactly 8 segments
  if (doubleColonMatches) {
    return segmentCount <= 7;
  } else {
    return segmentCount === 8;
  }
}

// URL validation
export function isValidUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return true; // Allow empty/undefined
  if (url.trim() === '') return true; // Allow empty string

  try {
    new URL(url.trim());
    return true;
  } catch {
    return false;
  }
}

// Email validation
export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false;

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

// Resend API key validation (format: re_xxxxxx)
export function isValidResendApiKey(key: string): boolean {
  if (!key || typeof key !== 'string') return false;

  return /^re_[a-zA-Z0-9_-]+$/.test(key.trim());
}

// Telegram bot token validation (format: numbers:alphanumeric)
export function isValidTelegramBotToken(token: string): boolean {
  if (!token || typeof token !== 'string') return false;

  return /^\d+:[A-Za-z0-9_-]+$/.test(token.trim());
}

// Slack webhook URL validation
export function isValidSlackWebhookUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;

  try {
    const parsed = new URL(url.trim());
    return parsed.hostname === 'hooks.slack.com' || parsed.hostname.endsWith('.slack.com');
  } catch {
    return false;
  }
}

// Discord webhook URL validation
export function isValidDiscordWebhookUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;

  try {
    const parsed = new URL(url.trim());
    return parsed.hostname === 'discord.com' || parsed.hostname === 'discordapp.com';
  } catch {
    return false;
  }
}

// SMTP encryption validation
export function isValidSmtpEncryption(encryption: string): boolean {
  if (!encryption || typeof encryption !== 'string') return false;

  const validEncryptions = ['none', 'tls', 'ssl', 'starttls'];
  return validEncryptions.includes(encryption.toLowerCase());
}
