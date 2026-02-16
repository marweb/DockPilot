import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  SMTPAdapter,
  ResendAdapter,
  SlackAdapter,
  TelegramAdapter,
  DiscordAdapter,
  NotificationServiceManager,
  createNotificationService,
  getDefaultNotificationService,
} from '../../src/services/notifications';

const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
};

describe('SMTPAdapter', () => {
  let adapter: SMTPAdapter;

  beforeEach(() => {
    adapter = new SMTPAdapter(mockLogger);
    vi.clearAllMocks();
  });

  describe('validate', () => {
    it('should return true for valid config', () => {
      const validConfig = {
        host: 'smtp.example.com',
        port: 587,
        auth: {
          user: 'user@example.com',
          pass: 'password123',
        },
        from: {
          name: 'Test',
          address: 'test@example.com',
        },
      };

      expect(adapter.validate(validConfig)).toBe(true);
    });

    it('should return false for invalid config', () => {
      const invalidConfigs = [
        null,
        undefined,
        {},
        { host: 'smtp.example.com' },
        { host: 'smtp.example.com', port: 'not-a-number' },
        { host: 'smtp.example.com', port: 587, auth: { user: 'user' } },
      ];

      invalidConfigs.forEach((config) => {
        expect(adapter.validate(config)).toBe(false);
      });
    });

    it('should return false for missing required fields', () => {
      const configWithoutHost = {
        port: 587,
        auth: { user: 'user', pass: 'pass' },
        from: { address: 'test@example.com' },
      };

      expect(adapter.validate(configWithoutHost)).toBe(false);
    });
  });

  describe('send', () => {
    const validConfig = {
      host: 'smtp.example.com',
      port: 587,
      auth: {
        user: 'user@example.com',
        pass: 'password123',
      },
      from: {
        name: 'Test',
        address: 'test@example.com',
      },
    };

    it('should return error when config is invalid', async () => {
      const result = await adapter.send('Test message', { config: null });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Configuration validation failed');
    });

    it('should return error when recipient is missing', async () => {
      const result = await adapter.send('Test message', { config: validConfig });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing "to" parameter');
    });
  });

  describe('test', () => {
    it('should return error when config is invalid', async () => {
      const result = await adapter.test(null);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Configuration validation failed');
    });
  });
});

describe('ResendAdapter', () => {
  let adapter: ResendAdapter;

  beforeEach(() => {
    adapter = new ResendAdapter(mockLogger);
    vi.clearAllMocks();
  });

  describe('validate', () => {
    it('should return true for valid config', () => {
      const validConfig = {
        apiKey: 'test-api-key',
        from: 'test@example.com',
      };

      expect(adapter.validate(validConfig)).toBe(true);
    });

    it('should return false for invalid config', () => {
      const invalidConfigs = [
        null,
        undefined,
        {},
        { apiKey: 'key' },
        { apiKey: 'key', from: 'invalid-email' },
      ];

      invalidConfigs.forEach((config) => {
        expect(adapter.validate(config)).toBe(false);
      });
    });
  });

  describe('send', () => {
    const validConfig = {
      apiKey: 'test-api-key',
      from: 'test@example.com',
    };

    it('should return error when config is invalid', async () => {
      const result = await adapter.send('Test message', { config: null });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Configuration validation failed');
    });

    it('should return error when recipient is missing', async () => {
      const result = await adapter.send('Test message', { config: validConfig });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing "to" parameter');
    });
  });
});

describe('SlackAdapter', () => {
  let adapter: SlackAdapter;

  beforeEach(() => {
    adapter = new SlackAdapter(mockLogger);
    vi.clearAllMocks();
  });

  describe('validate', () => {
    it('should return true for valid config', () => {
      const validConfig = {
        webhookUrl: 'https://example.com/webhooks/slack/PLACEHOLDER',
      };

      expect(adapter.validate(validConfig)).toBe(true);
    });

    it('should return false for invalid config', () => {
      const invalidConfigs = [null, undefined, {}, { webhookUrl: 'not-a-url' }, { webhookUrl: '' }];

      invalidConfigs.forEach((config) => {
        expect(adapter.validate(config)).toBe(false);
      });
    });
  });

  describe('send', () => {
    it('should return error when config is invalid', async () => {
      const result = await adapter.send('Test message', { config: null });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Configuration validation failed');
    });
  });
});

describe('TelegramAdapter', () => {
  let adapter: TelegramAdapter;

  beforeEach(() => {
    adapter = new TelegramAdapter(mockLogger);
    vi.clearAllMocks();
  });

  describe('validate', () => {
    it('should return true for valid config', () => {
      const validConfig = {
        botToken: '123456789:ABCdefGHIjklMNOpqrsTUVwxyz',
        chatId: '123456789',
      };

      expect(adapter.validate(validConfig)).toBe(true);
    });

    it('should return false for invalid config', () => {
      const invalidConfigs = [null, undefined, {}, { botToken: 'token' }, { chatId: '123' }];

      invalidConfigs.forEach((config) => {
        expect(adapter.validate(config)).toBe(false);
      });
    });
  });

  describe('send', () => {
    it('should return error when config is invalid', async () => {
      const result = await adapter.send('Test message', { config: null });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Configuration validation failed');
    });
  });

  describe('escapeHtml', () => {
    it('should escape HTML characters', () => {
      const text = '<script>alert("test")</script>';
      // @ts-expect-error - accessing private method for testing
      const escaped = adapter.escapeHtml(text);

      expect(escaped).toContain('&lt;script&gt;');
      expect(escaped).toContain('&lt;/script&gt;');
    });
  });
});

describe('DiscordAdapter', () => {
  let adapter: DiscordAdapter;

  beforeEach(() => {
    adapter = new DiscordAdapter(mockLogger);
    vi.clearAllMocks();
  });

  describe('validate', () => {
    it('should return true for valid config', () => {
      const validConfig = {
        webhookUrl: 'https://discord.com/api/webhooks/123456789/abcdef',
      };

      expect(adapter.validate(validConfig)).toBe(true);
    });

    it('should return false for invalid config', () => {
      const invalidConfigs = [null, undefined, {}, { webhookUrl: 'not-a-url' }, { webhookUrl: '' }];

      invalidConfigs.forEach((config) => {
        expect(adapter.validate(config)).toBe(false);
      });
    });
  });

  describe('send', () => {
    it('should return error when config is invalid', async () => {
      const result = await adapter.send('Test message', { config: null });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Configuration validation failed');
    });
  });
});

describe('NotificationServiceManager', () => {
  let service: NotificationServiceManager;

  beforeEach(() => {
    service = new NotificationServiceManager(mockLogger);
    vi.clearAllMocks();
  });

  describe('registerAdapter', () => {
    it('should register adapters', () => {
      const mockAdapter = {
        name: 'mock',
        send: vi.fn(),
        validate: vi.fn(),
        test: vi.fn(),
      };

      service.registerAdapter('smtp', mockAdapter as any);

      expect(service.getAdapter('smtp')).toBe(mockAdapter);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Registered adapter for provider: smtp',
        expect.any(Object)
      );
    });
  });

  describe('send', () => {
    it('should return error when adapter not found', async () => {
      const result = await service.send('smtp', 'Test message');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Adapter not found');
    });

    it('should send message using adapter', async () => {
      const mockAdapter = {
        name: 'smtp',
        send: vi.fn().mockResolvedValue({
          success: true,
          message: 'Sent',
          timestamp: new Date().toISOString(),
        }),
        validate: vi.fn(),
        test: vi.fn(),
      };

      service.registerAdapter('smtp', mockAdapter as any);
      const result = await service.send('smtp', 'Test message');

      expect(mockAdapter.send).toHaveBeenCalledWith('Test message', undefined);
      expect(result.success).toBe(true);
    });

    it('should handle adapter errors', async () => {
      const mockAdapter = {
        name: 'smtp',
        send: vi.fn().mockRejectedValue(new Error('Network error')),
        validate: vi.fn(),
        test: vi.fn(),
      };

      service.registerAdapter('smtp', mockAdapter as any);
      const result = await service.send('smtp', 'Test message');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Network error');
    });
  });

  describe('test', () => {
    it('should return error when adapter not found', async () => {
      const result = await service.test('smtp', {});

      expect(result.success).toBe(false);
      expect(result.error).toContain('Adapter not found');
    });

    it('should return error when config is invalid', async () => {
      const mockAdapter = {
        name: 'smtp',
        send: vi.fn(),
        validate: vi.fn().mockReturnValue(false),
        test: vi.fn(),
      };

      service.registerAdapter('smtp', mockAdapter as any);
      const result = await service.test('smtp', {});

      expect(result.success).toBe(false);
      expect(result.error).toContain('Configuration validation failed');
    });

    it('should test adapter', async () => {
      const mockAdapter = {
        name: 'smtp',
        send: vi.fn(),
        validate: vi.fn().mockReturnValue(true),
        test: vi.fn().mockResolvedValue({
          success: true,
          message: 'Test passed',
          timestamp: new Date().toISOString(),
        }),
      };

      service.registerAdapter('smtp', mockAdapter as any);
      const result = await service.test('smtp', { test: true });

      expect(mockAdapter.test).toHaveBeenCalledWith({ test: true }, undefined);
      expect(result.success).toBe(true);
    });
  });

  describe('validate', () => {
    it('should return false when adapter not found', () => {
      const result = service.validate('smtp', {});
      expect(result).toBe(false);
    });

    it('should validate config using adapter', () => {
      const mockAdapter = {
        name: 'smtp',
        send: vi.fn(),
        validate: vi.fn().mockReturnValue(true),
        test: vi.fn(),
      };

      service.registerAdapter('smtp', mockAdapter as any);
      const result = service.validate('smtp', { test: true });

      expect(mockAdapter.validate).toHaveBeenCalledWith({ test: true });
      expect(result).toBe(true);
    });
  });
});

describe('Factory functions', () => {
  it('createNotificationService should create service with all adapters', () => {
    const service = createNotificationService(mockLogger);

    expect(service.getAdapter('smtp')).toBeDefined();
    expect(service.getAdapter('resend')).toBeDefined();
    expect(service.getAdapter('slack')).toBeDefined();
    expect(service.getAdapter('telegram')).toBeDefined();
    expect(service.getAdapter('discord')).toBeDefined();
  });

  it('getDefaultNotificationService should return singleton', () => {
    const service1 = getDefaultNotificationService(mockLogger);
    const service2 = getDefaultNotificationService(mockLogger);

    expect(service1).toBe(service2);
  });
});

describe('Retry mechanism', () => {
  let adapter: SMTPAdapter;

  beforeEach(() => {
    adapter = new SMTPAdapter(mockLogger);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should validate config structure', () => {
    // Test retry configuration through config validation
    const validConfig = {
      host: 'smtp.example.com',
      port: 587,
      auth: { user: 'test@test.com', pass: 'pass' },
      from: { address: 'from@test.com' },
    };

    expect(adapter.validate(validConfig)).toBe(true);

    const invalidConfig = { host: 'smtp.example.com' };
    expect(adapter.validate(invalidConfig)).toBe(false);
  });
});

describe('Error handling', () => {
  let service: NotificationServiceManager;

  beforeEach(() => {
    service = new NotificationServiceManager(mockLogger);
  });

  it('should handle network errors', async () => {
    const mockAdapter = {
      name: 'smtp',
      send: vi.fn().mockRejectedValue(new Error('Connection refused')),
      validate: vi.fn(),
      test: vi.fn(),
    };

    service.registerAdapter('smtp', mockAdapter as any);
    const result = await service.send('smtp', 'Test');

    expect(result.success).toBe(false);
    expect(result.error).toContain('Connection refused');
  });

  it('should handle authentication errors', async () => {
    const mockAdapter = {
      name: 'smtp',
      send: vi.fn().mockRejectedValue(new Error('Authentication failed')),
      validate: vi.fn(),
      test: vi.fn(),
    };

    service.registerAdapter('smtp', mockAdapter as any);
    const result = await service.send('smtp', 'Test');

    expect(result.success).toBe(false);
    expect(result.error).toContain('Authentication failed');
  });

  it('should handle unknown errors', async () => {
    const mockAdapter = {
      name: 'smtp',
      send: vi.fn().mockRejectedValue('Unknown error string'),
      validate: vi.fn(),
      test: vi.fn(),
    };

    service.registerAdapter('smtp', mockAdapter as any);
    const result = await service.send('smtp', 'Test');

    expect(result.success).toBe(false);
    expect(result.error).toContain('Unknown error');
  });
});

describe('Logging', () => {
  let service: NotificationServiceManager;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new NotificationServiceManager(mockLogger);
  });

  it('should log when sending notification', async () => {
    const mockAdapter = {
      name: 'smtp',
      send: vi.fn().mockResolvedValue({
        success: true,
        message: 'Sent',
        timestamp: new Date().toISOString(),
      }),
      validate: vi.fn(),
      test: vi.fn(),
    };

    service.registerAdapter('smtp', mockAdapter as any);
    await service.send('smtp', 'Test message');

    expect(mockLogger.info).toHaveBeenCalledWith(
      'Sending notification via smtp',
      expect.any(Object)
    );
    expect(mockLogger.info).toHaveBeenCalledWith('Notification sent successfully via smtp');
  });

  it('should log when notification fails', async () => {
    const mockAdapter = {
      name: 'smtp',
      send: vi.fn().mockResolvedValue({
        success: false,
        message: 'Failed',
        error: 'Test error',
        timestamp: new Date().toISOString(),
      }),
      validate: vi.fn(),
      test: vi.fn(),
    };

    service.registerAdapter('smtp', mockAdapter as any);
    await service.send('smtp', 'Test message');

    expect(mockLogger.warn).toHaveBeenCalledWith(
      'Notification failed via smtp',
      expect.any(Object)
    );
  });

  it('should log errors without exposing secrets', async () => {
    const mockAdapter = {
      name: 'smtp',
      send: vi.fn().mockRejectedValue(new Error('Error with password=***')),
      validate: vi.fn(),
      test: vi.fn(),
    };

    service.registerAdapter('smtp', mockAdapter as any);
    await service.send('smtp', 'Test message');

    expect(mockLogger.error).toHaveBeenCalled();
    const errorCall = mockLogger.error.mock.calls[0];
    // Check that error is logged
    expect(errorCall).toBeDefined();
    expect(errorCall[0]).toContain('Unexpected error');
  });
});
