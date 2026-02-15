import { describe, expect, it, beforeAll, afterAll, beforeEach } from 'vitest';
import Fastify from 'fastify';
import jwt from '@fastify/jwt';
import type { FastifyInstance } from 'fastify';
import { systemRoutes } from '../../src/routes/system.js';
import { initDatabase, getDatabase, saveNotificationChannel } from '../../src/services/database.js';
import {
  isValidTimezone,
  isValidIPv4,
  isValidIPv6,
  isValidUrl,
} from '../../src/utils/validation.js';
import { mkdirSync, rmSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEST_DATA_DIR = path.join(__dirname, '../../test-data-system');
const TEST_JWT_SECRET = 'test-jwt-secret-for-testing-purposes-only';

const adminUser = {
  id: 'admin-123',
  username: 'admin',
  role: 'admin' as const,
};

const operatorUser = {
  id: 'operator-123',
  username: 'operator',
  role: 'operator' as const,
};

describe('System Routes', () => {
  let app: FastifyInstance;
  let adminToken: string;
  let operatorToken: string;

  beforeAll(async () => {
    try {
      rmSync(TEST_DATA_DIR, { recursive: true, force: true });
    } catch {
      // Directory may not exist, ignore
    }
    mkdirSync(TEST_DATA_DIR, { recursive: true });

    process.env.MASTER_KEY = 'test-master-key-with-at-least-16-chars';
    process.env.DOCKPILOT_VERSION = '1.0.0';
    process.env.NODE_ENV = 'test';

    initDatabase(TEST_DATA_DIR);

    app = Fastify({ logger: false });
    await app.register(jwt, { secret: TEST_JWT_SECRET });

    app.addHook('onRequest', async (request) => {
      const authHeader = request.headers.authorization;
      if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        try {
          const decoded = app.jwt.verify(token) as { id: string; username: string; role: string };
          (request as { user?: typeof decoded }).user = decoded;
        } catch {
          // Token verification failed, ignore
        }
      }
    });

    await app.register(systemRoutes, { prefix: '/api' });

    adminToken = app.jwt.sign(adminUser);
    operatorToken = app.jwt.sign(operatorUser);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    try {
      rmSync(TEST_DATA_DIR, { recursive: true, force: true });
    } catch {
      // Directory may not exist, ignore
    }
  });

  beforeEach(async () => {
    const sqlite = await getDatabase();
    sqlite.prepare('DELETE FROM notification_channels').run();
    sqlite.prepare('DELETE FROM audit_logs').run();
  });

  describe('GET /api/system/settings', () => {
    it('should return system settings with default values', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/system/settings',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.data).toHaveProperty('instanceName', 'DockPilot');
      expect(body.data).toHaveProperty('timezone', 'UTC');
    });

    it('should return settings for authenticated operator', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/system/settings',
        headers: { authorization: `Bearer ${operatorToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
    });
  });

  describe('PUT /api/system/settings', () => {
    it('should update system settings as admin', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/api/system/settings',
        headers: {
          authorization: `Bearer ${adminToken}`,
          'content-type': 'application/json',
        },
        payload: {
          instanceName: 'TestInstance',
          timezone: 'America/New_York',
          autoUpdate: true,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.data.instanceName).toBe('TestInstance');
    });

    it('should reject update from non-admin user', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/api/system/settings',
        headers: {
          authorization: `Bearer ${operatorToken}`,
          'content-type': 'application/json',
        },
        payload: { instanceName: 'Hacked' },
      });

      expect(response.statusCode).toBe(403);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(false);
    });

    it('should validate timezone', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/api/system/settings',
        headers: {
          authorization: `Bearer ${adminToken}`,
          'content-type': 'application/json',
        },
        payload: { timezone: 'Invalid/Timezone' },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('GET /api/system/notifications/config', () => {
    it('should return notification channels', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/system/notifications/config',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
    });
  });

  describe('PUT /api/system/notifications/config', () => {
    it('should create notification channel', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/api/system/notifications/config',
        headers: {
          authorization: `Bearer ${adminToken}`,
          'content-type': 'application/json',
        },
        payload: {
          provider: 'smtp',
          name: 'Primary SMTP',
          enabled: true,
          config: {
            host: 'smtp.example.com',
            port: 587,
            username: 'user@example.com',
            password: 'secret-password',
            encryption: 'tls',
          },
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.data.provider).toBe('smtp');
    });

    it('should reject update from non-admin user', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/api/system/notifications/config',
        headers: {
          authorization: `Bearer ${operatorToken}`,
          'content-type': 'application/json',
        },
        payload: {
          provider: 'smtp',
          name: 'Test',
          enabled: true,
          config: {
            host: 'smtp.test.com',
            port: 587,
            username: 'test',
            password: 'test',
            encryption: 'tls',
          },
        },
      });

      expect(response.statusCode).toBe(403);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(false);
    });
  });
});

describe('Validation Utils', () => {
  describe('isValidTimezone', () => {
    it('should validate valid timezones', () => {
      expect(isValidTimezone('UTC')).toBe(true);
      expect(isValidTimezone('America/New_York')).toBe(true);
    });

    it('should reject invalid timezones', () => {
      expect(isValidTimezone('Invalid/Timezone')).toBe(false);
      expect(isValidTimezone('')).toBe(false);
    });
  });

  describe('isValidIPv4', () => {
    it('should validate valid IPv4 addresses', () => {
      expect(isValidIPv4('192.168.1.1')).toBe(true);
    });

    it('should reject invalid IPv4 addresses', () => {
      expect(isValidIPv4('256.1.1.1')).toBe(false);
    });

    it('should allow empty string', () => {
      expect(isValidIPv4('')).toBe(true);
    });
  });

  describe('isValidIPv6', () => {
    it('should validate valid IPv6 addresses', () => {
      expect(isValidIPv6('2001:0db8:85a3::8a2e:0370:7334')).toBe(true);
    });

    it('should allow empty string', () => {
      expect(isValidIPv6('')).toBe(true);
    });
  });

  describe('isValidUrl', () => {
    it('should validate valid URLs', () => {
      expect(isValidUrl('https://example.com')).toBe(true);
    });

    it('should allow empty string', () => {
      expect(isValidUrl('')).toBe(true);
    });
  });
});

describe('System Routes - Extended', () => {
  let app: FastifyInstance;
  let adminToken: string;

  beforeAll(async () => {
    try {
      rmSync(TEST_DATA_DIR, { recursive: true, force: true });
    } catch {
      // Directory may not exist, ignore
    }
    mkdirSync(TEST_DATA_DIR, { recursive: true });

    process.env.MASTER_KEY = 'test-master-key-with-at-least-16-chars';
    process.env.DOCKPILOT_VERSION = '1.0.0';
    process.env.NODE_ENV = 'test';

    initDatabase(TEST_DATA_DIR);

    app = Fastify({ logger: false });
    await app.register(jwt, { secret: TEST_JWT_SECRET });

    app.addHook('onRequest', async (request) => {
      const authHeader = request.headers.authorization;
      if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        try {
          const decoded = app.jwt.verify(token) as { id: string; username: string; role: string };
          (request as { user?: typeof decoded }).user = decoded;
        } catch {
          // Token verification failed, ignore
        }
      }
    });

    await app.register(systemRoutes, { prefix: '/api' });

    adminToken = app.jwt.sign(adminUser);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    try {
      rmSync(TEST_DATA_DIR, { recursive: true, force: true });
    } catch {
      // Directory may not exist, ignore
    }
  });

  beforeEach(async () => {
    const sqlite = await getDatabase();
    sqlite.prepare('DELETE FROM notification_channels').run();
    sqlite.prepare('DELETE FROM audit_logs').run();
  });

  describe('POST /api/system/notifications/test', () => {
    it('should return 404 when channel not configured', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/system/notifications/test',
        headers: {
          authorization: `Bearer ${adminToken}`,
          'content-type': 'application/json',
        },
        payload: {
          provider: 'slack',
        },
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('CHANNEL_NOT_FOUND');
    });

    it('should return 400 when channel is disabled', async () => {
      await saveNotificationChannel({
        provider: 'slack',
        name: 'Test Slack',
        enabled: false,
        config: JSON.stringify({ webhookUrl: 'https://hooks.slack.com/test' }),
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/system/notifications/test',
        headers: {
          authorization: `Bearer ${adminToken}`,
          'content-type': 'application/json',
        },
        payload: {
          provider: 'slack',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.payload);
      expect(body.error.code).toBe('CHANNEL_DISABLED');
    });

    it('should require testEmail for email providers', async () => {
      await saveNotificationChannel({
        provider: 'smtp',
        name: 'Test SMTP',
        enabled: true,
        config: JSON.stringify({ host: 'smtp.test.com' }),
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/system/notifications/test',
        headers: {
          authorization: `Bearer ${adminToken}`,
          'content-type': 'application/json',
        },
        payload: {
          provider: 'smtp',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.payload);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should validate testEmail format', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/system/notifications/test',
        headers: {
          authorization: `Bearer ${adminToken}`,
          'content-type': 'application/json',
        },
        payload: {
          provider: 'smtp',
          testEmail: 'invalid-email',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should reject testEmail same as admin username', async () => {
      await saveNotificationChannel({
        provider: 'smtp',
        name: 'Test SMTP',
        enabled: true,
        config: JSON.stringify({ host: 'smtp.test.com' }),
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/system/notifications/test',
        headers: {
          authorization: `Bearer ${adminToken}`,
          'content-type': 'application/json',
        },
        payload: {
          provider: 'smtp',
          testEmail: 'admin',
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('Rate Limiting', () => {
    it('should rate limit notification test requests', async () => {
      await saveNotificationChannel({
        provider: 'slack',
        name: 'Test Slack',
        enabled: true,
        config: JSON.stringify({ webhookUrl: 'https://hooks.slack.com/test' }),
      });

      const responses = [];
      for (let i = 0; i < 6; i++) {
        const response = await app.inject({
          method: 'POST',
          url: '/api/system/notifications/test',
          headers: {
            authorization: `Bearer ${adminToken}`,
            'content-type': 'application/json',
          },
          payload: {
            provider: 'slack',
          },
        });
        responses.push(response.statusCode);
      }

      expect(responses[5]).toBe(429);
    });
  });

  describe('Notification Config Validations', () => {
    it('should validate Resend API key format', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/api/system/notifications/config',
        headers: {
          authorization: `Bearer ${adminToken}`,
          'content-type': 'application/json',
        },
        payload: {
          provider: 'resend',
          name: 'Test Resend',
          enabled: true,
          config: {
            apiKey: 'invalid-key',
            fromAddress: 'test@example.com',
          },
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.payload);
      expect(body.error.message).toContain('Resend API key');
    });

    it('should validate Slack webhook URL', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/api/system/notifications/config',
        headers: {
          authorization: `Bearer ${adminToken}`,
          'content-type': 'application/json',
        },
        payload: {
          provider: 'slack',
          name: 'Test Slack',
          enabled: true,
          config: {
            webhookUrl: 'https://example.com/webhook',
          },
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.payload);
      expect(body.error.message).toContain('Slack webhook');
    });

    it('should validate Telegram bot token', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/api/system/notifications/config',
        headers: {
          authorization: `Bearer ${adminToken}`,
          'content-type': 'application/json',
        },
        payload: {
          provider: 'telegram',
          name: 'Test Telegram',
          enabled: true,
          config: {
            botToken: 'invalid-token',
            chatId: '123456',
          },
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should validate Discord webhook URL', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/api/system/notifications/config',
        headers: {
          authorization: `Bearer ${adminToken}`,
          'content-type': 'application/json',
        },
        payload: {
          provider: 'discord',
          name: 'Test Discord',
          enabled: true,
          config: {
            webhookUrl: 'https://example.com/webhook',
          },
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.payload);
      expect(body.error.message).toContain('Discord webhook');
    });
  });

  describe('Secret Masking', () => {
    it('should encrypt config in response', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/api/system/notifications/config',
        headers: {
          authorization: `Bearer ${adminToken}`,
          'content-type': 'application/json',
        },
        payload: {
          provider: 'smtp',
          name: 'Test SMTP',
          enabled: true,
          config: {
            host: 'smtp.gmail.com',
            port: 587,
            username: 'user@gmail.com',
            password: 'my-secret-password-123',
            encryption: 'starttls',
          },
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      // Config is encrypted as a single 'data' field
      expect(body.data.config.data).toBeDefined();
      expect(body.data.config.data.startsWith('enc:')).toBe(true);
      // Original password should not appear in plain text
      const responseStr = JSON.stringify(body);
      expect(responseStr).not.toContain('my-secret-password-123');
    });

    it('should encrypt Resend config with API key', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/api/system/notifications/config',
        headers: {
          authorization: `Bearer ${adminToken}`,
          'content-type': 'application/json',
        },
        payload: {
          provider: 'resend',
          name: 'Test Resend',
          enabled: true,
          config: {
            apiKey: 're_live_abcdefghijklmnopqrstuvwxyz',
            fromAddress: 'test@example.com',
          },
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      // Config is encrypted as a single 'data' field
      expect(body.data.config.data).toBeDefined();
      expect(body.data.config.data.startsWith('enc:')).toBe(true);
      // Original API key should not appear in plain text
      const responseStr = JSON.stringify(body);
      expect(responseStr).not.toContain('re_live_abcdefghijklmnopqrstuvwxyz');
    });
  });

  describe('System Version', () => {
    it('should return current version', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/system/version',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.data.currentVersion).toBeDefined();
    });
  });
});
