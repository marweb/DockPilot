import api, { extractData } from './client';
import type { Volume, VolumeInspect, ApiResponse, PaginatedResponse } from '@dockpilot/types';

/**
 * Volume filters for list query
 */
export interface VolumeFilters {
  name?: string;
  driver?: string;
  label?: string;
  dangling?: boolean;
}

/**
 * Volume list query parameters
 */
export interface VolumeListParams {
  filters?: VolumeFilters;
  page?: number;
  pageSize?: number;
}

/**
 * Create volume request
 */
export interface CreateVolumeRequest {
  name?: string;
  driver?: string;
  driverOpts?: Record<string, string>;
  labels?: Record<string, string>;
}

/**
 * Get all volumes with optional filtering
 * @param params Query parameters for filtering and pagination
 * @returns Paginated list of volumes
 */
export async function getVolumes(
  params: VolumeListParams = {}
): Promise<PaginatedResponse<Volume>> {
  const response = await api.get<ApiResponse<PaginatedResponse<Volume>>>('/volumes', {
    params,
  });
  return extractData(response);
}

/**
 * Get a single volume by name
 * @param name Volume name
 * @returns Volume details
 */
export async function getVolume(name: string): Promise<VolumeInspect> {
  const response = await api.get<ApiResponse<VolumeInspect>>(`/volumes/${name}`);
  return extractData(response);
}

/**
 * Create a new volume
 * @param data Volume creation options
 * @returns Created volume
 */
export async function createVolume(data: CreateVolumeRequest): Promise<Volume> {
  const response = await api.post<ApiResponse<Volume>>('/volumes', data);
  return extractData(response);
}

/**
 * Remove a volume
 * @param name Volume name
 * @param force Force removal
 * @returns Success status
 */
export async function removeVolume(name: string, force?: boolean): Promise<void> {
  await api.delete<ApiResponse<void>>(`/volumes/${name}`, {
    params: { force },
  });
}

/**
 * Remove multiple volumes
 * @param names Array of volume names
 * @returns Results for each volume
 */
export async function removeVolumes(names: string[]): Promise<
  Array<{
    name: string;
    success: boolean;
    error?: string;
  }>
> {
  const response = await api.post<
    ApiResponse<
      Array<{
        name: string;
        success: boolean;
        error?: string;
      }>
    >
  >('/volumes/remove', { names });
  return extractData(response);
}

/**
 * Prune unused volumes
 * @param filters Optional filters
 * @returns Prune results
 */
export async function pruneVolumes(filters?: { label?: string[]; all?: boolean }): Promise<{
  volumesDeleted: string[];
  spaceReclaimed: number;
}> {
  const response = await api.post<
    ApiResponse<{
      volumesDeleted: string[];
      spaceReclaimed: number;
    }>
  >('/volumes/prune', null, {
    params: { filters },
  });
  return extractData(response);
}

/**
 * Get volume usage statistics
 * @returns Volume usage information
 */
export async function getVolumeUsage(): Promise<{
  totalVolumes: number;
  totalSize: number;
  usedVolumes: number;
  unusedVolumes: number;
}> {
  const response = await api.get<
    ApiResponse<{
      totalVolumes: number;
      totalSize: number;
      usedVolumes: number;
      unusedVolumes: number;
    }>
  >('/volumes/usage');
  return extractData(response);
}

/**
 * Backup volume to tarball
 * @param name Volume name
 * @returns Blob data
 */
export async function backupVolume(name: string): Promise<Blob> {
  const response = await api.get(`/volumes/${name}/backup`, {
    responseType: 'blob',
  });
  return response.data as Blob;
}

/**
 * Restore volume from tarball
 * @param name Volume name
 * @param data Tarball data
 * @returns Restore result
 */
export async function restoreVolume(name: string, data: Blob): Promise<{ status: string }> {
  const formData = new FormData();
  formData.append('file', data);

  const response = await api.post<ApiResponse<{ status: string }>>(
    `/volumes/${name}/restore`,
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }
  );
  return extractData(response);
}
