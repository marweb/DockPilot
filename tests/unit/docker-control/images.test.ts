import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import Fastify from 'fastify';
import { imageRoutes } from '../../../services/docker-control/src/routes/images.js';
import * as dockerService from '../../../services/docker-control/src/services/docker.js';
import { mockImages } from '../../fixtures/data.js';

// Mock the docker service
vi.mock('../../../services/docker-control/src/services/docker.js', () => ({
  getDocker: vi.fn(),
}));

describe('Image Routes', () => {
  let app: FastifyInstance;
  let mockDocker: any;

  beforeEach(async () => {
    app = Fastify();
    await app.register(imageRoutes, { prefix: '/api' });
    vi.clearAllMocks();

    // Setup mock Docker instance
    mockDocker = {
      listImages: vi.fn(),
      getImage: vi.fn(),
      pull: vi.fn(),
      pruneImages: vi.fn(),
      modem: {
        followProgress: vi.fn(),
      },
    };

    vi.mocked(dockerService.getDocker).mockReturnValue(mockDocker);
  });

  describe('GET /api/images', () => {
    it('should list all images', async () => {
      mockDocker.listImages.mockResolvedValue([
        {
          Id: 'sha256:abc123def456',
          RepoTags: ['nginx:latest'],
          Size: 142000000,
          Created: Math.floor(Date.now() / 1000) - 604800,
          Labels: {},
          Containers: 1,
        },
        {
          Id: 'sha256:def789abc012',
          RepoTags: ['redis:alpine'],
          Size: 32000000,
          Created: Math.floor(Date.now() / 1000) - 1209600,
          Labels: {},
          Containers: 0,
        },
      ]);

      const response = await app.inject({
        method: 'GET',
        url: '/api/images',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(2);
      expect(body.data[0].repository).toBe('nginx');
      expect(body.data[0].tag).toBe('latest');
      expect(body.data[1].repository).toBe('redis');
      expect(body.data[1].tag).toBe('alpine');
    });

    it('should handle images without tags', async () => {
      mockDocker.listImages.mockResolvedValue([
        {
          Id: 'sha256:abc123',
          RepoTags: ['<none>:<none>'],
          Size: 10000000,
          Created: Math.floor(Date.now() / 1000),
          Labels: {},
          Containers: 0,
        },
      ]);

      const response = await app.inject({
        method: 'GET',
        url: '/api/images',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.data[0].repository).toBe('<none>');
      expect(body.data[0].tag).toBe('<none>');
    });

    it('should extract short image ID', async () => {
      mockDocker.listImages.mockResolvedValue([
        {
          Id: 'sha256:abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
          RepoTags: ['test:latest'],
          Size: 1000000,
          Created: Math.floor(Date.now() / 1000),
          Labels: {},
          Containers: 0,
        },
      ]);

      const response = await app.inject({
        method: 'GET',
        url: '/api/images',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.data[0].id).toHaveLength(12);
      expect(body.data[0].id).toBe('abcdef123456');
    });

    it('should handle empty image list', async () => {
      mockDocker.listImages.mockResolvedValue([]);

      const response = await app.inject({
        method: 'GET',
        url: '/api/images',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.data).toHaveLength(0);
    });
  });

  describe('GET /api/images/:id', () => {
    it('should get image details', async () => {
      const mockImage = {
        inspect: vi.fn().mockResolvedValue({
          Id: 'sha256:abc123def456',
          RepoTags: ['nginx:latest', 'nginx:1.21'],
          RepoDigests: ['nginx@sha256:digest123'],
          Created: new Date().toISOString(),
          Size: 142000000,
          VirtualSize: 142000000,
          Architecture: 'amd64',
          Os: 'linux',
          Author: '',
          Config: {
            Hostname: '',
            Domainname: '',
            User: '',
            AttachStdin: false,
            AttachStdout: false,
            AttachStderr: false,
            ExposedPorts: { '80/tcp': {} },
            Tty: false,
            OpenStdin: false,
            StdinOnce: false,
            Env: ['PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin'],
            Cmd: ['nginx', '-g', 'daemon off;'],
            Image: '',
            WorkingDir: '',
            Labels: {},
          },
          RootFS: {
            Type: 'layers',
            Layers: ['sha256:layer1', 'sha256:layer2'],
          },
        }),
      };

      mockDocker.getImage.mockReturnValue(mockImage);

      const response = await app.inject({
        method: 'GET',
        url: '/api/images/abc123',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.data.repoTags).toHaveLength(2);
      expect(body.data.config).toBeDefined();
      expect(body.data.rootFS).toBeDefined();
    });

    it('should return 404 for non-existent image', async () => {
      const mockImage = {
        inspect: vi.fn().mockRejectedValue(new Error('No such image: xyz')),
      };

      mockDocker.getImage.mockReturnValue(mockImage);

      const response = await app.inject({
        method: 'GET',
        url: '/api/images/xyz',
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.payload);
      expect(body.error).toBe('Image not found');
    });
  });

  describe('POST /api/images/pull', () => {
    it('should pull image successfully', async () => {
      const mockStream = {
        on: vi.fn().mockImplementation((event, handler) => {
          if (event === 'end') {
            setTimeout(handler, 0);
          }
          return mockStream;
        }),
      };

      mockDocker.pull.mockResolvedValue(mockStream);
      mockDocker.modem.followProgress.mockImplementation((stream, callback) => {
        callback(null);
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/images/pull',
        payload: {
          fromImage: 'nginx',
          tag: 'latest',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.message).toContain('nginx:latest pulled successfully');
    });

    it('should use default tag "latest"', async () => {
      const mockStream = {
        on: vi.fn().mockReturnThis(),
      };

      mockDocker.pull.mockResolvedValue(mockStream);
      mockDocker.modem.followProgress.mockImplementation((stream, callback) => {
        callback(null);
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/images/pull',
        payload: {
          fromImage: 'redis',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(mockDocker.pull).toHaveBeenCalledWith('redis:latest', { platform: undefined });
    });

    it('should pull with specific platform', async () => {
      const mockStream = {
        on: vi.fn().mockReturnThis(),
      };

      mockDocker.pull.mockResolvedValue(mockStream);
      mockDocker.modem.followProgress.mockImplementation((stream, callback) => {
        callback(null);
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/images/pull',
        payload: {
          fromImage: 'nginx',
          tag: 'alpine',
          platform: 'linux/amd64',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(mockDocker.pull).toHaveBeenCalledWith('nginx:alpine', { platform: 'linux/amd64' });
    });

    it('should handle pull errors', async () => {
      mockDocker.pull.mockRejectedValue(new Error('repository not found'));

      const response = await app.inject({
        method: 'POST',
        url: '/api/images/pull',
        payload: {
          fromImage: 'nonexistent',
          tag: 'latest',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.payload);
      expect(body.error).toBe('repository not found');
    });

    it('should require fromImage parameter', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/images/pull',
        payload: {},
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('POST /api/images/:id/tag', () => {
    it('should tag image successfully', async () => {
      const mockImage = {
        tag: vi.fn().mockResolvedValue(undefined),
      };

      mockDocker.getImage.mockReturnValue(mockImage);

      const response = await app.inject({
        method: 'POST',
        url: '/api/images/abc123/tag',
        payload: {
          repo: 'myregistry/nginx',
          tag: 'v1.0',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(mockImage.tag).toHaveBeenCalledWith({ repo: 'myregistry/nginx', tag: 'v1.0' });
    });

    it('should tag with optional tag parameter', async () => {
      const mockImage = {
        tag: vi.fn().mockResolvedValue(undefined),
      };

      mockDocker.getImage.mockReturnValue(mockImage);

      const response = await app.inject({
        method: 'POST',
        url: '/api/images/abc123/tag',
        payload: {
          repo: 'myrepo/image',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(mockImage.tag).toHaveBeenCalledWith({ repo: 'myrepo/image', tag: undefined });
    });

    it('should return 404 for non-existent image', async () => {
      const mockImage = {
        tag: vi.fn().mockRejectedValue(new Error('No such image: xyz')),
      };

      mockDocker.getImage.mockReturnValue(mockImage);

      const response = await app.inject({
        method: 'POST',
        url: '/api/images/xyz/tag',
        payload: {
          repo: 'test',
        },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('DELETE /api/images/:id', () => {
    it('should delete image successfully', async () => {
      const mockImage = {
        remove: vi.fn().mockResolvedValue({
          Untagged: ['nginx:latest'],
          Deleted: ['sha256:abc123'],
        }),
      };

      mockDocker.getImage.mockReturnValue(mockImage);

      const response = await app.inject({
        method: 'DELETE',
        url: '/api/images/abc123',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.data.untagged).toHaveLength(1);
      expect(body.data.deleted).toHaveLength(1);
      expect(mockImage.remove).toHaveBeenCalledWith({ force: true });
    });

    it('should return 404 for non-existent image', async () => {
      const mockImage = {
        remove: vi.fn().mockRejectedValue(new Error('No such image: xyz')),
      };

      mockDocker.getImage.mockReturnValue(mockImage);

      const response = await app.inject({
        method: 'DELETE',
        url: '/api/images/xyz',
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 409 when image is in use', async () => {
      const mockImage = {
        remove: vi.fn().mockRejectedValue(new Error('image is being used by running container')),
      };

      mockDocker.getImage.mockReturnValue(mockImage);

      const response = await app.inject({
        method: 'DELETE',
        url: '/api/images/abc123',
      });

      expect(response.statusCode).toBe(409);
      const body = JSON.parse(response.payload);
      expect(body.error).toBe('Image is being used by a container');
    });
  });

  describe('GET /api/images/:id/history', () => {
    it('should get image history', async () => {
      const mockImage = {
        history: vi.fn().mockResolvedValue([
          {
            Id: 'sha256:layer1',
            Created: Math.floor(Date.now() / 1000) - 86400,
            CreatedBy: '/bin/sh -c #(nop) CMD ["nginx" "-g" "daemon off;"]',
            Size: 0,
            Comment: '',
          },
          {
            Id: 'sha256:layer2',
            Created: Math.floor(Date.now() / 1000) - 86400,
            CreatedBy: '/bin/sh -c apt-get update && apt-get install -y nginx',
            Size: 50000000,
            Comment: '',
          },
        ]),
      };

      mockDocker.getImage.mockReturnValue(mockImage);

      const response = await app.inject({
        method: 'GET',
        url: '/api/images/abc123/history',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(2);
      expect(body.data[0]).toHaveProperty('createdBy');
      expect(body.data[0]).toHaveProperty('size');
    });

    it('should return 404 for non-existent image', async () => {
      const mockImage = {
        history: vi.fn().mockRejectedValue(new Error('No such image: xyz')),
      };

      mockDocker.getImage.mockReturnValue(mockImage);

      const response = await app.inject({
        method: 'GET',
        url: '/api/images/xyz/history',
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('POST /api/images/prune', () => {
    it('should prune unused images', async () => {
      mockDocker.pruneImages.mockResolvedValue({
        ImagesDeleted: [{ Untagged: 'old-image:1.0' }, { Deleted: 'sha256:abc123' }],
        SpaceReclaimed: 1073741824,
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/images/prune',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.data.imagesDeleted).toHaveLength(2);
      expect(body.data.spaceReclaimed).toBe(1073741824);
    });

    it('should handle empty prune result', async () => {
      mockDocker.pruneImages.mockResolvedValue({
        ImagesDeleted: [],
        SpaceReclaimed: 0,
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/images/prune',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.data.imagesDeleted).toHaveLength(0);
      expect(body.data.spaceReclaimed).toBe(0);
    });
  });
});
