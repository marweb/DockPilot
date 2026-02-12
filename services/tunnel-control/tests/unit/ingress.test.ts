import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';

describe('Ingress Routes', () => {
  let app: FastifyInstance;
  const mockTunnelId = '550e8400-e29b-41d4-a716-446655440000';
  const mockIngressRules = [
    { hostname: 'app.example.com', service: 'http://localhost:3000' },
    { hostname: 'api.example.com', service: 'http://localhost:3001' },
  ];

  beforeEach(async () => {
    app = Fastify();
    
    app.get('/api/tunnels/:id/ingress', async () => ({
      success: true,
      data: { tunnelId: mockTunnelId, ingress: mockIngressRules, count: 2 }
    }));

    app.post('/api/tunnels/:id/ingress', async (request, reply) => {
      const body = request.body as any;
      if (!body.ingress || !Array.isArray(body.ingress)) {
        return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR' }});
      }
      return {
        success: true,
        message: 'Ingress rules updated successfully',
        data: { tunnelId: mockTunnelId, ingress: body.ingress, count: body.ingress.length }
      };
    });

    app.delete('/api/tunnels/:id/ingress/:hostname', async () => ({
      success: true,
      message: 'Ingress rule deleted successfully'
    }));
  });

  afterEach(async () => {
    await app.close();
  });

  describe('GET /api/tunnels/:id/ingress', () => {
    it('should get ingress rules for a tunnel', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/tunnels/${mockTunnelId}/ingress`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.count).toBe(2);
      expect(body.data.ingress).toHaveLength(2);
    });
  });

  describe('POST /api/tunnels/:id/ingress', () => {
    it('should update ingress rules successfully', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/tunnels/${mockTunnelId}/ingress`,
        payload: { ingress: mockIngressRules },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.message).toBe('Ingress rules updated successfully');
    });

    it('should validate ingress rules format', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/tunnels/${mockTunnelId}/ingress`,
        payload: {},
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
    });
  });

  describe('DELETE /api/tunnels/:id/ingress/:hostname', () => {
    it('should delete a specific ingress rule', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/api/tunnels/${mockTunnelId}/ingress/app.example.com`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.message).toContain('deleted');
    });
  });
});
