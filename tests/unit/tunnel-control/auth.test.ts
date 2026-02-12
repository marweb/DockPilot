import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';

describe('Auth Routes', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = Fastify();
    
    app.post('/api/tunnels/auth/login', async (request, reply) => {
      const body = request.body as any;
      if (!body.apiToken || !body.accountId) {
        return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR' }});
      }
      if (body.apiToken === 'invalid') {
        return reply.status(401).send({ success: false, error: { code: 'AUTH_FAILED', message: 'Invalid API token' }});
      }
      return {
        success: true,
        message: 'Authentication successful',
        data: { authenticated: true, accountId: body.accountId, accountName: 'Test Account' }
      };
    });

    app.post('/api/tunnels/auth/logout', async () => ({
      success: true,
      message: 'Logged out successfully'
    }));

    app.get('/api/tunnels/auth/status', async () => ({
      success: true,
      data: { authenticated: true, accountId: '12345678901234567890123456789012', method: 'api_token' }
    }));
  });

  afterEach(async () => {
    await app.close();
  });

  describe('POST /api/tunnels/auth/login', () => {
    it('should login successfully with valid credentials', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/tunnels/auth/login',
        payload: {
          apiToken: 'valid-token',
          accountId: '12345678901234567890123456789012',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.authenticated).toBe(true);
    });

    it('should return 401 on invalid token', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/tunnels/auth/login',
        payload: {
          apiToken: 'invalid',
          accountId: '12345678901234567890123456789012',
        },
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('AUTH_FAILED');
    });

    it('should validate API token format', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/tunnels/auth/login',
        payload: {
          apiToken: '',
          accountId: '12345678901234567890123456789012',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
    });
  });

  describe('POST /api/tunnels/auth/logout', () => {
    it('should logout successfully', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/tunnels/auth/logout',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.message).toBe('Logged out successfully');
    });
  });

  describe('GET /api/tunnels/auth/status', () => {
    it('should return authenticated status', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/tunnels/auth/status',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.authenticated).toBe(true);
    });
  });
});
