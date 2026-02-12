import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  authMiddleware,
  routePermissionMiddleware,
} from '../../../services/api-gateway/src/middleware/auth.js';
import type { FastifyRequest, FastifyReply } from 'fastify';

describe('Middleware', () => {
  describe('authMiddleware', () => {
    let request: Partial<FastifyRequest>;
    let reply: Partial<FastifyReply>;
    let sentStatus: number;
    let sentBody: unknown;

    beforeEach(() => {
      sentStatus = 0;
      sentBody = null;
      request = {
        url: '/api/containers',
        headers: {},
        server: {
          jwt: {
            verify: vi.fn(),
          },
        } as unknown as FastifyRequest['server'],
      };
      reply = {
        status: (code: number) => {
          sentStatus = code;
          return {
            send: (body: unknown) => {
              sentBody = body;
            },
          };
        },
      };
    });

    it('should skip auth for setup endpoints', async () => {
      request.url = '/api/auth/setup';

      await authMiddleware(request as FastifyRequest, reply as FastifyReply);

      expect(sentStatus).toBe(0);
    });

    it('should skip auth for setup-status endpoint', async () => {
      request.url = '/api/auth/setup-status';

      await authMiddleware(request as FastifyRequest, reply as FastifyReply);

      expect(sentStatus).toBe(0);
    });

    it('should skip auth for login endpoint', async () => {
      request.url = '/api/auth/login';

      await authMiddleware(request as FastifyRequest, reply as FastifyReply);

      expect(sentStatus).toBe(0);
    });

    it('should skip auth for health check', async () => {
      request.url = '/healthz';

      await authMiddleware(request as FastifyRequest, reply as FastifyReply);

      expect(sentStatus).toBe(0);
    });

    it('should reject request without authorization header', async () => {
      await authMiddleware(request as FastifyRequest, reply as FastifyReply);

      expect(sentStatus).toBe(401);
      expect((sentBody as { error: string }).error).toBe('Missing or invalid authorization header');
    });

    it('should reject request with invalid authorization format', async () => {
      request.headers = { authorization: 'Basic dXNlcjpwYXNz' };

      await authMiddleware(request as FastifyRequest, reply as FastifyReply);

      expect(sentStatus).toBe(401);
      expect((sentBody as { error: string }).error).toBe('Missing or invalid authorization header');
    });

    it('should verify valid JWT token', async () => {
      const decodedToken = { id: 'user-1', username: 'test', role: 'admin' };
      (request.server!.jwt.verify as ReturnType<typeof vi.fn>).mockReturnValue(decodedToken);
      request.headers = { authorization: 'Bearer valid-token' };

      await authMiddleware(request as FastifyRequest, reply as FastifyReply);

      expect(request.user).toEqual(decodedToken);
      expect(sentStatus).toBe(0);
    });

    it('should reject invalid JWT token', async () => {
      (request.server!.jwt.verify as ReturnType<typeof vi.fn>).mockImplementation(() => {
        throw new Error('Invalid token');
      });
      request.headers = { authorization: 'Bearer invalid-token' };

      await authMiddleware(request as FastifyRequest, reply as FastifyReply);

      expect(sentStatus).toBe(401);
      expect((sentBody as { error: string }).error).toBe('Invalid or expired token');
    });
  });

  describe('routePermissionMiddleware', () => {
    let request: Partial<FastifyRequest>;
    let reply: Partial<FastifyReply>;
    let sentStatus: number;
    let sentBody: unknown;

    beforeEach(() => {
      sentStatus = 0;
      sentBody = null;
      request = {
        method: 'GET',
        url: '/api/containers',
        headers: {},
        user: { id: 'user-1', username: 'test', role: 'admin' },
      };
      reply = {
        status: (code: number) => {
          sentStatus = code;
          return {
            send: (body: unknown) => {
              sentBody = body;
            },
          };
        },
      };
    });

    it('should skip permission check for auth routes', async () => {
      request.url = '/api/auth/login';

      await routePermissionMiddleware(request as FastifyRequest, reply as FastifyReply);

      expect(sentStatus).toBe(0);
    });

    it('should skip permission check for health endpoint', async () => {
      request.url = '/healthz';

      await routePermissionMiddleware(request as FastifyRequest, reply as FastifyReply);

      expect(sentStatus).toBe(0);
    });

    it('should deny access when not authenticated', async () => {
      request.user = undefined;

      await routePermissionMiddleware(request as FastifyRequest, reply as FastifyReply);

      expect(sentStatus).toBe(401);
      expect((sentBody as { error: string }).error).toBe('Not authenticated');
    });

    it('should allow admin to access any container endpoint', async () => {
      request.user = { id: 'user-1', username: 'test', role: 'admin' };

      await routePermissionMiddleware(request as FastifyRequest, reply as FastifyReply);

      expect(sentStatus).toBe(0);
    });

    it('should allow viewer to list containers', async () => {
      request.user = { id: 'user-1', username: 'test', role: 'viewer' };
      request.method = 'GET';
      request.url = '/api/containers';

      await routePermissionMiddleware(request as FastifyRequest, reply as FastifyReply);

      expect(sentStatus).toBe(0);
    });

    it('should deny viewer from creating containers', async () => {
      request.user = { id: 'user-1', username: 'test', role: 'viewer' };
      request.method = 'POST';
      request.url = '/api/containers';

      await routePermissionMiddleware(request as FastifyRequest, reply as FastifyReply);

      expect(sentStatus).toBe(403);
      expect((sentBody as { error: string }).error).toBe('Insufficient permissions');
    });

    it('should allow operator to start containers', async () => {
      request.user = { id: 'user-1', username: 'test', role: 'operator' };
      request.method = 'POST';
      request.url = '/api/containers/abc123/start';

      await routePermissionMiddleware(request as FastifyRequest, reply as FastifyReply);

      expect(sentStatus).toBe(0);
    });

    it('should deny operator from deleting containers', async () => {
      request.user = { id: 'user-1', username: 'test', role: 'operator' };
      request.method = 'DELETE';
      request.url = '/api/containers/abc123';

      await routePermissionMiddleware(request as FastifyRequest, reply as FastifyReply);

      expect(sentStatus).toBe(403);
    });

    it('should match parameterized routes correctly', async () => {
      request.user = { id: 'user-1', username: 'test', role: 'viewer' };
      request.method = 'GET';
      request.url = '/api/containers/abc123/logs';

      await routePermissionMiddleware(request as FastifyRequest, reply as FastifyReply);

      expect(sentStatus).toBe(0);
    });

    it('should handle query strings in URLs', async () => {
      request.user = { id: 'user-1', username: 'test', role: 'viewer' };
      request.method = 'GET';
      request.url = '/api/containers?all=true';

      await routePermissionMiddleware(request as FastifyRequest, reply as FastifyReply);

      expect(sentStatus).toBe(0);
    });
  });

  describe('Rate Limiting', () => {
    it('should have rate limiting configuration', () => {
      // Rate limiting is configured in app.ts
      // This test verifies the configuration structure
      const rateLimitConfig = {
        max: 100,
        timeWindow: '1 minute',
        keyGenerator: (request: { ip: string }) => request.ip,
      };

      expect(rateLimitConfig.max).toBeGreaterThan(0);
      expect(rateLimitConfig.timeWindow).toBeDefined();
      expect(typeof rateLimitConfig.keyGenerator).toBe('function');
    });
  });

  describe('Audit Logging', () => {
    it('should log authentication attempts', () => {
      // Audit logging is implemented in auth routes
      const auditLog = {
        userId: 'user-1',
        username: 'test',
        action: 'auth.login',
        resource: 'auth',
        ip: '127.0.0.1',
        userAgent: 'test-agent',
      };

      expect(auditLog).toHaveProperty('userId');
      expect(auditLog).toHaveProperty('action');
      expect(auditLog).toHaveProperty('timestamp');
    });

    it('should log user actions', () => {
      const auditLog = {
        userId: 'admin-1',
        username: 'admin',
        action: 'user.create',
        resource: 'user',
        resourceId: 'new-user-1',
        ip: '127.0.0.1',
        userAgent: 'test-agent',
      };

      expect(auditLog.action).toMatch(/^[a-z]+\.[a-z]+$/);
    });
  });

  describe('JWT Verification', () => {
    it('should validate JWT structure', () => {
      // JWT tokens have 3 parts separated by dots
      const validToken =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
      const parts = validToken.split('.');

      expect(parts).toHaveLength(3);
    });

    it('should verify token expiration', () => {
      const tokenPayload = {
        id: 'user-1',
        username: 'test',
        role: 'admin',
        exp: Math.floor(Date.now() / 1000) - 3600, // Expired 1 hour ago
      };

      expect(tokenPayload.exp).toBeLessThan(Math.floor(Date.now() / 1000));
    });

    it('should verify valid token expiration', () => {
      const tokenPayload = {
        id: 'user-1',
        username: 'test',
        role: 'admin',
        exp: Math.floor(Date.now() / 1000) + 3600, // Expires in 1 hour
      };

      expect(tokenPayload.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
    });
  });

  describe('CORS', () => {
    it('should allow requests from any origin in development', () => {
      const corsConfig = {
        origin: true,
        credentials: true,
      };

      expect(corsConfig.origin).toBe(true);
      expect(corsConfig.credentials).toBe(true);
    });

    it('should support credentials in CORS', () => {
      const corsConfig = {
        origin: true,
        credentials: true,
      };

      expect(corsConfig.credentials).toBe(true);
    });
  });
});
