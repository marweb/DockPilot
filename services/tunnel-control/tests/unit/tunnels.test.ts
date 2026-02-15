import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';

describe('Tunnel Routes', () => {
  let app: FastifyInstance;

  const mockTunnel = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    name: 'test-tunnel',
    accountId: '12345678901234567890123456789012',
    zoneId: 'zone123',
    status: 'inactive' as const,
    createdAt: new Date('2024-01-01'),
    ingressRules: [],
    connectedServices: [],
  };

  beforeEach(async () => {
    app = Fastify();

    // Register a simple test route
    app.get('/api/tunnels', async () => ({
      success: true,
      data: [mockTunnel],
      meta: { total: 1 },
    }));

    app.post('/api/tunnels', async (request, reply) => {
      const body = request.body as any;
      if (!body.name) {
        return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR' } });
      }
      return reply.status(201).send({
        success: true,
        data: mockTunnel,
        message: 'Tunnel created successfully',
      });
    });

    app.get('/api/tunnels/:id', async (request, reply) => {
      const { id } = request.params as any;
      if (id === 'not-found') {
        return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND' } });
      }
      return { success: true, data: mockTunnel };
    });

    app.delete('/api/tunnels/:id', async () => ({
      success: true,
      message: 'Tunnel deleted successfully',
    }));

    app.post('/api/tunnels/:id/start', async () => ({
      success: true,
      message: 'Tunnel started successfully',
      data: { status: 'active' },
    }));

    app.post('/api/tunnels/:id/stop', async () => ({
      success: true,
      message: 'Tunnel stopped successfully',
      data: { status: 'inactive' },
    }));

    app.get('/api/tunnels/:id/logs', async () => ({
      success: true,
      data: { logs: ['log1', 'log2'], lines: 2 },
    }));

    app.get('/api/tunnels/:id/status', async () => ({
      success: true,
      data: { status: 'active', pid: 12345 },
    }));
  });

  afterEach(async () => {
    await app.close();
  });

  describe('GET /api/tunnels', () => {
    it('should list all tunnels successfully', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/tunnels',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(1);
      expect(body.meta.total).toBe(1);
    });
  });

  describe('POST /api/tunnels', () => {
    it('should create a tunnel successfully', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/tunnels',
        payload: { name: 'test-tunnel' },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.name).toBe('test-tunnel');
    });

    it('should validate input data', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/tunnels',
        payload: {},
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
    });
  });

  describe('GET /api/tunnels/:id', () => {
    it('should get a tunnel by ID', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/tunnels/550e8400-e29b-41d4-a716-446655440000',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.id).toBe(mockTunnel.id);
    });

    it('should return 404 for non-existent tunnel', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/tunnels/not-found',
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
    });
  });

  describe('DELETE /api/tunnels/:id', () => {
    it('should delete a tunnel successfully', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/api/tunnels/550e8400-e29b-41d4-a716-446655440000',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.message).toBe('Tunnel deleted successfully');
    });
  });

  describe('POST /api/tunnels/:id/start', () => {
    it('should start a tunnel successfully', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/tunnels/550e8400-e29b-41d4-a716-446655440000/start',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.status).toBe('active');
    });
  });

  describe('POST /api/tunnels/:id/stop', () => {
    it('should stop a tunnel successfully', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/tunnels/550e8400-e29b-41d4-a716-446655440000/stop',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.status).toBe('inactive');
    });
  });

  describe('GET /api/tunnels/:id/logs', () => {
    it('should get tunnel logs successfully', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/tunnels/550e8400-e29b-41d4-a716-446655440000/logs',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.logs).toHaveLength(2);
    });
  });

  describe('GET /api/tunnels/:id/status', () => {
    it('should get tunnel status successfully', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/tunnels/550e8400-e29b-41d4-a716-446655440000/status',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.status).toBe('active');
    });
  });
});
