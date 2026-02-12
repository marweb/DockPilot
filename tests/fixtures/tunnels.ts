import type {
  Tunnel,
  TunnelStatus,
  IngressRule,
  TunnelCredentials,
  TunnelCreateOptions,
} from '@dockpilot/types';
import { v4 as uuidv4 } from 'uuid';

// Cloudflare API Mock Response Types
export interface CloudflareApiResponse<T> {
  success: boolean;
  errors: CloudflareError[];
  messages: string[];
  result: T;
}

export interface CloudflareError {
  code: number;
  message: string;
}

export interface CloudflareTunnel {
  id: string;
  account_tag: string;
  name: string;
  created_at: string;
  deleted_at: string | null;
  connections: CloudflareConnection[];
  status: 'healthy' | 'down' | 'degraded';
}

export interface CloudflareConnection {
  id: string;
  features: string[];
  origin_ip: string;
  opened_at: string;
  client_id: string;
}

// Mock Tunnels
export const mockTunnels: Tunnel[] = [
  {
    id: 'tunnel-test-1',
    name: 'web-app-tunnel',
    accountId: 'cf-account-123',
    zoneId: 'zone-example-456',
    status: 'active' as TunnelStatus,
    createdAt: new Date('2024-01-15'),
    publicUrl: 'https://web-app-tunnel.trycloudflare.com',
    ingressRules: [
      {
        hostname: 'app.example.com',
        service: 'http://localhost:3000',
        port: 3000,
      },
      {
        hostname: 'api.example.com',
        service: 'http://localhost:3001',
        path: '/api',
        port: 3001,
      },
    ],
    connectedServices: ['http://localhost:3000', 'http://localhost:3001'],
  },
  {
    id: 'tunnel-test-2',
    name: 'api-gateway-tunnel',
    accountId: 'cf-account-123',
    zoneId: 'zone-example-789',
    status: 'inactive' as TunnelStatus,
    createdAt: new Date('2024-01-16'),
    ingressRules: [],
    connectedServices: [],
  },
  {
    id: 'tunnel-test-3',
    name: 'database-tunnel',
    accountId: 'cf-account-123',
    zoneId: 'zone-example-abc',
    status: 'error' as TunnelStatus,
    createdAt: new Date('2024-01-17'),
    ingressRules: [
      {
        hostname: 'db.example.com',
        service: 'tcp://localhost:5432',
        port: 5432,
      },
    ],
    connectedServices: ['tcp://localhost:5432'],
  },
];

// Mock Cloudflare API Tunnels
export const mockCloudflareTunnels: CloudflareTunnel[] = [
  {
    id: 'tunnel-test-1',
    account_tag: 'cf-account-123',
    name: 'web-app-tunnel',
    created_at: '2024-01-15T10:00:00Z',
    deleted_at: null,
    status: 'healthy',
    connections: [
      {
        id: 'conn-1',
        features: ['http2', 'compress'],
        origin_ip: '192.168.1.100',
        opened_at: '2024-01-15T10:05:00Z',
        client_id: 'client-abc',
      },
    ],
  },
  {
    id: 'tunnel-test-2',
    account_tag: 'cf-account-123',
    name: 'api-gateway-tunnel',
    created_at: '2024-01-16T11:00:00Z',
    deleted_at: null,
    status: 'down',
    connections: [],
  },
];

// Tunnel Credentials
export const mockTunnelCredentials: TunnelCredentials = {
  tunnelId: 'tunnel-test-1',
  accountId: 'cf-account-123',
  tunnelSecret: 'mock-secret-key-' + uuidv4().replace(/-/g, '').substring(0, 16),
  credentialsFile: '/etc/cloudflared/tunnel-test-1.json',
};

// Cloudflare API Token (mock)
export const mockCloudflareToken = {
  token: 'mock-cf-token-' + uuidv4(),
  expiresAt: new Date(Date.now() + 3600000).toISOString(),
};

// Test Configuration
export const testTunnelConfig = {
  defaultZoneId: 'zone-test-default',
  defaultAccountId: 'cf-account-test',
  baseUrl: 'https://api.cloudflare.com/client/v4',
  testTimeout: 30000,
  retryAttempts: 3,
};

// Helper: Create new tunnel fixture
export function createTestTunnel(name: string, options?: Partial<TunnelCreateOptions>): Tunnel {
  const id = `tunnel-test-${Date.now()}`;
  return {
    id,
    name: name || `test-tunnel-${Date.now()}`,
    accountId: options?.zoneId ? 'cf-account-123' : testTunnelConfig.defaultAccountId,
    zoneId: options?.zoneId || testTunnelConfig.defaultZoneId,
    status: 'creating' as TunnelStatus,
    createdAt: new Date(),
    ingressRules: [],
    connectedServices: [],
  };
}

// Helper: Create ingress rule fixture
export function createIngressRule(
  hostname: string,
  service: string,
  port: number,
  path?: string
): IngressRule {
  return {
    hostname,
    service,
    port,
    path,
  };
}

// Helper: Create Cloudflare API response
export function createCloudflareResponse<T>(data: T, success = true): CloudflareApiResponse<T> {
  return {
    success,
    errors: success ? [] : [{ code: 400, message: 'Bad Request' }],
    messages: success ? ['Success'] : [],
    result: data,
  };
}

// Helper: Mock Cloudflare API error response
export function createCloudflareErrorResponse(
  code: number,
  message: string
): CloudflareApiResponse<null> {
  return {
    success: false,
    errors: [{ code, message }],
    messages: [],
    result: null,
  };
}

// Helper: Generate tunnel logs
export function generateTunnelLogs(tunnelId: string, lines = 100): string[] {
  const logs: string[] = [];
  const now = Date.now();

  for (let i = 0; i < lines; i++) {
    const timestamp = new Date(now - (lines - i) * 1000).toISOString();
    const level = Math.random() > 0.9 ? 'ERROR' : Math.random() > 0.7 ? 'WARN' : 'INFO';
    const message = [
      `[${timestamp}] ${level} tunnel-${tunnelId}:`,
      level === 'ERROR'
        ? 'Connection failed to establish'
        : level === 'WARN'
          ? 'Retrying connection attempt'
          : 'Tunnel connection established successfully',
    ].join(' ');
    logs.push(message);
  }

  return logs;
}

// Helper: Cleanup test tunnels
export async function cleanupTestTunnels(tunnelIds: string[]): Promise<void> {
  console.log(`Cleaning up ${tunnelIds.length} test tunnels:`, tunnelIds);
  // In real implementation, this would call the API to delete tunnels
}

// Helper: Wait for tunnel status
export async function waitForTunnelStatus(
  tunnelId: string,
  expectedStatus: TunnelStatus,
  timeout = 30000
): Promise<boolean> {
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    // In real implementation, check actual tunnel status
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  return false;
}

// Helper: Check if Cloudflare API is accessible
export async function isCloudflareApiOnline(): Promise<boolean> {
  // In real implementation, check connectivity to Cloudflare API
  return process.env.CLOUDFLARE_API_OFFLINE !== 'true';
}

// Export test tunnel names for cleanup
export const testTunnelNames = new Set<string>();

// Helper: Register test tunnel for cleanup
export function registerTestTunnel(name: string): void {
  testTunnelNames.add(name);
}

// Helper: Generate unique tunnel name
export function generateUniqueTunnelName(prefix = 'e2e-test'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
}

// Mock Cloudflare API Routes
export const mockCloudflareRoutes = {
  listTunnels: '/accounts/:accountId/tunnels',
  createTunnel: '/accounts/:accountId/tunnels',
  getTunnel: '/accounts/:accountId/tunnels/:tunnelId',
  deleteTunnel: '/accounts/:accountId/tunnels/:tunnelId',
  getTunnelToken: '/accounts/:accountId/tunnels/:tunnelId/token',
  listConnections: '/accounts/:accountId/tunnels/:tunnelId/connections',
};

// Ingress Rule Templates
export const ingressRuleTemplates = {
  http: (hostname: string, port: number) => ({
    hostname,
    service: `http://localhost:${port}`,
    port,
  }),
  https: (hostname: string, port: number) => ({
    hostname,
    service: `https://localhost:${port}`,
    port,
  }),
  tcp: (hostname: string, port: number) => ({
    hostname,
    service: `tcp://localhost:${port}`,
    port,
  }),
  withPath: (hostname: string, service: string, port: number, path: string) => ({
    hostname,
    service,
    port,
    path,
  }),
};
