import api, { extractData } from './client';
import type { ApiResponse } from '@dockpilot/types';

/**
 * System settings configuration
 */
export interface SystemSettings {
  instanceName: string;
  publicUrl: string;
  timezone: string;
  publicIPv4: string;
  publicIPv6: string;
  autoUpdate: boolean;
}

/**
 * Input type for updating system settings
 * All fields are optional for partial updates
 */
export interface SystemSettingsInput {
  instanceName?: string;
  publicUrl?: string;
  timezone?: string;
  publicIPv4?: string;
  publicIPv6?: string;
  autoUpdate?: boolean;
}

/**
 * Get current system settings
 * @returns Current system settings
 * @throws ApiError with code FORBIDDEN if user is not admin
 */
export async function getSystemSettings(): Promise<SystemSettings> {
  const response = await api.get<ApiResponse<SystemSettings>>('/settings/system');
  return extractData(response);
}

/**
 * Update system settings
 * @param settings Partial settings to update
 * @returns Updated system settings
 * @throws ApiError with code FORBIDDEN if user is not admin
 * @throws ApiError with code VALIDATION_ERROR if validation fails
 */
export async function updateSystemSettings(settings: SystemSettingsInput): Promise<SystemSettings> {
  const response = await api.put<ApiResponse<SystemSettings>>('/settings/system', settings);
  return extractData(response);
}
