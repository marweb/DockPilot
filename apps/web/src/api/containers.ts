import api, { extractData } from './client';
import type {
  Container,
  ContainerCreateOptions,
  ContainerStats,
  ContainerInspect,
  ApiResponse,
  PaginatedResponse,
} from '@dockpilot/types';

/**
 * Container filters for list query
 */
export interface ContainerFilters {
  status?: string;
  label?: string;
  name?: string;
  ancestor?: string;
}

/**
 * Container list query parameters
 */
export interface ContainerListParams {
  all?: boolean;
  filters?: ContainerFilters;
  page?: number;
  pageSize?: number;
}

/**
 * Execute command request body
 */
export interface ExecCommandRequest {
  command: string[];
  tty?: boolean;
  stdin?: boolean;
}

/**
 * Execute command response
 */
export interface ExecCommandResponse {
  execId: string;
  output?: string;
}

/**
 * Get all containers with optional filtering
 * @param params Query parameters for filtering and pagination
 * @returns Paginated list of containers
 */
export async function getContainers(
  params: ContainerListParams = {}
): Promise<PaginatedResponse<Container>> {
  const response = await api.get<ApiResponse<PaginatedResponse<Container>>>('/containers', {
    params,
  });
  return extractData(response);
}

/**
 * Get a single container by ID
 * @param id Container ID
 * @returns Container details
 */
export async function getContainer(id: string): Promise<Container> {
  const response = await api.get<ApiResponse<Container>>(`/containers/${id}`);
  return extractData(response);
}

/**
 * Get detailed container inspection
 * @param id Container ID
 * @returns Container inspection details
 */
export async function inspectContainer(id: string): Promise<ContainerInspect> {
  const response = await api.get<ApiResponse<ContainerInspect>>(`/containers/${id}/inspect`);
  return extractData(response);
}

/**
 * Create a new container
 * @param data Container creation options
 * @returns Created container
 */
export async function createContainer(data: ContainerCreateOptions): Promise<Container> {
  const response = await api.post<ApiResponse<Container>>('/containers', data);
  return extractData(response);
}

/**
 * Start a container
 * @param id Container ID
 * @returns Success status
 */
export async function startContainer(id: string): Promise<void> {
  await api.post<ApiResponse<void>>(`/containers/${id}/start`);
}

/**
 * Stop a container
 * @param id Container ID
 * @param timeout Seconds to wait before killing
 * @returns Success status
 */
export async function stopContainer(id: string, timeout?: number): Promise<void> {
  await api.post<ApiResponse<void>>(`/containers/${id}/stop`, null, {
    params: { timeout },
  });
}

/**
 * Restart a container
 * @param id Container ID
 * @param timeout Seconds to wait before killing
 * @returns Success status
 */
export async function restartContainer(id: string, timeout?: number): Promise<void> {
  await api.post<ApiResponse<void>>(`/containers/${id}/restart`, null, {
    params: { timeout },
  });
}

/**
 * Kill a container
 * @param id Container ID
 * @param signal Signal to send (default: SIGKILL)
 * @returns Success status
 */
export async function killContainer(id: string, signal?: string): Promise<void> {
  await api.post<ApiResponse<void>>(`/containers/${id}/kill`, null, {
    params: { signal },
  });
}

/**
 * Pause a container
 * @param id Container ID
 * @returns Success status
 */
export async function pauseContainer(id: string): Promise<void> {
  await api.post<ApiResponse<void>>(`/containers/${id}/pause`);
}

/**
 * Unpause a container
 * @param id Container ID
 * @returns Success status
 */
export async function unpauseContainer(id: string): Promise<void> {
  await api.post<ApiResponse<void>>(`/containers/${id}/unpause`);
}

/**
 * Remove a container
 * @param id Container ID
 * @param force Force removal
 * @param removeVolumes Remove associated volumes
 * @returns Success status
 */
export async function removeContainer(
  id: string,
  force?: boolean,
  removeVolumes?: boolean
): Promise<void> {
  await api.delete<ApiResponse<void>>(`/containers/${id}`, {
    params: { force, v: removeVolumes },
  });
}

/**
 * Rename a container
 * @param id Container ID
 * @param name New name
 * @returns Success status
 */
export async function renameContainer(id: string, name: string): Promise<void> {
  await api.post<ApiResponse<void>>(`/containers/${id}/rename`, null, {
    params: { name },
  });
}

/**
 * Get container logs
 * @param id Container ID
 * @param options Log options (tail, since, timestamps, follow)
 * @returns Container logs as string
 */
export async function getContainerLogs(
  id: string,
  options: {
    tail?: number;
    since?: number;
    timestamps?: boolean;
    follow?: boolean;
  } = {}
): Promise<string> {
  const response = await api.get<ApiResponse<string>>(`/containers/${id}/logs`, {
    params: options,
  });
  return extractData(response);
}

/**
 * Execute a command in a container
 * @param id Container ID
 * @param data Command execution request
 * @returns Execution response with exec ID
 */
export async function execContainer(
  id: string,
  data: ExecCommandRequest
): Promise<ExecCommandResponse> {
  const response = await api.post<ApiResponse<ExecCommandResponse>>(`/containers/${id}/exec`, data);
  return extractData(response);
}

/**
 * Get container statistics
 * @param id Container ID
 * @param stream Whether to stream stats
 * @returns Container statistics
 */
export async function getContainerStats(id: string, stream?: boolean): Promise<ContainerStats> {
  const response = await api.get<ApiResponse<ContainerStats>>(`/containers/${id}/stats`, {
    params: { stream },
  });
  return extractData(response);
}

/**
 * Prune stopped containers
 * @returns Prune results
 */
export async function pruneContainers(): Promise<{
  containersDeleted: string[];
  spaceReclaimed: number;
}> {
  const response = await api.post<
    ApiResponse<{
      containersDeleted: string[];
      spaceReclaimed: number;
    }>
  >('/containers/prune');
  return extractData(response);
}

/**
 * Update container resources
 * @param id Container ID
 * @param resources Resource limits
 * @returns Success status
 */
export async function updateContainer(
  id: string,
  resources: {
    memory?: number;
    cpuShares?: number;
    cpuQuota?: number;
    cpuPeriod?: number;
    blkioWeight?: number;
  }
): Promise<void> {
  await api.post<ApiResponse<void>>(`/containers/${id}/update`, resources);
}
