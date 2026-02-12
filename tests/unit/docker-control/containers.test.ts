import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import Fastify from 'fastify';
import { containerRoutes } from '../../../services/docker-control/src/routes/containers.js';
import * as dockerService from '../../../services/docker-control/src/services/docker.js';
import { mockContainers } from '../../fixtures/data.js';

// Mock the docker service
vi.mock('../../../services/docker-control/src/services/docker.js', () => ({
  getDocker: vi.fn(),
}));

describe('Container Routes', () => {
  let app: FastifyInstance;
  let mockDocker: any;

  beforeEach(async () => {
    app = Fastify();
    await app.register(containerRoutes, { prefix: '/api' });
    vi.clearAllMocks();

    // Setup mock Docker instance
    mockDocker = {
      listContainers: vi.fn(),
      getContainer: vi.fn(),
      pruneContainers: vi.fn(),
      modem: {
        followProgress: vi.fn(),
      },
    };

    vi.mocked(dockerService.getDocker).mockReturnValue(mockDocker);
  });

  describe('GET /api/containers', () => {
    it('should list all containers', async () => {
      mockDocker.listContainers.mockResolvedValue([
        {
          Id: 'container-1',
          Names: ['/nginx-container'],
          Image: 'nginx:latest',
          State: 'running',
          Created: Math.floor(Date.now() / 1000) - 86400,
          Ports: [{ PrivatePort: 80, PublicPort: 8080, IP: '0.0.0.0', Type: 'tcp' }],
          Labels: { app: 'nginx' },
          NetworkSettings: { Networks: { bridge: {} } },
          Command: 'nginx -g daemon off;',
        },
      ]);

      const response = await app.inject({
        method: 'GET',
        url: '/api/containers',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(1);
      expect(body.data[0].name).toBe('nginx-container');
      expect(body.data[0].status).toBe('running');
    });

    it('should list only running containers by default', async () => {
      mockDocker.listContainers.mockResolvedValue([]);

      const response = await app.inject({
        method: 'GET',
        url: '/api/containers',
      });

      expect(response.statusCode).toBe(200);
      expect(mockDocker.listContainers).toHaveBeenCalledWith(
        expect.objectContaining({
          all: false,
        })
      );
    });

    it('should list all containers when all=true', async () => {
      mockDocker.listContainers.mockResolvedValue([]);

      const response = await app.inject({
        method: 'GET',
        url: '/api/containers?all=true',
      });

      expect(response.statusCode).toBe(200);
      expect(mockDocker.listContainers).toHaveBeenCalledWith(
        expect.objectContaining({
          all: true,
        })
      );
    });

    it('should apply limit parameter', async () => {
      mockDocker.listContainers.mockResolvedValue([]);

      const response = await app.inject({
        method: 'GET',
        url: '/api/containers?limit=10',
      });

      expect(response.statusCode).toBe(200);
      expect(mockDocker.listContainers).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 10,
        })
      );
    });

    it('should parse and apply filters', async () => {
      mockDocker.listContainers.mockResolvedValue([]);

      const filters = JSON.stringify({ status: ['running'] });
      const response = await app.inject({
        method: 'GET',
        url: `/api/containers?filters=${encodeURIComponent(filters)}`,
      });

      expect(response.statusCode).toBe(200);
      expect(mockDocker.listContainers).toHaveBeenCalledWith(
        expect.objectContaining({
          filters: { status: ['running'] },
        })
      );
    });

    it('should return 400 for invalid filters JSON', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/containers?filters=invalid-json',
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.payload);
      expect(body.error).toBe('Invalid filters JSON');
    });
  });

  describe('GET /api/containers/:id', () => {
    it('should get container details', async () => {
      const mockContainer = {
        inspect: vi.fn().mockResolvedValue({
          Id: 'container-1',
          Created: new Date().toISOString(),
          Path: 'nginx',
          Args: ['-g', 'daemon off;'],
          State: {
            Status: 'running',
            Running: true,
            Paused: false,
            Restarting: false,
            OomKilled: false,
            Dead: false,
            Pid: 1234,
            ExitCode: 0,
            Error: '',
            StartedAt: new Date().toISOString(),
            FinishedAt: '',
          },
          Image: 'sha256:abc123',
          NetworkSettings: {},
          Mounts: [],
          Config: {
            Hostname: 'container-1',
            Domainname: '',
            User: '',
            AttachStdin: false,
            AttachStdout: true,
            AttachStderr: true,
            Tty: false,
            OpenStdin: false,
            StdinOnce: false,
            Env: [],
            Cmd: ['nginx', '-g', 'daemon off;'],
            Image: 'nginx:latest',
            WorkingDir: '',
            Labels: {},
          },
        }),
      };

      mockDocker.getContainer.mockReturnValue(mockContainer);

      const response = await app.inject({
        method: 'GET',
        url: '/api/containers/container-1',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.data.id).toBe('container-1');
      expect(body.data.state.status).toBe('running');
    });

    it('should return 404 for non-existent container', async () => {
      const mockContainer = {
        inspect: vi.fn().mockRejectedValue(new Error('No such container: xyz')),
      };

      mockDocker.getContainer.mockReturnValue(mockContainer);

      const response = await app.inject({
        method: 'GET',
        url: '/api/containers/xyz',
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.payload);
      expect(body.error).toBe('Container not found');
    });
  });

  describe('POST /api/containers/:id/start', () => {
    it('should start container successfully', async () => {
      const mockContainer = {
        start: vi.fn().mockResolvedValue(undefined),
      };

      mockDocker.getContainer.mockReturnValue(mockContainer);

      const response = await app.inject({
        method: 'POST',
        url: '/api/containers/container-1/start',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.message).toBe('Container started');
    });

    it('should return 404 when container not found', async () => {
      const mockContainer = {
        start: vi.fn().mockRejectedValue(new Error('No such container: xyz')),
      };

      mockDocker.getContainer.mockReturnValue(mockContainer);

      const response = await app.inject({
        method: 'POST',
        url: '/api/containers/xyz/start',
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.payload);
      expect(body.error).toBe('Container not found');
    });
  });

  describe('POST /api/containers/:id/stop', () => {
    it('should stop container successfully', async () => {
      const mockContainer = {
        stop: vi.fn().mockResolvedValue(undefined),
      };

      mockDocker.getContainer.mockReturnValue(mockContainer);

      const response = await app.inject({
        method: 'POST',
        url: '/api/containers/container-1/stop',
        payload: {},
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.message).toBe('Container stopped');
    });

    it('should stop container with timeout', async () => {
      const mockContainer = {
        stop: vi.fn().mockResolvedValue(undefined),
      };

      mockDocker.getContainer.mockReturnValue(mockContainer);

      const response = await app.inject({
        method: 'POST',
        url: '/api/containers/container-1/stop',
        payload: { t: 30 },
      });

      expect(response.statusCode).toBe(200);
      expect(mockContainer.stop).toHaveBeenCalledWith({ t: 30 });
    });

    it('should handle already stopped container', async () => {
      const mockContainer = {
        stop: vi.fn().mockRejectedValue(new Error('container already stopped')),
      };

      mockDocker.getContainer.mockReturnValue(mockContainer);

      const response = await app.inject({
        method: 'POST',
        url: '/api/containers/container-1/stop',
        payload: {},
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.message).toBe('Container already stopped');
    });
  });

  describe('POST /api/containers/:id/restart', () => {
    it('should restart container successfully', async () => {
      const mockContainer = {
        restart: vi.fn().mockResolvedValue(undefined),
      };

      mockDocker.getContainer.mockReturnValue(mockContainer);

      const response = await app.inject({
        method: 'POST',
        url: '/api/containers/container-1/restart',
        payload: {},
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.message).toBe('Container restarted');
    });

    it('should restart container with timeout', async () => {
      const mockContainer = {
        restart: vi.fn().mockResolvedValue(undefined),
      };

      mockDocker.getContainer.mockReturnValue(mockContainer);

      const response = await app.inject({
        method: 'POST',
        url: '/api/containers/container-1/restart',
        payload: { t: 10 },
      });

      expect(response.statusCode).toBe(200);
      expect(mockContainer.restart).toHaveBeenCalledWith({ t: 10 });
    });
  });

  describe('DELETE /api/containers/:id', () => {
    it('should delete container successfully', async () => {
      const mockContainer = {
        remove: vi.fn().mockResolvedValue(undefined),
      };

      mockDocker.getContainer.mockReturnValue(mockContainer);

      const response = await app.inject({
        method: 'DELETE',
        url: '/api/containers/container-1',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.message).toBe('Container removed');
      expect(mockContainer.remove).toHaveBeenCalledWith({ force: true });
    });

    it('should return 404 when container not found', async () => {
      const mockContainer = {
        remove: vi.fn().mockRejectedValue(new Error('No such container: xyz')),
      };

      mockDocker.getContainer.mockReturnValue(mockContainer);

      const response = await app.inject({
        method: 'DELETE',
        url: '/api/containers/xyz',
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('GET /api/containers/:id/logs', () => {
    it('should get container logs', async () => {
      const mockContainer = {
        logs: vi.fn().mockResolvedValue(Buffer.from('Log line 1\nLog line 2')),
      };

      mockDocker.getContainer.mockReturnValue(mockContainer);

      const response = await app.inject({
        method: 'GET',
        url: '/api/containers/container-1/logs',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.data).toContain('Log line 1');
    });

    it('should get logs with tail parameter', async () => {
      const mockContainer = {
        logs: vi.fn().mockResolvedValue(Buffer.from('logs')),
      };

      mockDocker.getContainer.mockReturnValue(mockContainer);

      const response = await app.inject({
        method: 'GET',
        url: '/api/containers/container-1/logs?tail=50',
      });

      expect(response.statusCode).toBe(200);
      expect(mockContainer.logs).toHaveBeenCalledWith(
        expect.objectContaining({
          tail: 50,
        })
      );
    });

    it('should get logs with since parameter', async () => {
      const mockContainer = {
        logs: vi.fn().mockResolvedValue(Buffer.from('logs')),
      };

      mockDocker.getContainer.mockReturnValue(mockContainer);

      const since = Math.floor(Date.now() / 1000) - 3600;
      const response = await app.inject({
        method: 'GET',
        url: `/api/containers/container-1/logs?since=${since}`,
      });

      expect(response.statusCode).toBe(200);
      expect(mockContainer.logs).toHaveBeenCalledWith(
        expect.objectContaining({
          since,
        })
      );
    });
  });

  describe('GET /api/containers/:id/stats', () => {
    it('should get container stats', async () => {
      const mockContainer = {
        stats: vi.fn().mockResolvedValue({
          id: 'container-1',
          name: '/test-container',
          cpu_stats: {
            cpu_usage: {
              total_usage: 1000000000,
              percpu_usage: [500000000, 500000000],
            },
            system_cpu_usage: 5000000000,
          },
          precpu_stats: {
            cpu_usage: {
              total_usage: 900000000,
            },
            system_cpu_usage: 4900000000,
          },
          memory_stats: {
            usage: 104857600,
            limit: 536870912,
          },
          networks: {
            eth0: {
              rx_bytes: 1024000,
              tx_bytes: 512000,
            },
          },
          blkio_stats: {
            io_service_bytes_recursive: [
              { op: 'read', value: 2048000 },
              { op: 'write', value: 1024000 },
            ],
          },
        }),
      };

      mockDocker.getContainer.mockReturnValue(mockContainer);

      const response = await app.inject({
        method: 'GET',
        url: '/api/containers/container-1/stats',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.data).toHaveProperty('cpuPercent');
      expect(body.data).toHaveProperty('memoryUsage');
      expect(body.data).toHaveProperty('memoryPercent');
      expect(body.data).toHaveProperty('networkRx');
      expect(body.data).toHaveProperty('networkTx');
    });
  });

  describe('POST /api/containers/prune', () => {
    it('should prune stopped containers', async () => {
      mockDocker.pruneContainers.mockResolvedValue({
        ContainersDeleted: ['container-1', 'container-2'],
        SpaceReclaimed: 104857600,
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/containers/prune',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.data.containersDeleted).toHaveLength(2);
      expect(body.data.spaceReclaimed).toBe(104857600);
    });
  });
});
