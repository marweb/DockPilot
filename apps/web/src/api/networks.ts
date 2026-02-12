import api, { extractData } from './client';
import type {
  Network,
  NetworkCreateOptions,
  ApiResponse,
  PaginatedResponse,
} from '@dockpilot/types';

/**
 * Network filters for list query
 */
export interface NetworkFilters {
  driver?: string;
  type?: string;
  label?: string;
  name?: string;
  id?: string;
  scope?: string;
}

/**
 * Network list query parameters
 */
export interface NetworkListParams {
  filters?: NetworkFilters;
  page?: number;
  pageSize?: number;
}

/**
 * Connect container to network request
 */
export interface ConnectNetworkRequest {
  container: string;
  endpointConfig?: {
    ipamConfig?: {
      ipv4Address?: string;
      ipv6Address?: string;
      linkLocalIPs?: string[];
    };
    links?: string[];
    aliases?: string[];
    networkID?: string;
    endpointID?: string;
    gateway?: string;
    ipAddress?: string;
    ipPrefixLen?: number;
    ipv6Gateway?: string;
    globalIPv6Address?: string;
    globalIPv6PrefixLen?: number;
    macAddress?: string;
    driverOpts?: Record<string, string>;
  };
}

/**
 * Disconnect container from network request
 */
export interface DisconnectNetworkRequest {
  container: string;
  force?: boolean;
}

/**
 * Extended network create options
 */
export interface CreateNetworkRequest extends NetworkCreateOptions {
  internal?: boolean;
  attachable?: boolean;
  ingress?: boolean;
  configOnly?: boolean;
  configFrom?: {
    network: string;
  };
  options?: Record<string, string>;
  enableIPv6?: boolean;
  ipam?: {
    driver?: string;
    config?: Array<{
      subnet?: string;
      ipRange?: string;
      gateway?: string;
      auxAddress?: Record<string, string>;
    }>;
    options?: Record<string, string>;
  };
  labels?: Record<string, string>;
}

/**
 * Get all networks with optional filtering
 * @param params Query parameters for filtering and pagination
 * @returns Paginated list of networks
 */
export async function getNetworks(
  params: NetworkListParams = {}
): Promise<PaginatedResponse<Network>> {
  const response = await api.get<ApiResponse<PaginatedResponse<Network>>>('/networks', {
    params,
  });
  return extractData(response);
}

/**
 * Get a single network by ID
 * @param id Network ID
 * @returns Network details
 */
export async function getNetwork(id: string): Promise<Network> {
  const response = await api.get<ApiResponse<Network>>(`/networks/${id}`);
  return extractData(response);
}

/**
 * Create a new network
 * @param data Network creation options
 * @returns Created network
 */
export async function createNetwork(data: CreateNetworkRequest): Promise<Network> {
  const response = await api.post<ApiResponse<Network>>('/networks', data);
  return extractData(response);
}

/**
 * Remove a network
 * @param id Network ID
 * @returns Success status
 */
export async function removeNetwork(id: string): Promise<void> {
  await api.delete<ApiResponse<void>>(`/networks/${id}`);
}

/**
 * Remove multiple networks
 * @param ids Array of network IDs
 * @returns Results for each network
 */
export async function removeNetworks(ids: string[]): Promise<
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
  >('/networks/remove', { ids });
  return extractData(response);
}

/**
 * Connect a container to a network
 * @param id Network ID
 * @param data Connection request with container name
 * @returns Success status
 */
export async function connectNetwork(id: string, data: ConnectNetworkRequest): Promise<void> {
  await api.post<ApiResponse<void>>(`/networks/${id}/connect`, data);
}

/**
 * Disconnect a container from a network
 * @param id Network ID
 * @param data Disconnection request with container name
 * @returns Success status
 */
export async function disconnectNetwork(id: string, data: DisconnectNetworkRequest): Promise<void> {
  await api.post<ApiResponse<void>>(`/networks/${id}/disconnect`, data);
}

/**
 * Prune unused networks
 * @returns Prune results
 */
export async function pruneNetworks(): Promise<{
  networksDeleted: string[];
}> {
  const response = await api.post<
    ApiResponse<{
      networksDeleted: string[];
    }>
  >('/networks/prune');
  return extractData(response);
}

/**
 * Inspect network and get detailed information
 * @param id Network ID
 * @param verbose Include verbose output
 * @param scope Filter by scope
 * @returns Network inspection details
 */
export async function inspectNetwork(
  id: string,
  verbose?: boolean,
  scope?: string
): Promise<
  Network & {
    containers: Record<
      string,
      {
        name: string;
        endpointId: string;
        macAddress: string;
        ipv4Address: string;
        ipv6Address: string;
      }
    >;
    peers?: Array<{
      name: string;
      ip: string;
    }>;
  }
> {
  const response = await api.get<
    ApiResponse<
      Network & {
        containers: Record<
          string,
          {
            name: string;
            endpointId: string;
            macAddress: string;
            ipv4Address: string;
            ipv6Address: string;
          }
        >;
        peers?: Array<{
          name: string;
          ip: string;
        }>;
      }
    >
  >(`/networks/${id}/inspect`, {
    params: { verbose, scope },
  });
  return extractData(response);
}
