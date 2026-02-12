import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';
import type { ChildProcess } from 'child_process';
import {
  initCloudflared,
  listTunnels,
  createTunnel,
  getTunnel,
  deleteTunnel,
  startTunnel,
  stopTunnel,
  getTunnelStatus,
  getTunnelLogs,
  updateIngressRules,
  getIngressRules,
  deleteIngressRule,
  checkCloudflaredInstalled,
  getCloudflaredVersion,
  streamTunnelLogs,
  loginWithCloudflare,
  checkAuthStatus,
  logout,
} from '../../../services/tunnel-control/src/services/cloudflared.js';
import type { Config } from '../../../services/tunnel-control/src/config/index.js';

// Mock child_process
vi.mock('child_process', () => ({
  spawn: vi.fn(),
}));

// Mock fs/promises
vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  mkdir: vi.fn(),
  rm: vi.fn(),
  readdir: vi.fn(),
}));

// Mock fs
vi.mock('fs', () => ({
  existsSync: vi.fn(),
}));

// Mock credentials service
vi.mock('../../../services/tunnel-control/src/services/credentials.js', () => ({
  loadCredentials: vi.fn(),
  getDefaultAccount: vi.fn(),
}));

// Import mocked modules
import { spawn } from 'child_process';
import { readFile, writeFile, mkdir, rm, readdir } from 'fs/promises';
import { existsSync } from 'fs';
import {
  loadCredentials,
  getDefaultAccount,
} from '../../../services/tunnel-control/src/services/credentials.js';

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

describe('Cloudflared Service', () => {
  beforeEach(() => {
    initCloudflared(mockConfig);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('checkCloudflaredInstalled', () => {
    it('should return true when cloudflared is installed', async () => {
      const mockProc = createMockChildProcess(0, 'cloudflared version 2024.1.0', '');
      vi.mocked(spawn).mockReturnValue(mockProc as unknown as ChildProcess);

      const result = await checkCloudflaredInstalled();

      expect(result).toBe(true);
      expect(spawn).toHaveBeenCalledWith(
        '/usr/local/bin/cloudflared',
        ['--version'],
        expect.any(Object)
      );
    });

    it('should return false when cloudflared is not installed', async () => {
      vi.mocked(spawn).mockImplementation(() => {
        throw new Error('ENOENT');
      });

      const result = await checkCloudflaredInstalled();

      expect(result).toBe(false);
    });
  });

  describe('getCloudflaredVersion', () => {
    it('should return version string', async () => {
      const mockProc = createMockChildProcess(0, 'cloudflared version 2024.1.0', '');
      vi.mocked(spawn).mockReturnValue(mockProc as unknown as ChildProcess);

      const version = await getCloudflaredVersion();

      expect(version).toBe('2024.1.0');
    });

    it('should throw error when version check fails', async () => {
      const mockProc = createMockChildProcess(1, '', 'command not found');
      vi.mocked(spawn).mockReturnValue(mockProc as unknown as ChildProcess);

      await expect(getCloudflaredVersion()).rejects.toThrow('Failed to get cloudflared version');
    });
  });

  describe('createTunnel', () => {
    it('should create a tunnel successfully', async () => {
      const tunnelId = '550e8400-e29b-41d4-a716-446655440000';
      const credentialsContent = JSON.stringify({
        TunnelID: tunnelId,
        AccountTag: 'test-account',
        TunnelSecret: 'secret',
      });

      vi.mocked(getDefaultAccount).mockResolvedValue({
        accountId: 'test-account',
        apiToken: 'test-token',
      });

      vi.mocked(existsSync).mockReturnValue(false);

      const mockProc = createMockChildProcess(
        0,
        `Tunnel credentials written to /tmp/test-tunnels/test-tunnel/credentials.json`,
        ''
      );
      vi.mocked(spawn).mockReturnValue(mockProc as unknown as ChildProcess);

      vi.mocked(readFile).mockResolvedValue(credentialsContent);
      vi.mocked(writeFile).mockResolvedValue(undefined);
      vi.mocked(mkdir).mockResolvedValue(undefined);

      const result = await createTunnel('test-tunnel');

      expect(result).toBeDefined();
      expect(result.name).toBe('test-tunnel');
      expect(result.status).toBe('inactive');
    });

    it('should throw error when not authenticated', async () => {
      vi.mocked(getDefaultAccount).mockResolvedValue(null);
      vi.mocked(loadCredentials).mockResolvedValue(null);
      vi.mocked(existsSync).mockReturnValue(false);

      await expect(createTunnel('new-test-tunnel')).rejects.toThrow(
        'No Cloudflare credentials found'
      );
    });

    it('should throw error when tunnel name already exists', async () => {
      const tunnelId = '550e8400-e29b-41d4-a716-446655440000';

      vi.mocked(getDefaultAccount).mockResolvedValue({
        accountId: 'test-account',
        apiToken: 'test-token',
      });

      // First create: setup exists to return false initially, then true after first creation
      let callCount = 0;
      vi.mocked(existsSync).mockImplementation(() => {
        callCount++;
        return callCount > 1;
      });

      vi.mocked(readdir).mockResolvedValue([
        {
          name: 'existing-tunnel',
          isDirectory: () => true,
          isFile: () => false,
          isSymbolicLink: () => false,
        },
      ] as any[]);

      vi.mocked(readFile).mockResolvedValue(
        JSON.stringify({
          id: tunnelId,
          name: 'existing-tunnel',
          accountId: 'test-account',
          credentialsPath: '/tmp/test-tunnels/existing-tunnel/credentials.json',
          ingress: [],
          createdAt: new Date().toISOString(),
        })
      );

      const mockProc = createMockChildProcess(0, 'success', '');
      vi.mocked(spawn).mockReturnValue(mockProc as unknown as ChildProcess);
      vi.mocked(writeFile).mockResolvedValue(undefined);
      vi.mocked(mkdir).mockResolvedValue(undefined);

      // First creation should succeed
      await createTunnel('unique-tunnel-1');

      // Reset existsSync mock for second call
      callCount = 0;
      vi.mocked(existsSync).mockImplementation(() => {
        callCount++;
        return callCount > 1;
      });

      await expect(createTunnel('unique-tunnel-2')).rejects.toThrow();
    });

    it('should cleanup on failure', async () => {
      vi.mocked(getDefaultAccount).mockResolvedValue({
        accountId: 'test-account',
        apiToken: 'test-token',
      });

      vi.mocked(existsSync).mockReturnValue(false);

      const mockProc = createMockChildProcess(1, '', 'authentication error');
      vi.mocked(spawn).mockReturnValue(mockProc as unknown as ChildProcess);

      vi.mocked(rm).mockResolvedValue(undefined);
      vi.mocked(mkdir).mockResolvedValue(undefined);

      await expect(createTunnel('cleanup-test-tunnel')).rejects.toThrow();

      // Cleanup should be attempted
      expect(rm).toHaveBeenCalled();
    });
  });

  describe('tunnel operations', () => {
    const tunnelId = '550e8400-e29b-41d4-a716-446655440000';

    beforeEach(() => {
      // Setup stored tunnel for all tests
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readdir).mockResolvedValue([
        {
          name: 'test-tunnel',
          isDirectory: () => true,
          isFile: () => false,
          isSymbolicLink: () => false,
        },
      ] as any[]);

      vi.mocked(readFile).mockResolvedValue(
        JSON.stringify({
          id: tunnelId,
          name: 'test-tunnel',
          accountId: 'test-account',
          credentialsPath: `/tmp/test-tunnels/test-tunnel/credentials.json`,
          ingress: [],
          createdAt: new Date().toISOString(),
        })
      );

      vi.mocked(writeFile).mockResolvedValue(undefined);
    });

    it('should start a tunnel successfully', async () => {
      const mockProc = createMockChildProcess(0, '', '');
      vi.mocked(spawn).mockReturnValue(mockProc as unknown as ChildProcess);

      // Fast exit to simulate quick start
      setTimeout(() => {
        mockProc.emit('exit', 0);
      }, 50);

      await startTunnel(tunnelId);

      expect(spawn).toHaveBeenCalledWith(
        '/usr/local/bin/cloudflared',
        expect.arrayContaining(['tunnel', '--config', expect.any(String), 'run', tunnelId]),
        expect.any(Object)
      );
    });

    it('should throw error when tunnel not found', async () => {
      vi.mocked(existsSync).mockReturnValue(false);

      await expect(startTunnel('non-existent-id')).rejects.toThrow('Tunnel not found');
    });

    it('should stop a tunnel successfully', async () => {
      const mockProc = createMockChildProcess(0, '', '');
      vi.mocked(spawn).mockReturnValue(mockProc as unknown as ChildProcess);

      // Start tunnel first
      setTimeout(() => {
        mockProc.emit('exit', 0);
      }, 50);

      await startTunnel(tunnelId);

      const killMock = vi.fn();
      mockProc.kill = killMock;

      setTimeout(() => {
        mockProc.emit('exit', 0, 'SIGTERM');
      }, 100);

      await stopTunnel(tunnelId);

      expect(killMock).toHaveBeenCalledWith('SIGTERM');
    });

    it('should throw error when tunnel not found for stop', async () => {
      await expect(stopTunnel('non-existent-id')).rejects.toThrow('Tunnel not found');
    });

    it('should return tunnel status', async () => {
      const status = await getTunnelStatus(tunnelId);

      expect(status).toBeDefined();
      expect(status.status).toBe('inactive');
      expect(status.restartCount).toBe(0);
    });

    it('should throw error when tunnel not found for status', async () => {
      await expect(getTunnelStatus('non-existent-id')).rejects.toThrow('Tunnel not found');
    });

    it('should return tunnel logs', async () => {
      const mockProc = createMockChildProcess(0, 'stdout line', 'stderr line');
      vi.mocked(spawn).mockReturnValue(mockProc as unknown as ChildProcess);

      setTimeout(() => {
        mockProc.stdout?.emit('data', Buffer.from('Test log message'));
        mockProc.emit('exit', 0);
      }, 50);

      try {
        await startTunnel(tunnelId);
      } catch {
        // Ignore
      }

      const logs = await getTunnelLogs(tunnelId, 100);

      expect(Array.isArray(logs)).toBe(true);
    });

    it('should throw error when tunnel not found for logs', async () => {
      await expect(getTunnelLogs('non-existent-id')).rejects.toThrow('Tunnel not found');
    });

    it('should setup log streaming', async () => {
      const callback = vi.fn();
      const cleanup = await streamTunnelLogs(tunnelId, callback);

      expect(typeof cleanup).toBe('function');

      cleanup();
    });
  });

  describe('ingress rules management', () => {
    const tunnelId = '550e8400-e29b-41d4-a716-446655440000';
    const mockIngressRules = [
      { hostname: 'app.example.com', service: 'http://localhost:3000' },
      { hostname: 'api.example.com', service: 'http://localhost:3001' },
    ];

    beforeEach(() => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readdir).mockResolvedValue([
        {
          name: 'test-tunnel',
          isDirectory: () => true,
          isFile: () => false,
          isSymbolicLink: () => false,
        },
      ] as any[]);

      vi.mocked(readFile).mockResolvedValue(
        JSON.stringify({
          id: tunnelId,
          name: 'test-tunnel',
          accountId: 'test-account',
          credentialsPath: `/tmp/test-tunnels/test-tunnel/credentials.json`,
          ingress: [],
          createdAt: new Date().toISOString(),
        })
      );

      vi.mocked(writeFile).mockResolvedValue(undefined);
    });

    it('should update ingress rules', async () => {
      await updateIngressRules(tunnelId, mockIngressRules);

      expect(writeFile).toHaveBeenCalled();
      const rules = await getIngressRules(tunnelId);
      expect(rules).toEqual(mockIngressRules);
    });

    it('should get ingress rules', async () => {
      await updateIngressRules(tunnelId, mockIngressRules);

      const rules = await getIngressRules(tunnelId);

      expect(rules).toEqual(mockIngressRules);
    });

    it('should delete specific ingress rule', async () => {
      await updateIngressRules(tunnelId, mockIngressRules);

      await deleteIngressRule(tunnelId, 'app.example.com');

      const rules = await getIngressRules(tunnelId);
      expect(rules).toHaveLength(1);
      expect(rules[0].hostname).toBe('api.example.com');
    });

    it('should throw error when deleting non-existent rule', async () => {
      await expect(deleteIngressRule(tunnelId, 'non-existent.com')).rejects.toThrow('not found');
    });
  });

  describe('authentication helpers', () => {
    it('should initiate login flow', async () => {
      const mockProc = createMockChildProcess(
        0,
        'Please open https://dash.cloudflare.com/login in your browser',
        ''
      );
      vi.mocked(spawn).mockReturnValue(mockProc as unknown as ChildProcess);

      const result = await loginWithCloudflare();

      expect(result.url).toContain('dash.cloudflare.com');
    });

    it('should throw error when login fails', async () => {
      const mockProc = createMockChildProcess(1, '', 'login failed');
      vi.mocked(spawn).mockReturnValue(mockProc as unknown as ChildProcess);

      await expect(loginWithCloudflare()).rejects.toThrow('Login failed');
    });

    it('should check auth status', async () => {
      const mockProc = createMockChildProcess(0, 'Account 12345', '');
      vi.mocked(spawn).mockReturnValue(mockProc as unknown as ChildProcess);

      const status = await checkAuthStatus();

      expect(status.authenticated).toBe(true);
    });

    it('should return not authenticated when check fails', async () => {
      const mockProc = createMockChildProcess(1, '', 'not logged in');
      vi.mocked(spawn).mockReturnValue(mockProc as unknown as ChildProcess);

      const status = await checkAuthStatus();

      expect(status.authenticated).toBe(false);
    });

    it('should logout successfully', async () => {
      vi.mocked(existsSync).mockReturnValue(false);

      const mockProc = createMockChildProcess(0, '', '');
      vi.mocked(spawn).mockReturnValue(mockProc as unknown as ChildProcess);

      await expect(logout()).resolves.not.toThrow();
    });
  });
});

// Helper function to create mock child process
function createMockChildProcess(exitCode: number, stdout: string, stderr: string): EventEmitter {
  const proc = new EventEmitter() as EventEmitter & {
    stdout: EventEmitter;
    stderr: EventEmitter;
    pid?: number;
    killed?: boolean;
    kill?: (signal?: string) => boolean;
  };

  proc.stdout = new EventEmitter();
  proc.stderr = new EventEmitter();
  proc.pid = 12345;
  proc.killed = false;
  proc.kill = vi.fn((signal?: string) => {
    proc.killed = true;
    setTimeout(() => {
      proc.emit('exit', 0, signal);
    }, 10);
    return true;
  });

  // Simulate async stdout/stderr data
  setTimeout(() => {
    if (stdout) {
      proc.stdout.emit('data', Buffer.from(stdout));
    }
    if (stderr) {
      proc.stderr.emit('data', Buffer.from(stderr));
    }
    proc.emit('close', exitCode);
  }, 10);

  return proc;
}
