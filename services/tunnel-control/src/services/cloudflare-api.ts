import type { Config } from '../config/index.js';

interface CloudflareErrorResponse {
  success: boolean;
  errors: Array<{
    code: number;
    message: string;
    error_chain?: Array<{
      code: number;
      message: string;
    }>;
  }>;
}

interface CloudflareTunnel {
  id: string;
  name: string;
  account_tag: string;
  created_at: string;
  deleted_at: string | null;
  connections: Array<{
    id: string;
    connected_at: string;
    disconnected_at: string | null;
    origin_ip: string;
    opened_by: string;
  }>;
  conns_active_at: string | null;
  conns_inactive_at: string | null;
  tun_type: string;
  status: string;
  remote_config: boolean;
  version: string;
}

interface TunnelCredentials {
  AccountTag: string;
  TunnelSecret: string;
  TunnelID: string;
  TunnelName: string;
}

let config: Config;
let currentToken: string | null = null;
let currentAccountId: string | null = null;

const BASE_URL = 'https://api.cloudflare.com/client/v4';

// Simple rate limiting
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_REQUESTS = 100;
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute

export function initCloudflareAPI(cfg: Config): void {
  config = cfg;
}

export async function authenticate(token: string, accountId: string): Promise<void> {
  // Validate token by making a test request
  const response = await fetch(`${BASE_URL}/accounts/${accountId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = (await response.json()) as CloudflareErrorResponse;
    throw new CloudflareAPIError(
      error.errors?.[0]?.message || 'Authentication failed',
      response.status,
      error.errors?.[0]?.code
    );
  }

  currentToken = token;
  currentAccountId = accountId;
}

export async function listTunnels(accountId: string): Promise<CloudflareTunnel[]> {
  checkRateLimit('listTunnels');

  const response = await fetch(`${BASE_URL}/accounts/${accountId}/cfd_tunnel?is_deleted=false`, {
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw await parseError(response);
  }

  const data = (await response.json()) as { success: boolean; result: CloudflareTunnel[] };
  return data.result;
}

export async function createTunnel(name: string, accountId: string): Promise<CloudflareTunnel> {
  checkRateLimit('createTunnel');

  const response = await fetch(`${BASE_URL}/accounts/${accountId}/cfd_tunnel`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ name }),
  });

  if (!response.ok) {
    throw await parseError(response);
  }

  const data = (await response.json()) as { success: boolean; result: CloudflareTunnel };
  return data.result;
}

export async function deleteTunnel(id: string, accountId: string): Promise<void> {
  checkRateLimit('deleteTunnel');

  const response = await fetch(`${BASE_URL}/accounts/${accountId}/cfd_tunnel/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw await parseError(response);
  }
}

export async function getTunnel(id: string, accountId: string): Promise<CloudflareTunnel> {
  checkRateLimit('getTunnel');

  const response = await fetch(`${BASE_URL}/accounts/${accountId}/cfd_tunnel/${id}`, {
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw await parseError(response);
  }

  const data = (await response.json()) as { success: boolean; result: CloudflareTunnel };
  return data.result;
}

export async function getTunnelToken(id: string, accountId: string): Promise<TunnelCredentials> {
  checkRateLimit('getTunnelToken');

  const response = await fetch(`${BASE_URL}/accounts/${accountId}/cfd_tunnel/${id}/token`, {
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw await parseError(response);
  }

  const data = (await response.json()) as { success: boolean; result: string };
  // The result is a base64 encoded JSON string
  const decoded = Buffer.from(data.result, 'base64').toString('utf-8');
  return JSON.parse(decoded) as TunnelCredentials;
}

export async function getAccountInfo(accountId: string): Promise<{ id: string; name: string }> {
  checkRateLimit('getAccountInfo');

  const response = await fetch(`${BASE_URL}/accounts/${accountId}`, {
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw await parseError(response);
  }

  const data = (await response.json()) as {
    success: boolean;
    result: { id: string; name: string };
  };
  return data.result;
}

export function isAuthenticated(): boolean {
  return currentToken !== null && currentAccountId !== null;
}

export function getCurrentAccountId(): string | null {
  return currentAccountId;
}

export function clearAuthentication(): void {
  currentToken = null;
  currentAccountId = null;
}

function getAuthHeaders(): Record<string, string> {
  if (!currentToken) {
    throw new CloudflareAPIError('Not authenticated', 401);
  }

  return {
    Authorization: `Bearer ${currentToken}`,
    'Content-Type': 'application/json',
  };
}

function checkRateLimit(operation: string): void {
  const now = Date.now();
  const key = `${operation}:${currentAccountId || 'anonymous'}`;
  const limit = rateLimitStore.get(key);

  if (limit) {
    if (now > limit.resetTime) {
      rateLimitStore.set(key, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    } else if (limit.count >= RATE_LIMIT_REQUESTS) {
      throw new CloudflareAPIError(
        `Rate limit exceeded for ${operation}. Try again later.`,
        429,
        10001
      );
    } else {
      limit.count++;
    }
  } else {
    rateLimitStore.set(key, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
  }
}

async function parseError(response: Response): Promise<CloudflareAPIError> {
  try {
    const error = (await response.json()) as CloudflareErrorResponse;
    return new CloudflareAPIError(
      error.errors?.[0]?.message || `HTTP ${response.status}`,
      response.status,
      error.errors?.[0]?.code
    );
  } catch {
    return new CloudflareAPIError(`HTTP ${response.status}`, response.status);
  }
}

export class CloudflareAPIError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code?: number
  ) {
    super(message);
    this.name = 'CloudflareAPIError';
  }
}
