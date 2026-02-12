import api, { extractData } from './client';
import type {
  Tunnel,
  TunnelCreateOptions,
  IngressRule,
  TunnelStatus,
  ApiResponse,
  PaginatedResponse,
} from '@dockpilot/types';

/**
 * Tunnel filters for list query
 */
export interface TunnelFilters {
  status?: TunnelStatus;
  name?: string;
  accountId?: string;
  zoneId?: string;
}

/**
 * Tunnel list query parameters
 */
export interface TunnelListParams {
  filters?: TunnelFilters;
  page?: number;
  pageSize?: number;
}

/**
 * Create tunnel request
 */
export interface CreateTunnelRequest extends TunnelCreateOptions {
  name: string;
  zoneId?: string;
  config?: {
    ingress?: IngressRule[];
    warpRouting?: boolean;
  };
}

/**
 * Update ingress rules request
 */
export interface UpdateIngressRequest {
  ingress: IngressRule[];
}

/**
 * Tunnel metrics
 */
export interface TunnelMetrics {
  tunnelId: string;
  connections: number;
  bytesReceived: number;
  bytesSent: number;
  latency: number;
  requestsPerSecond: number;
}

/**
 * Get all Cloudflare tunnels
 * @param params Query parameters for filtering and pagination
 * @returns Paginated list of tunnels
 */
export async function getTunnels(
  params: TunnelListParams = {}
): Promise<PaginatedResponse<Tunnel>> {
  const response = await api.get<ApiResponse<PaginatedResponse<Tunnel>>>('/tunnels', {
    params,
  });
  return extractData(response);
}

/**
 * Get a single tunnel by ID
 * @param id Tunnel ID
 * @returns Tunnel details
 */
export async function getTunnel(id: string): Promise<Tunnel> {
  const response = await api.get<ApiResponse<Tunnel>>(`/tunnels/${id}`);
  return extractData(response);
}

/**
 * Create a new Cloudflare tunnel
 * @param data Tunnel creation options
 * @returns Created tunnel
 */
export async function createTunnel(data: CreateTunnelRequest): Promise<Tunnel> {
  const response = await api.post<ApiResponse<Tunnel>>('/tunnels', data);
  return extractData(response);
}

/**
 * Delete a tunnel
 * @param id Tunnel ID
 * @returns Success status
 */
export async function deleteTunnel(id: string): Promise<void> {
  await api.delete<ApiResponse<void>>(`/tunnels/${id}`);
}

/**
 * Start a tunnel
 * @param id Tunnel ID
 * @returns Success status
 */
export async function startTunnel(id: string): Promise<void> {
  await api.post<ApiResponse<void>>(`/tunnels/${id}/start`);
}

/**
 * Stop a tunnel
 * @param id Tunnel ID
 * @returns Success status
 */
export async function stopTunnel(id: string): Promise<void> {
  await api.post<ApiResponse<void>>(`/tunnels/${id}/stop`);
}

/**
 * Restart a tunnel
 * @param id Tunnel ID
 * @returns Success status
 */
export async function restartTunnel(id: string): Promise<void> {
  await api.post<ApiResponse<void>>(`/tunnels/${id}/restart`);
}

/**
 * Update tunnel ingress rules
 * @param id Tunnel ID
 * @param rules New ingress rules
 * @returns Updated tunnel
 */
export async function updateIngress(id: string, rules: IngressRule[]): Promise<Tunnel> {
  const response = await api.put<ApiResponse<Tunnel>>(`/tunnels/${id}/ingress`, { ingress: rules });
  return extractData(response);
}

/**
 * Get tunnel configuration
 * @param id Tunnel ID
 * @returns Tunnel configuration
 */
export async function getTunnelConfig(id: string): Promise<{
  tunnelId: string;
  accountId: string;
  ingress: IngressRule[];
  warpRouting?: boolean;
}> {
  const response = await api.get<
    ApiResponse<{
      tunnelId: string;
      accountId: string;
      ingress: IngressRule[];
      warpRouting?: boolean;
    }>
  >(`/tunnels/${id}/config`);
  return extractData(response);
}

/**
 * Update tunnel configuration
 * @param id Tunnel ID
 * @param config New configuration
 * @returns Updated tunnel
 */
export async function updateTunnelConfig(
  id: string,
  config: {
    ingress?: IngressRule[];
    warpRouting?: boolean;
  }
): Promise<Tunnel> {
  const response = await api.put<ApiResponse<Tunnel>>(`/tunnels/${id}/config`, config);
  return extractData(response);
}

/**
 * Get tunnel logs
 * @param id Tunnel ID
 * @param options Log options
 * @returns Tunnel logs
 */
export async function getTunnelLogs(
  id: string,
  options: {
    tail?: number;
    since?: string;
    until?: string;
  } = {}
): Promise<
  Array<{
    timestamp: string;
    level: string;
    message: string;
  }>
> {
  const response = await api.get<
    ApiResponse<
      Array<{
        timestamp: string;
        level: string;
        message: string;
      }>
    >
  >(`/tunnels/${id}/logs`, { params: options });
  return extractData(response);
}

/**
 * Get tunnel metrics
 * @param id Tunnel ID
 * @returns Tunnel metrics
 */
export async function getTunnelMetrics(id: string): Promise<TunnelMetrics> {
  const response = await api.get<ApiResponse<TunnelMetrics>>(`/tunnels/${id}/metrics`);
  return extractData(response);
}

/**
 * Get tunnel token/credentials
 * @param id Tunnel ID
 * @returns Tunnel credentials
 */
export async function getTunnelCredentials(id: string): Promise<{
  tunnelId: string;
  accountId: string;
  tunnelSecret: string;
  credentialsFile: string;
}> {
  const response = await api.get<
    ApiResponse<{
      tunnelId: string;
      accountId: string;
      tunnelSecret: string;
      credentialsFile: string;
    }>
  >(`/tunnels/${id}/credentials`);
  return extractData(response);
}

/**
 * Validate tunnel name
 * @param name Tunnel name to validate
 * @returns Validation result
 */
export async function validateTunnelName(name: string): Promise<{
  valid: boolean;
  error?: string;
}> {
  const response = await api.get<
    ApiResponse<{
      valid: boolean;
      error?: string;
    }>
  >('/tunnels/validate-name', {
    params: { name },
  });
  return extractData(response);
}

/**
 * Get available Cloudflare zones
 * @returns List of zones
 */
export async function getCloudflareZones(): Promise<
  Array<{
    id: string;
    name: string;
    status: string;
  }>
> {
  const response = await api.get<
    ApiResponse<
      Array<{
        id: string;
        name: string;
        status: string;
      }>
    >
  >('/tunnels/zones');
  return extractData(response);
}

/**
 * Test tunnel connectivity
 * @param id Tunnel ID
 * @returns Test result
 */
export async function testTunnel(id: string): Promise<{
  success: boolean;
  message: string;
  latency?: number;
}> {
  const response = await api.post<
    ApiResponse<{
      success: boolean;
      message: string;
      latency?: number;
    }>
  >(`/tunnels/${id}/test`);
  return extractData(response);
}

/**
 * Bulk delete tunnels
 * @param ids Array of tunnel IDs
 * @returns Results for each tunnel
 */
export async function deleteTunnels(ids: string[]): Promise<
  Array<{
    id: string;
    success: boolean;
    error?: string;
  }>
> {
  const response = await api.post<
    ApiResponse<
      Array<{
        id: string;
        success: boolean;
        error?: string;
      }>
    >
  >('/tunnels/bulk-delete', { ids });
  return extractData(response);
}
