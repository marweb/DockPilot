import type { FastifyRequest, FastifyReply } from 'fastify';
import type { UserRole } from '@dockpilot/types';
import '../types/fastify.js';

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  skipSuccessfulRequests?: boolean;
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

interface RateLimitStore {
  [key: string]: RateLimitEntry;
}

// In-memory store for rate limiting
const store: RateLimitStore = {};

// Cleanup interval reference
let cleanupInterval: ReturnType<typeof setInterval> | null = null;

// Default rate limits by role
const defaultRoleLimits: Record<UserRole, RateLimitConfig> = {
  admin: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 1000,
    skipSuccessfulRequests: false,
  },
  operator: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 500,
    skipSuccessfulRequests: false,
  },
  viewer: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 200,
    skipSuccessfulRequests: false,
  },
};

// Default rate limit for unauthenticated requests
const defaultAnonymousConfig: RateLimitConfig = {
  windowMs: 60 * 1000,
  maxRequests: 30,
  skipSuccessfulRequests: false,
};

/**
 * Generate a key for rate limiting
 */
function generateKey(identifier: string, type: 'ip' | 'user'): string {
  return `${type}:${identifier}`;
}

/**
 * Get rate limit entry from store
 */
function getEntry(key: string): RateLimitEntry | undefined {
  return store[key];
}

/**
 * Set rate limit entry in store
 */
function setEntry(key: string, entry: RateLimitEntry): void {
  store[key] = entry;
}

/**
 * Increment request count for a key
 */
function incrementCount(key: string, windowMs: number): RateLimitEntry {
  const now = Date.now();
  const entry = getEntry(key);

  if (!entry || now > entry.resetTime) {
    const newEntry: RateLimitEntry = {
      count: 1,
      resetTime: now + windowMs,
    };
    setEntry(key, newEntry);
    return newEntry;
  }

  entry.count++;
  return entry;
}

/**
 * Clean up expired entries from store
 */
function cleanupStore(): void {
  const now = Date.now();
  for (const key of Object.keys(store)) {
    if (store[key].resetTime <= now) {
      delete store[key];
    }
  }
}

/**
 * Start cleanup interval
 */
export function startRateLimitCleanup(intervalMs = 60000): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
  }
  cleanupInterval = setInterval(cleanupStore, intervalMs);
}

/**
 * Stop cleanup interval
 */
export function stopRateLimitCleanup(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
}

/**
 * Get rate limit headers
 */
function getRateLimitHeaders(entry: RateLimitEntry, maxRequests: number): Record<string, string> {
  const remaining = Math.max(0, maxRequests - entry.count);
  const resetTime = Math.ceil(entry.resetTime / 1000);

  return {
    'X-RateLimit-Limit': maxRequests.toString(),
    'X-RateLimit-Remaining': remaining.toString(),
    'X-RateLimit-Reset': resetTime.toString(),
  };
}

/**
 * Rate limit middleware factory
 */
export function createRateLimitMiddleware(config?: Partial<RateLimitConfig>) {
  return async function (request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const role: UserRole = request.user?.role || 'viewer';
    const roleConfig = defaultRoleLimits[role];

    const finalConfig: RateLimitConfig = {
      ...roleConfig,
      ...config,
    };

    // Generate key based on user ID or IP
    const identifier = request.user?.id || request.ip;
    const key = generateKey(identifier, request.user ? 'user' : 'ip');

    const entry = incrementCount(key, finalConfig.windowMs);
    const headers = getRateLimitHeaders(entry, finalConfig.maxRequests);

    // Set rate limit headers
    for (const [header, value] of Object.entries(headers)) {
      void reply.header(header, value);
    }

    // Check if limit exceeded
    if (entry.count > finalConfig.maxRequests) {
      reply.status(429).send({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests. Please try again later.',
          retryAfter: Math.ceil((entry.resetTime - Date.now()) / 1000),
        },
      });
      return;
    }

    // Store entry reference for post-response handling
    (request as unknown as Record<string, unknown>).rateLimitEntry = entry;
    (request as unknown as Record<string, unknown>).rateLimitMax = finalConfig.maxRequests;
  };
}

/**
 * Rate limit middleware with differentiated limits by role
 */
export async function rateLimitMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const role: UserRole = request.user?.role || 'viewer';
  const config = defaultRoleLimits[role];

  // Generate key based on user ID or IP
  const identifier = request.user?.id || request.ip;
  const key = generateKey(identifier, request.user ? 'user' : 'ip');

  const entry = incrementCount(key, config.windowMs);
  const headers = getRateLimitHeaders(entry, config.maxRequests);

  // Set rate limit headers
  for (const [header, value] of Object.entries(headers)) {
    void reply.header(header, value);
  }

  // Check if limit exceeded
  if (entry.count > config.maxRequests) {
    reply.status(429).send({
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests. Please try again later.',
        retryAfter: Math.ceil((entry.resetTime - Date.now()) / 1000),
      },
    });
    return;
  }
}

/**
 * Strict rate limit for sensitive endpoints (login, password reset)
 */
export async function strictRateLimitMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const config: RateLimitConfig = {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5,
    skipSuccessfulRequests: false,
  };

  const key = generateKey(request.ip, 'ip');
  const entry = incrementCount(key, config.windowMs);
  const headers = getRateLimitHeaders(entry, config.maxRequests);

  // Set rate limit headers
  for (const [header, value] of Object.entries(headers)) {
    void reply.header(header, value);
  }

  // Check if limit exceeded
  if (entry.count > config.maxRequests) {
    reply.status(429).send({
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many login attempts. Please try again later.',
        retryAfter: Math.ceil((entry.resetTime - Date.now()) / 1000),
      },
    });
    return;
  }
}

/**
 * Get current rate limit status for an identifier
 */
export function getRateLimitStatus(
  identifier: string,
  type: 'ip' | 'user' = 'ip'
): { count: number; remaining: number; resetTime: number } | null {
  const key = generateKey(identifier, type);
  const entry = getEntry(key);

  if (!entry) {
    return null;
  }

  const now = Date.now();
  if (now > entry.resetTime) {
    return null;
  }

  return {
    count: entry.count,
    remaining: Math.max(0, 1000 - entry.count), // Default max for status check
    resetTime: entry.resetTime,
  };
}

/**
 * Reset rate limit for an identifier
 */
export function resetRateLimit(identifier: string, type: 'ip' | 'user' = 'ip'): void {
  const key = generateKey(identifier, type);
  delete store[key];
}

/**
 * Configure rate limits for roles
 */
export function configureRoleLimits(
  limits: Partial<Record<UserRole, Partial<RateLimitConfig>>>
): void {
  for (const [role, config] of Object.entries(limits)) {
    if (role in defaultRoleLimits) {
      defaultRoleLimits[role as UserRole] = {
        ...defaultRoleLimits[role as UserRole],
        ...config,
      };
    }
  }
}
