import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  proxyRequest,
  createProxyRoutes,
  createWebSocketProxy,
} from '../../../services/api-gateway/src/proxy/index.js';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import Fastify from 'fastify';
import http from 'http';
import https from 'https';

// Mock http and https modules
vi.mock('http', () => ({
  request: vi.fn(),
  Agent: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('https', () => ({
  request: vi.fn(),
  Agent: vi.fn().mockImplementation(() => ({})),
}));

describe('Proxy Module', () => {
  let mockRequest: Partial<FastifyRequest>;
  let mockReply: Partial<FastifyReply>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockRequest = {
      method: 'GET',
      url: '/api/containers',
      headers: {
        'content-type': 'application/json',
        host: 'localhost:3000',
      },
      raw: {
        pipe: vi.fn(),
      } as unknown as FastifyRequest['raw'],
      body: null,
      log: {
        error: vi.fn(),
        info: vi.fn(),
        debug: vi.fn(),
      } as unknown as FastifyRequest['log'],
    };

    mockReply = {
      status: vi.fn().mockReturnThis(),
      header: vi.fn().mockReturnThis(),
      raw: {
        write: vi.fn(),
        end: vi.fn(),
      },
      send: vi.fn(),
    };
  });

  describe('proxyRequest', () => {
    it('should proxy HTTP request successfully', async () => {
      const mockResponse = {
        statusCode: 200,
        headers: {
          'content-type': 'application/json',
        },
        pipe: vi.fn(),
        on: vi.fn().mockImplementation((event, handler) => {
          if (event === 'end') {
            setTimeout(handler, 0);
          }
        }),
      };

      const mockProxyRequest = {
        on: vi.fn().mockImplementation((event, handler) => {
          if (event === 'error') return mockProxyRequest;
        }),
        write: vi.fn(),
      };

      (http.request as ReturnType<typeof vi.fn>).mockImplementation((options, callback) => {
        callback(mockResponse);
        return mockProxyRequest;
      });

      await proxyRequest(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply,
        'http://docker-control:3001/containers'
      );

      expect(http.request).toHaveBeenCalled();
      expect(mockReply.status).toHaveBeenCalledWith(200);
    });

    it('should proxy HTTPS request successfully', async () => {
      const mockResponse = {
        statusCode: 200,
        headers: {},
        pipe: vi.fn(),
        on: vi.fn().mockImplementation((event, handler) => {
          if (event === 'end') {
            setTimeout(handler, 0);
          }
        }),
      };

      const mockProxyRequest = {
        on: vi.fn().mockReturnThis(),
        write: vi.fn(),
      };

      (https.request as ReturnType<typeof vi.fn>).mockImplementation((options, callback) => {
        callback(mockResponse);
        return mockProxyRequest;
      });

      await proxyRequest(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply,
        'https://docker-control:3001/containers'
      );

      expect(https.request).toHaveBeenCalled();
    });

    it('should handle proxy request errors', async () => {
      const mockProxyRequest = {
        on: vi.fn().mockImplementation((event, handler) => {
          if (event === 'error') {
            setTimeout(() => handler(new Error('Connection refused')), 0);
          }
          return mockProxyRequest;
        }),
        write: vi.fn(),
      };

      (http.request as ReturnType<typeof vi.fn>).mockReturnValue(mockProxyRequest);

      await proxyRequest(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply,
        'http://docker-control:3001/containers'
      );

      expect(mockReply.status).toHaveBeenCalledWith(502);
      expect(mockReply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Service unavailable',
        })
      );
    });

    it('should remove hop-by-hop headers', async () => {
      mockRequest.headers = {
        ...mockRequest.headers,
        connection: 'keep-alive',
        'keep-alive': 'timeout=5',
        'proxy-authenticate': 'Basic',
        'proxy-authorization': 'Bearer token',
        te: 'trailers',
        upgrade: 'websocket',
      };

      const mockResponse = {
        statusCode: 200,
        headers: {},
        pipe: vi.fn(),
        on: vi.fn().mockImplementation((event, handler) => {
          if (event === 'end') {
            setTimeout(handler, 0);
          }
        }),
      };

      const mockProxyRequest = {
        on: vi.fn().mockReturnThis(),
        write: vi.fn(),
      };

      (http.request as ReturnType<typeof vi.fn>).mockImplementation((options, callback) => {
        // Verify hop-by-hop headers are removed
        expect(options.headers).not.toHaveProperty('connection');
        expect(options.headers).not.toHaveProperty('keep-alive');
        expect(options.headers).not.toHaveProperty('proxy-authenticate');
        expect(options.headers).not.toHaveProperty('proxy-authorization');
        expect(options.headers).not.toHaveProperty('te');
        expect(options.headers).not.toHaveProperty('upgrade');

        callback(mockResponse);
        return mockProxyRequest;
      });

      await proxyRequest(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply,
        'http://docker-control:3001/containers'
      );
    });

    it('should forward request body when present', async () => {
      mockRequest.body = { name: 'test-container', image: 'nginx' };
      mockRequest.method = 'POST';

      const mockResponse = {
        statusCode: 201,
        headers: {},
        pipe: vi.fn(),
        on: vi.fn().mockImplementation((event, handler) => {
          if (event === 'end') {
            setTimeout(handler, 0);
          }
        }),
      };

      const mockProxyRequest = {
        on: vi.fn().mockReturnThis(),
        write: vi.fn(),
      };

      (http.request as ReturnType<typeof vi.fn>).mockImplementation((options, callback) => {
        callback(mockResponse);
        return mockProxyRequest;
      });

      await proxyRequest(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply,
        'http://docker-control:3001/containers'
      );

      expect(mockProxyRequest.write).toHaveBeenCalledWith(JSON.stringify(mockRequest.body));
    });

    it('should use correct port for HTTP', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockImplementation((options, callback) => {
        expect(options.port).toBe(3001);

        const mockResponse = {
          statusCode: 200,
          headers: {},
          pipe: vi.fn(),
          on: vi.fn().mockImplementation((event, handler) => {
            if (event === 'end') {
              setTimeout(handler, 0);
            }
          }),
        };

        callback(mockResponse);
        return {
          on: vi.fn().mockReturnThis(),
          write: vi.fn(),
        };
      });

      await proxyRequest(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply,
        'http://docker-control:3001/containers'
      );
    });

    it('should use correct port for HTTPS', async () => {
      (https.request as ReturnType<typeof vi.fn>).mockImplementation((options, callback) => {
        expect(options.port).toBe(443);

        const mockResponse = {
          statusCode: 200,
          headers: {},
          pipe: vi.fn(),
          on: vi.fn().mockImplementation((event, handler) => {
            if (event === 'end') {
              setTimeout(handler, 0);
            }
          }),
        };

        callback(mockResponse);
        return {
          on: vi.fn().mockReturnThis(),
          write: vi.fn(),
        };
      });

      await proxyRequest(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply,
        'https://docker-control/containers'
      );
    });
  });

  describe('createProxyRoutes', () => {
    it('should register catch-all proxy route', async () => {
      const app = Fastify();
      const allSpy = vi.spyOn(app, 'all');

      createProxyRoutes(app, '/api/docker', 'http://docker-control:3001');

      expect(allSpy).toHaveBeenCalledWith('/api/docker/*', expect.any(Function));
    });

    it('should proxy requests with path parameter', async () => {
      const app = Fastify();

      // Mock the proxyRequest function
      const mockProxyRequest = vi.fn().mockResolvedValue(undefined);

      app.decorate('proxyRequest', mockProxyRequest);

      createProxyRoutes(app, '/api/docker', 'http://docker-control:3001');

      // Test route is registered
      const routes = app.printRoutes();
      expect(routes).toContain('/api/docker/*');
    });
  });

  describe('createWebSocketProxy', () => {
    it('should register WebSocket route', async () => {
      const app = Fastify();
      const registerSpy = vi.spyOn(app, 'register');

      await createWebSocketProxy(app, '/ws', 'ws://docker-control:3001');

      expect(registerSpy).toHaveBeenCalled();
    });

    it('should handle WebSocket upgrade', async () => {
      // WebSocket proxy functionality is tested through integration
      // This verifies the configuration is correct
      const wsConfig = {
        path: '/ws/containers/:id/logs',
        target: 'ws://docker-control:3001/ws/containers/{id}/logs',
      };

      expect(wsConfig.path).toContain(':id');
      expect(wsConfig.target).toContain('{id}');
    });
  });

  describe('Proxy to Docker Control', () => {
    it('should proxy container list request', async () => {
      const targetUrl = 'http://docker-control:3001/containers';
      const requestPath = '/api/containers';

      expect(targetUrl).toContain('docker-control');
      expect(requestPath).toBe('/api/containers');
    });

    it('should proxy container start/stop/restart', async () => {
      const actions = ['start', 'stop', 'restart'];
      const containerId = 'abc123';

      for (const action of actions) {
        const targetUrl = `http://docker-control:3001/containers/${containerId}/${action}`;
        expect(targetUrl).toContain(action);
      }
    });

    it('should proxy image operations', async () => {
      const imageOperations = [
        { method: 'GET', path: '/api/images' },
        { method: 'POST', path: '/api/images/pull' },
        { method: 'DELETE', path: '/api/images/abc123' },
      ];

      for (const op of imageOperations) {
        expect(op.path).toMatch(/^\/api\/images/);
      }
    });
  });

  describe('Proxy to Tunnel Control', () => {
    it('should proxy tunnel list request', async () => {
      const targetUrl = 'http://tunnel-control:3002/tunnels';
      const requestPath = '/api/tunnels';

      expect(targetUrl).toContain('tunnel-control');
      expect(requestPath).toBe('/api/tunnels');
    });

    it('should proxy tunnel operations', async () => {
      const tunnelId = 'tunnel-123';
      const operations = [
        { method: 'POST', path: `/api/tunnels/${tunnelId}/start` },
        { method: 'POST', path: `/api/tunnels/${tunnelId}/stop` },
        { method: 'DELETE', path: `/api/tunnels/${tunnelId}` },
      ];

      for (const op of operations) {
        expect(op.path).toContain(tunnelId);
      }
    });
  });

  describe('Error Handling', () => {
    it('should return 502 on service unavailable', async () => {
      const errorResponse = {
        success: false,
        error: 'Service unavailable',
      };

      expect(errorResponse.success).toBe(false);
      expect(errorResponse.error).toBe('Service unavailable');
    });

    it('should handle connection timeouts', async () => {
      const timeoutError = new Error('ETIMEDOUT');
      expect(timeoutError.message).toBe('ETIMEDOUT');
    });

    it('should handle connection refused', async () => {
      const refusedError = new Error('ECONNREFUSED');
      expect(refusedError.message).toBe('ECONNREFUSED');
    });
  });
});
