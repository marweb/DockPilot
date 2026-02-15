import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';
import api from '../client';
import {
  getNotificationChannels,
  saveNotificationChannel,
  sendTestNotification,
  getSMTPConfig,
  getResendConfig,
  getSlackConfig,
  getTelegramConfig,
  getDiscordConfig,
  type NotificationProvider,
  type SaveNotificationChannelInput,
} from '../notifications';

// Mock the api client
vi.mock('../client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

describe('Notifications API', () => {
  const mockApi = api as unknown as { get: Mock; post: Mock };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getNotificationChannels', () => {
    it('should fetch all notification channels successfully', async () => {
      const mockChannels = [
        {
          id: '1',
          provider: 'smtp' as NotificationProvider,
          name: 'SMTP Server',
          enabled: true,
          configured: true,
          host: 'smtp.example.com',
          port: 587,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
        {
          id: '2',
          provider: 'slack' as NotificationProvider,
          name: 'Slack Webhook',
          enabled: false,
          configured: false,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
      ];

      mockApi.get.mockResolvedValueOnce({
        data: {
          success: true,
          data: mockChannels,
        },
      });

      const result = await getNotificationChannels();

      expect(mockApi.get).toHaveBeenCalledWith('/notifications/channels');
      expect(result).toEqual(mockChannels);
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

      await expect(getNotificationChannels()).rejects.toMatchObject({
        statusCode: 403,
        code: 'FORBIDDEN',
      });
    });

    it('should handle network errors', async () => {
      mockApi.get.mockRejectedValueOnce(new Error('Network Error'));

      await expect(getNotificationChannels()).rejects.toBeDefined();
    });
  });

  describe('saveNotificationChannel', () => {
    const mockConfig: SaveNotificationChannelInput = {
      name: 'SMTP Server',
      enabled: true,
      host: 'smtp.example.com',
      port: 587,
      username: 'user',
      password: 'secret123',
      useTLS: true,
    };

    it('should save notification channel successfully', async () => {
      const mockResponse = {
        id: '1',
        provider: 'smtp' as NotificationProvider,
        name: mockConfig.name,
        enabled: mockConfig.enabled,
        host: mockConfig.host,
        port: mockConfig.port,
        username: mockConfig.username,
        useTLS: mockConfig.useTLS,
        configured: true,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      mockApi.post.mockResolvedValueOnce({
        data: {
          success: true,
          data: mockResponse,
        },
      });

      const result = await saveNotificationChannel('smtp', mockConfig);

      expect(mockApi.post).toHaveBeenCalledWith('/notifications/channels/smtp', mockConfig);
      expect(result).toEqual(mockResponse);
    });

    it('should handle validation errors', async () => {
      mockApi.post.mockRejectedValueOnce({
        response: {
          status: 422,
          data: {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid port number',
            },
          },
        },
      });

      await expect(saveNotificationChannel('smtp', mockConfig)).rejects.toMatchObject({
        statusCode: 422,
        code: 'VALIDATION_ERROR',
      });
    });

    it('should handle all provider types', async () => {
      const providers: NotificationProvider[] = ['smtp', 'resend', 'slack', 'telegram', 'discord'];

      for (const provider of providers) {
        vi.clearAllMocks();

        const config: SaveNotificationChannelInput = {
          name: `${provider} Config`,
          enabled: true,
        };

        mockApi.post.mockResolvedValueOnce({
          data: {
            success: true,
            data: {
              id: '1',
              provider,
              name: config.name,
              enabled: config.enabled,
              configured: true,
              createdAt: '2024-01-01T00:00:00Z',
              updatedAt: '2024-01-01T00:00:00Z',
            },
          },
        });

        await saveNotificationChannel(provider, config);
        expect(mockApi.post).toHaveBeenCalledWith(`/notifications/channels/${provider}`, config);
      }
    });
  });

  describe('sendTestNotification', () => {
    it('should send test notification successfully', async () => {
      mockApi.post.mockResolvedValueOnce({
        data: {
          success: true,
          data: {
            success: true,
            message: 'Test notification sent successfully',
          },
        },
      });

      const result = await sendTestNotification('smtp', 'test@example.com');

      expect(mockApi.post).toHaveBeenCalledWith('/notifications/test/smtp', {
        testEmail: 'test@example.com',
      });
      expect(result).toEqual({
        success: true,
        message: 'Test notification sent successfully',
      });
    });

    it('should send test with custom message', async () => {
      mockApi.post.mockResolvedValueOnce({
        data: {
          success: true,
          data: {
            success: true,
            message: 'Custom test message sent',
          },
        },
      });

      await sendTestNotification('slack', undefined, 'Custom test');

      expect(mockApi.post).toHaveBeenCalledWith('/notifications/test/slack', {
        testMessage: 'Custom test',
      });
    });

    it('should handle provider not configured error', async () => {
      mockApi.post.mockRejectedValueOnce({
        response: {
          status: 400,
          data: {
            success: false,
            error: {
              code: 'BAD_REQUEST',
              message: 'Provider not configured',
            },
          },
        },
      });

      await expect(sendTestNotification('smtp')).rejects.toMatchObject({
        statusCode: 400,
        code: 'BAD_REQUEST',
      });
    });

    it('should handle server errors', async () => {
      mockApi.post.mockRejectedValueOnce({
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

      await expect(sendTestNotification('smtp')).rejects.toMatchObject({
        statusCode: 500,
      });
    });
  });

  describe('Helper functions', () => {
    const mockChannels = [
      {
        id: '1',
        provider: 'smtp' as NotificationProvider,
        name: 'SMTP',
        enabled: true,
        configured: true,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      },
      {
        id: '2',
        provider: 'slack' as NotificationProvider,
        name: 'Slack',
        enabled: true,
        configured: true,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      },
    ];

    beforeEach(() => {
      mockApi.get.mockResolvedValue({
        data: {
          success: true,
          data: mockChannels,
        },
      });
    });

    describe('getSMTPConfig', () => {
      it('should return SMTP config when found', async () => {
        const result = await getSMTPConfig();
        expect(result?.provider).toBe('smtp');
      });

      it('should return null when not found', async () => {
        mockApi.get.mockResolvedValueOnce({
          data: {
            success: true,
            data: [],
          },
        });

        const result = await getSMTPConfig();
        expect(result).toBeNull();
      });
    });

    describe('getResendConfig', () => {
      it('should return Resend config when found', async () => {
        const channels = [
          {
            id: '1',
            provider: 'resend' as NotificationProvider,
            name: 'Resend',
            enabled: true,
            configured: true,
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z',
          },
        ];

        mockApi.get.mockResolvedValueOnce({
          data: {
            success: true,
            data: channels,
          },
        });

        const result = await getResendConfig();
        expect(result?.provider).toBe('resend');
      });
    });

    describe('getSlackConfig', () => {
      it('should return Slack config when found', async () => {
        const result = await getSlackConfig();
        expect(result?.provider).toBe('slack');
      });
    });

    describe('getTelegramConfig', () => {
      it('should return null when Telegram not configured', async () => {
        mockApi.get.mockResolvedValueOnce({
          data: {
            success: true,
            data: [],
          },
        });

        const result = await getTelegramConfig();
        expect(result).toBeNull();
      });
    });

    describe('getDiscordConfig', () => {
      it('should return null when Discord not configured', async () => {
        const result = await getDiscordConfig();
        expect(result).toBeNull();
      });
    });
  });

  describe('Type safety', () => {
    it('should enforce NotificationProvider type', () => {
      const validProviders: NotificationProvider[] = [
        'smtp',
        'resend',
        'slack',
        'telegram',
        'discord',
      ];

      expect(validProviders).toHaveLength(5);
    });

    it('should ensure sensitive data is not exposed', async () => {
      const mockResponse = {
        id: '1',
        provider: 'smtp',
        name: 'SMTP',
        enabled: true,
        configured: true,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      mockApi.post.mockResolvedValueOnce({
        data: {
          success: true,
          data: mockResponse,
        },
      });

      const result = await saveNotificationChannel('smtp', {
        name: 'SMTP',
        enabled: true,
        apiKey: 'secret',
        password: 'secret',
      });

      // Verify that secrets are not in the response
      expect(result).not.toHaveProperty('apiKey');
      expect(result).not.toHaveProperty('password');
      expect(result).not.toHaveProperty('botToken');
    });
  });
});
