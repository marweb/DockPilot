import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  initCloudflareAPI,
  authenticate,
  listTunnels,
  createTunnel,
  deleteTunnel,
  getTunnel,
  getTunnelToken,
  getAccountInfo,
  isAuthenticated,
  getCurrentAccountId,
  clearAuthentication,
  CloudflareAPIError,
} from '../../../services/tunnel-control/src/services/cloudflare-api.js';
import type { Config } from '../../../services/tunnel-control/src/config/index.js';

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

const mockConfig: Config = {
  port: 3002,
  host: '0.0.0.0',
  cloudflaredPath: '/usr/local/bin/cloudflared',
  credentialsDir: '/tmp/test-tunnels',
  logLevel: 'info',
  maxRestarts: 3,
  restartDelay: 5000,
  cloudflareApiUrl: 'https://api.cloudflare.com/client/v4',
  logMaxSize: '10m',
  logMaxFiles: 5,
};

describe('Cloudflare API Service', () => {
  beforeEach(() => {
    initCloudflareAPI(mockConfig);
    clearAuthentication();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('authenticate', () => {
    it('should authenticate successfully with valid token', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          success: true,
          result: { id: '12345678901234567890123456789012', name: 'Test Account' },
        }),
      };
      mockFetch.mockResolvedValue(mockResponse);

      await authenticate('valid-token', '12345678901234567890123456789012');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.cloudflare.com/client/v4/accounts/12345678901234567890123456789012',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer valid-token',
          }),
        })
      );
      expect(isAuthenticated()).toBe(true);
      expect(getCurrentAccountId()).toBe('12345678901234567890123456789012');
    });

    it('should throw CloudflareAPIError on authentication failure', async () => {
      const mockResponse = {
        ok: false,
        status: 401,
        json: vi.fn().mockResolvedValue({
          success: false,
          errors: [{ code: 10000, message: 'Invalid API token' }],
        }),
      };
      mockFetch.mockResolvedValue(mockResponse);

      await expect(
        authenticate('invalid-token', '12345678901234567890123456789012')
      ).rejects.toThrow(CloudflareAPIError);

      expect(isAuthenticated()).toBe(false);
    });

    it('should throw error with status code on HTTP error', async () => {
      const mockResponse = {
        ok: false,
        status: 403,
        json: vi.fn().mockResolvedValue({
          success: false,
          errors: [{ code: 10001, message: 'Forbidden' }],
        }),
      };
      mockFetch.mockResolvedValue(mockResponse);

      try {
        await authenticate('token', '12345678901234567890123456789012');
        fail('Should have thrown error');
      } catch (error) {
        expect(error).toBeInstanceOf(CloudflareAPIError);
        expect((error as CloudflareAPIError).statusCode).toBe(403);
        expect((error as CloudflareAPIError).code).toBe(10001);
      }
    });
  });

  describe('listTunnels', () => {
    beforeEach(async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          success: true,
          result: { id: '12345678901234567890123456789012', name: 'Test Account' },
        }),
      };
      mockFetch.mockResolvedValue(mockResponse);
      await authenticate('valid-token', '12345678901234567890123456789012');
      mockFetch.mockClear();
    });

    it('should list tunnels successfully', async () => {
      const mockTunnels = [
        {
          id: 'tunnel-1',
          name: 'Tunnel One',
          account_tag: '12345678901234567890123456789012',
          created_at: '2024-01-01T00:00:00Z',
          deleted_at: null,
          connections: [],
          conns_active_at: null,
          conns_inactive_at: null,
          tun_type: 'cfd_tunnel',
          status: 'active',
          remote_config: false,
          version: '2024.1.0',
        },
      ];

      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          success: true,
          result: mockTunnels,
        }),
      };
      mockFetch.mockResolvedValue(mockResponse);

      const tunnels = await listTunnels('12345678901234567890123456789012');

      expect(tunnels).toHaveLength(1);
      expect(tunnels[0].name).toBe('Tunnel One');
    });

    it('should throw error when not authenticated', async () => {
      clearAuthentication();

      await expect(listTunnels('12345678901234567890123456789012')).rejects.toThrow(
        'Not authenticated'
      );
    });

    it('should handle API errors', async () => {
      const mockResponse = {
        ok: false,
        status: 500,
        json: vi.fn().mockResolvedValue({
          success: false,
          errors: [{ code: 500, message: 'Internal server error' }],
        }),
      };
      mockFetch.mockResolvedValue(mockResponse);

      await expect(listTunnels('12345678901234567890123456789012')).rejects.toThrow(
        CloudflareAPIError
      );
    });
  });

  describe('createTunnel', () => {
    beforeEach(async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          success: true,
          result: { id: '12345678901234567890123456789012', name: 'Test Account' },
        }),
      };
      mockFetch.mockResolvedValue(mockResponse);
      await authenticate('valid-token', '12345678901234567890123456789012');
      mockFetch.mockClear();
    });

    it('should create tunnel successfully', async () => {
      const mockTunnel = {
        id: 'new-tunnel-id',
        name: 'New Tunnel',
        account_tag: '12345678901234567890123456789012',
        created_at: '2024-01-01T00:00:00Z',
        deleted_at: null,
        connections: [],
        conns_active_at: null,
        conns_inactive_at: null,
        tun_type: 'cfd_tunnel',
        status: 'inactive',
        remote_config: false,
        version: '2024.1.0',
      };

      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          success: true,
          result: mockTunnel,
        }),
      };
      mockFetch.mockResolvedValue(mockResponse);

      const tunnel = await createTunnel('New Tunnel', '12345678901234567890123456789012');

      expect(tunnel.name).toBe('New Tunnel');
    });

    it('should handle conflict error (tunnel already exists)', async () => {
      const mockResponse = {
        ok: false,
        status: 409,
        json: vi.fn().mockResolvedValue({
          success: false,
          errors: [{ code: 1001, message: 'Tunnel with this name already exists' }],
        }),
      };
      mockFetch.mockResolvedValue(mockResponse);

      await expect(
        createTunnel('Existing Tunnel', '12345678901234567890123456789012')
      ).rejects.toThrow(CloudflareAPIError);
    });
  });

  describe('deleteTunnel', () => {
    beforeEach(async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          success: true,
          result: { id: '12345678901234567890123456789012', name: 'Test Account' },
        }),
      };
      mockFetch.mockResolvedValue(mockResponse);
      await authenticate('valid-token', '12345678901234567890123456789012');
      mockFetch.mockClear();
    });

    it('should delete tunnel successfully', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({ success: true }),
      };
      mockFetch.mockResolvedValue(mockResponse);

      await deleteTunnel('tunnel-id', '12345678901234567890123456789012');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.cloudflare.com/client/v4/accounts/12345678901234567890123456789012/cfd_tunnel/tunnel-id',
        expect.objectContaining({
          method: 'DELETE',
        })
      );
    });

    it('should handle not found error', async () => {
      const mockResponse = {
        ok: false,
        status: 404,
        json: vi.fn().mockResolvedValue({
          success: false,
          errors: [{ code: 1000, message: 'Tunnel not found' }],
        }),
      };
      mockFetch.mockResolvedValue(mockResponse);

      await expect(
        deleteTunnel('non-existent', '12345678901234567890123456789012')
      ).rejects.toThrow(CloudflareAPIError);
    });
  });

  describe('getTunnel', () => {
    beforeEach(async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          success: true,
          result: { id: '12345678901234567890123456789012', name: 'Test Account' },
        }),
      };
      mockFetch.mockResolvedValue(mockResponse);
      await authenticate('valid-token', '12345678901234567890123456789012');
      mockFetch.mockClear();
    });

    it('should get tunnel details successfully', async () => {
      const mockTunnel = {
        id: 'tunnel-id',
        name: 'Test Tunnel',
        account_tag: '12345678901234567890123456789012',
        created_at: '2024-01-01T00:00:00Z',
        deleted_at: null,
        connections: [
          {
            id: 'conn-1',
            connected_at: '2024-01-01T00:00:00Z',
            disconnected_at: null,
            origin_ip: '192.168.1.1',
            opened_by: 'cloudflared',
          },
        ],
        conns_active_at: '2024-01-01T00:00:00Z',
        conns_inactive_at: null,
        tun_type: 'cfd_tunnel',
        status: 'active',
        remote_config: false,
        version: '2024.1.0',
      };

      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          success: true,
          result: mockTunnel,
        }),
      };
      mockFetch.mockResolvedValue(mockResponse);

      const tunnel = await getTunnel('tunnel-id', '12345678901234567890123456789012');

      expect(tunnel.id).toBe('tunnel-id');
      expect(tunnel.connections).toHaveLength(1);
    });
  });

  describe('getTunnelToken', () => {
    beforeEach(async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          success: true,
          result: { id: '12345678901234567890123456789012', name: 'Test Account' },
        }),
      };
      mockFetch.mockResolvedValue(mockResponse);
      await authenticate('valid-token', '12345678901234567890123456789012');
      mockFetch.mockClear();
    });

    it('should get tunnel token successfully', async () => {
      const credentials = {
        AccountTag: '12345678901234567890123456789012',
        TunnelSecret: 'base64-secret',
        TunnelID: 'tunnel-id',
        TunnelName: 'Test Tunnel',
      };

      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          success: true,
          result: Buffer.from(JSON.stringify(credentials)).toString('base64'),
        }),
      };
      mockFetch.mockResolvedValue(mockResponse);

      const token = await getTunnelToken('tunnel-id', '12345678901234567890123456789012');

      expect(token.TunnelID).toBe('tunnel-id');
      expect(token.AccountTag).toBe('12345678901234567890123456789012');
    });
  });

  describe('getAccountInfo', () => {
    beforeEach(async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          success: true,
          result: { id: '12345678901234567890123456789012', name: 'Test Account' },
        }),
      };
      mockFetch.mockResolvedValue(mockResponse);
      await authenticate('valid-token', '12345678901234567890123456789012');
      mockFetch.mockClear();
    });

    it('should get account info successfully', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          success: true,
          result: { id: '12345678901234567890123456789012', name: 'Test Account' },
        }),
      };
      mockFetch.mockResolvedValue(mockResponse);

      const account = await getAccountInfo('12345678901234567890123456789012');

      expect(account.id).toBe('12345678901234567890123456789012');
      expect(account.name).toBe('Test Account');
    });
  });

  describe('rate limiting', () => {
    beforeEach(async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          success: true,
          result: { id: '12345678901234567890123456789012', name: 'Test Account' },
        }),
      };
      mockFetch.mockResolvedValue(mockResponse);
      await authenticate('valid-token', '12345678901234567890123456789012');
      mockFetch.mockClear();
    });

    it('should enforce rate limits', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          success: true,
          result: [],
        }),
      };
      mockFetch.mockResolvedValue(mockResponse);

      // Make many requests rapidly
      const promises = [];
      for (let i = 0; i < 105; i++) {
        promises.push(listTunnels('12345678901234567890123456789012'));
      }

      // Should throw rate limit error
      await expect(Promise.all(promises)).rejects.toThrow('Rate limit exceeded');
    });
  });

  describe('retries on temporary failures', () => {
    beforeEach(async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          success: true,
          result: { id: '12345678901234567890123456789012', name: 'Test Account' },
        }),
      };
      mockFetch.mockResolvedValue(mockResponse);
      await authenticate('valid-token', '12345678901234567890123456789012');
      mockFetch.mockClear();
    });

    it('should handle 5xx errors', async () => {
      const mockResponse = {
        ok: false,
        status: 503,
        json: vi.fn().mockResolvedValue({
          success: false,
          errors: [{ code: 503, message: 'Service temporarily unavailable' }],
        }),
      };
      mockFetch.mockResolvedValue(mockResponse);

      try {
        await listTunnels('12345678901234567890123456789012');
        fail('Should have thrown error');
      } catch (error) {
        expect(error).toBeInstanceOf(CloudflareAPIError);
        expect((error as CloudflareAPIError).statusCode).toBe(503);
      }
    });

    it('should handle rate limit errors', async () => {
      const mockResponse = {
        ok: false,
        status: 429,
        json: vi.fn().mockResolvedValue({
          success: false,
          errors: [{ code: 10001, message: 'Rate limit exceeded' }],
        }),
      };
      mockFetch.mockResolvedValue(mockResponse);

      try {
        await listTunnels('12345678901234567890123456789012');
        fail('Should have thrown error');
      } catch (error) {
        expect(error).toBeInstanceOf(CloudflareAPIError);
        expect((error as CloudflareAPIError).statusCode).toBe(429);
      }
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(listTunnels('12345678901234567890123456789012')).rejects.toThrow();
    });

    it('should parse error responses correctly', async () => {
      const mockResponse = {
        ok: false,
        status: 400,
        json: vi.fn().mockResolvedValue({
          success: false,
          errors: [
            {
              code: 1004,
              message: 'Invalid tunnel name',
              error_chain: [{ code: 1005, message: 'Name contains invalid characters' }],
            },
          ],
        }),
      };
      mockFetch.mockResolvedValue(mockResponse);

      try {
        await createTunnel('Invalid@Name', '12345678901234567890123456789012');
        fail('Should have thrown error');
      } catch (error) {
        expect(error).toBeInstanceOf(CloudflareAPIError);
        expect((error as CloudflareAPIError).message).toContain('Invalid tunnel name');
      }
    });
  });

  describe('authentication state', () => {
    it('should return false when not authenticated', () => {
      expect(isAuthenticated()).toBe(false);
      expect(getCurrentAccountId()).toBeNull();
    });

    it('should clear authentication', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          success: true,
          result: { id: '12345678901234567890123456789012', name: 'Test Account' },
        }),
      };
      mockFetch.mockResolvedValue(mockResponse);

      await authenticate('valid-token', '12345678901234567890123456789012');
      expect(isAuthenticated()).toBe(true);

      clearAuthentication();
      expect(isAuthenticated()).toBe(false);
      expect(getCurrentAccountId()).toBeNull();
    });
  });
});
