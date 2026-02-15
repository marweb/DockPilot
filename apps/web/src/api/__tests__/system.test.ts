import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';
import api from '../client';
import {
  getSystemSettings,
  updateSystemSettings,
  type SystemSettings,
  type SystemSettingsInput,
} from '../system';

// Mock the api client
vi.mock('../client', () => ({
  default: {
    get: vi.fn(),
    put: vi.fn(),
  },
}));

describe('System Settings API', () => {
  const mockApi = api as unknown as { get: Mock; put: Mock };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getSystemSettings', () => {
    it('should fetch system settings successfully', async () => {
      const mockSettings: SystemSettings = {
        instanceName: 'DockerPilot',
        publicUrl: 'https://example.com',
        timezone: 'UTC',
        publicIPv4: '1.2.3.4',
        publicIPv6: '::1',
        autoUpdate: true,
      };

      mockApi.get.mockResolvedValueOnce({
        data: {
          success: true,
          data: mockSettings,
        },
      });

      const result = await getSystemSettings();

      expect(mockApi.get).toHaveBeenCalledWith('/settings/system');
      expect(result).toEqual(mockSettings);
    });

    it('should handle 403 Forbidden error', async () => {
      mockApi.get.mockRejectedValueOnce({
        response: {
          status: 403,
          data: {
            success: false,
            error: {
              code: 'FORBIDDEN',
              message: 'Admin access required',
            },
          },
        },
      });

      await expect(getSystemSettings()).rejects.toMatchObject({
        statusCode: 403,
        code: 'FORBIDDEN',
      });
    });

    it('should handle 404 Not Found', async () => {
      mockApi.get.mockRejectedValueOnce({
        response: {
          status: 404,
          data: {
            success: false,
            error: {
              code: 'NOT_FOUND',
              message: 'Settings not found',
            },
          },
        },
      });

      await expect(getSystemSettings()).rejects.toMatchObject({
        statusCode: 404,
      });
    });

    it('should handle server errors', async () => {
      mockApi.get.mockRejectedValueOnce({
        response: {
          status: 500,
          data: {
            success: false,
            error: {
              code: 'INTERNAL_ERROR',
              message: 'Server error, please try again',
            },
          },
        },
      });

      await expect(getSystemSettings()).rejects.toMatchObject({
        statusCode: 500,
      });
    });

    it('should handle network errors', async () => {
      mockApi.get.mockRejectedValueOnce(new Error('Network Error'));

      await expect(getSystemSettings()).rejects.toBeDefined();
    });
  });

  describe('updateSystemSettings', () => {
    it('should update all settings successfully', async () => {
      const input: SystemSettingsInput = {
        instanceName: 'New Name',
        publicUrl: 'https://new.example.com',
        timezone: 'America/New_York',
        publicIPv4: '5.6.7.8',
        publicIPv6: '::2',
        autoUpdate: false,
      };

      const mockResponse: SystemSettings = {
        instanceName: 'New Name',
        publicUrl: 'https://new.example.com',
        timezone: 'America/New_York',
        publicIPv4: '5.6.7.8',
        publicIPv6: '::2',
        autoUpdate: false,
      };

      mockApi.put.mockResolvedValueOnce({
        data: {
          success: true,
          data: mockResponse,
        },
      });

      const result = await updateSystemSettings(input);

      expect(mockApi.put).toHaveBeenCalledWith('/settings/system', input);
      expect(result).toEqual(mockResponse);
    });

    it('should support partial updates', async () => {
      const input: SystemSettingsInput = {
        instanceName: 'Updated Name',
      };

      const mockResponse: SystemSettings = {
        instanceName: 'Updated Name',
        publicUrl: 'https://example.com',
        timezone: 'UTC',
        publicIPv4: '1.2.3.4',
        publicIPv6: '::1',
        autoUpdate: true,
      };

      mockApi.put.mockResolvedValueOnce({
        data: {
          success: true,
          data: mockResponse,
        },
      });

      const result = await updateSystemSettings(input);

      expect(mockApi.put).toHaveBeenCalledWith('/settings/system', input);
      expect(result.instanceName).toBe('Updated Name');
    });

    it('should handle validation errors', async () => {
      const input: SystemSettingsInput = {
        publicUrl: 'invalid-url',
      };

      mockApi.put.mockRejectedValueOnce({
        response: {
          status: 422,
          data: {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid URL format',
            },
          },
        },
      });

      await expect(updateSystemSettings(input)).rejects.toMatchObject({
        statusCode: 422,
        code: 'VALIDATION_ERROR',
      });
    });

    it('should handle 403 Forbidden error', async () => {
      mockApi.put.mockRejectedValueOnce({
        response: {
          status: 403,
          data: {
            success: false,
            error: {
              code: 'FORBIDDEN',
              message: 'Admin access required',
            },
          },
        },
      });

      await expect(updateSystemSettings({})).rejects.toMatchObject({
        statusCode: 403,
        code: 'FORBIDDEN',
      });
    });
  });

  describe('Type safety', () => {
    it('should enforce SystemSettings interface', () => {
      const settings: SystemSettings = {
        instanceName: 'Test',
        publicUrl: 'https://test.com',
        timezone: 'UTC',
        publicIPv4: '1.2.3.4',
        publicIPv6: '::1',
        autoUpdate: true,
      };

      expect(settings.instanceName).toBe('Test');
      expect(settings.autoUpdate).toBe(true);
    });

    it('should allow partial input for updates', () => {
      const partial1: SystemSettingsInput = {
        instanceName: 'Test',
      };

      const partial2: SystemSettingsInput = {
        publicUrl: 'https://test.com',
        timezone: 'UTC',
      };

      const partial3: SystemSettingsInput = {};

      expect(partial1).toBeDefined();
      expect(partial2).toBeDefined();
      expect(partial3).toBeDefined();
    });
  });
});
