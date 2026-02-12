import api, { extractData } from './client';
import type { BuildOptions, BuildProgress, ApiResponse } from '@dockpilot/types';

/**
 * Build image request extends BuildOptions
 */
export interface BuildImageRequest extends BuildOptions {
  context: string;
}

/**
 * Build status response
 */
export interface BuildStatus {
  id: string;
  status: 'pending' | 'building' | 'success' | 'error' | 'cancelled';
  progress?: number;
  step?: string;
  message?: string;
  error?: string;
  imageId?: string;
  startedAt?: Date;
  finishedAt?: Date;
  logs?: BuildProgress[];
}

/**
 * Build list filters
 */
export interface BuildListParams {
  status?: string;
  page?: number;
  pageSize?: number;
}

/**
 * Build image from Dockerfile
 * @param data Build options including context and tags
 * @returns Build ID for tracking
 */
export async function buildImage(data: BuildImageRequest): Promise<{ buildId: string }> {
  const response = await api.post<ApiResponse<{ buildId: string }>>('/builds', data);
  return extractData(response);
}

/**
 * Build image from uploaded context
 * @param context Tarball of build context
 * @param options Build options
 * @returns Build ID for tracking
 */
export async function buildImageFromUpload(
  context: File | Blob,
  options: Omit<BuildImageRequest, 'context'>
): Promise<{ buildId: string }> {
  const formData = new FormData();
  formData.append('context', context);
  formData.append('options', JSON.stringify(options));

  const response = await api.post<ApiResponse<{ buildId: string }>>('/builds/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return extractData(response);
}

/**
 * Get build status and progress
 * @param id Build ID
 * @returns Build status with progress
 */
export async function getBuildStatus(id: string): Promise<BuildStatus> {
  const response = await api.get<ApiResponse<BuildStatus>>(`/builds/${id}`);
  return extractData(response);
}

/**
 * Get build logs
 * @param id Build ID
 * @returns Build logs
 */
export async function getBuildLogs(id: string): Promise<BuildProgress[]> {
  const response = await api.get<ApiResponse<BuildProgress[]>>(`/builds/${id}/logs`);
  return extractData(response);
}

/**
 * Cancel a running build
 * @param id Build ID
 * @returns Success status
 */
export async function cancelBuild(id: string): Promise<void> {
  await api.post<ApiResponse<void>>(`/builds/${id}/cancel`);
}

/**
 * List all builds
 * @param params Query parameters
 * @returns List of builds
 */
export async function getBuilds(params: BuildListParams = {}): Promise<{
  items: BuildStatus[];
  total: number;
}> {
  const response = await api.get<
    ApiResponse<{
      items: BuildStatus[];
      total: number;
    }>
  >('/builds', { params });
  return extractData(response);
}

/**
 * Delete a build record
 * @param id Build ID
 * @returns Success status
 */
export async function deleteBuild(id: string): Promise<void> {
  await api.delete<ApiResponse<void>>(`/builds/${id}`);
}

/**
 * Prune old build cache
 * @param all Remove all cache
 * @param filters Filters for pruning
 * @returns Prune results
 */
export async function pruneBuildCache(
  all?: boolean,
  filters?: {
    until?: string;
    id?: string[];
    parent?: string;
    type?: string;
    description?: string;
    inuse?: boolean;
    shared?: boolean;
  }
): Promise<{
  cachesDeleted: string[];
  spaceReclaimed: number;
}> {
  const response = await api.post<
    ApiResponse<{
      cachesDeleted: string[];
      spaceReclaimed: number;
    }>
  >('/builds/prune', null, {
    params: { all, filters },
  });
  return extractData(response);
}

/**
 * Get build cache information
 * @returns Cache info
 */
export async function getBuildCacheInfo(): Promise<{
  size: number;
  cacheEntries: number;
}> {
  const response = await api.get<
    ApiResponse<{
      size: number;
      cacheEntries: number;
    }>
  >('/builds/cache');
  return extractData(response);
}
