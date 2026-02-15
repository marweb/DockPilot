import { describe, expect, it, beforeAll, afterAll, beforeEach } from 'vitest';
import { existsSync, rmSync } from 'fs';
import path from 'path';
import {
  initDatabase,
  getSetting,
  setSetting,
  getAllSettings,
  getNotificationChannels,
  getNotificationChannel,
  saveNotificationChannel,
  deleteNotificationChannel,
  type NotificationProvider,
} from '../../src/services/database.js';

const TEST_DATA_DIR = path.join(process.cwd(), 'test-data');

describe('database - settings and channels', () => {
  beforeAll(() => {
    initDatabase(TEST_DATA_DIR);
  });

  afterAll(() => {
    if (existsSync(TEST_DATA_DIR)) {
      rmSync(TEST_DATA_DIR, { recursive: true, force: true });
    }
  });

  describe('Settings', () => {
    beforeEach(async () => {
      const sqlite = await import('../../src/services/database.js').then((m) => m.getDatabase());
      sqlite.prepare('DELETE FROM system_settings').run();
    });

    describe('setSetting', () => {
      it('should create a new setting with default string type', async () => {
        await setSetting('test_key', 'test_value');
        const setting = await getSetting('test_key');

        expect(setting).not.toBeNull();
        expect(setting?.key).toBe('test_key');
        expect(setting?.value).toBe('test_value');
        expect(setting?.type).toBe('string');
      });

      it('should create a setting with number type', async () => {
        await setSetting('port', '8080', 'number', 'Server port');
        const setting = await getSetting('port');

        expect(setting?.type).toBe('number');
        expect(setting?.description).toBe('Server port');
      });

      it('should create a setting with boolean type', async () => {
        await setSetting('enabled', 'true', 'boolean');
        const setting = await getSetting('enabled');

        expect(setting?.type).toBe('boolean');
      });

      it('should create a setting with json type', async () => {
        const jsonValue = JSON.stringify({ nested: 'value' });
        await setSetting('config', jsonValue, 'json');
        const setting = await getSetting('config');

        expect(setting?.type).toBe('json');
        expect(setting?.value).toBe(jsonValue);
      });

      it('should update existing setting', async () => {
        await setSetting('update_test', 'initial', 'string');
        await setSetting('update_test', 'updated', 'string', 'Updated description');
        const setting = await getSetting('update_test');

        expect(setting?.value).toBe('updated');
        expect(setting?.description).toBe('Updated description');
      });

      it('should throw error for invalid type', async () => {
        await expect(setSetting('invalid', 'value', 'invalid' as any)).rejects.toThrow(
          'Invalid setting type'
        );
      });
    });

    describe('getSetting', () => {
      it('should return null for non-existent setting', async () => {
        const setting = await getSetting('non_existent');
        expect(setting).toBeNull();
      });

      it('should return setting with timestamps', async () => {
        await setSetting('timestamp_test', 'value');
        const setting = await getSetting('timestamp_test');

        expect(setting?.createdAt).toBeInstanceOf(Date);
        expect(setting?.updatedAt).toBeInstanceOf(Date);
      });
    });

    describe('getAllSettings', () => {
      it('should return empty array when no settings', async () => {
        const settings = await getAllSettings();
        expect(settings).toEqual([]);
      });

      it('should return all settings sorted by key', async () => {
        await setSetting('zebra', 'z', 'string');
        await setSetting('alpha', 'a', 'string');
        await setSetting('beta', 'b', 'string');

        const settings = await getAllSettings();
        const keys = settings.map((s) => s.key);

        expect(keys).toEqual(['alpha', 'beta', 'zebra']);
      });

      it('should return complete setting objects', async () => {
        await setSetting('complete', 'value', 'string', 'A description');
        const settings = await getAllSettings();

        expect(settings).toHaveLength(1);
        expect(settings[0]).toMatchObject({
          key: 'complete',
          value: 'value',
          type: 'string',
          description: 'A description',
        });
      });
    });
  });

  describe('Notification Channels', () => {
    beforeEach(async () => {
      const sqlite = await import('../../src/services/database.js').then((m) => m.getDatabase());
      sqlite.prepare('DELETE FROM notification_channels').run();
    });

    describe('saveNotificationChannel', () => {
      it('should create a new channel', async () => {
        const channel = await saveNotificationChannel({
          provider: 'smtp',
          name: 'SMTP Server',
          enabled: true,
          config: JSON.stringify({ host: 'smtp.example.com' }),
          fromName: 'DockPilot',
          fromAddress: 'noreply@example.com',
        });

        expect(channel.id).toBeDefined();
        expect(channel.provider).toBe('smtp');
        expect(channel.name).toBe('SMTP Server');
        expect(channel.enabled).toBe(true);
        expect(channel.createdAt).toBeInstanceOf(Date);
        expect(channel.updatedAt).toBeInstanceOf(Date);
      });

      it('should create channels with all valid providers', async () => {
        const providers: NotificationProvider[] = [
          'smtp',
          'resend',
          'slack',
          'telegram',
          'discord',
        ];

        for (const provider of providers) {
          const channel = await saveNotificationChannel({
            provider,
            name: `${provider} Channel`,
            enabled: false,
            config: '{}',
          });

          expect(channel.provider).toBe(provider);
        }
      });

      it('should throw error for invalid provider', async () => {
        await expect(
          saveNotificationChannel({
            provider: 'invalid' as any,
            name: 'Invalid',
            enabled: false,
            config: '{}',
          })
        ).rejects.toThrow('Invalid provider');
      });

      it('should update existing channel', async () => {
        const created = await saveNotificationChannel({
          provider: 'smtp',
          name: 'Original Name',
          enabled: true,
          config: '{}',
        });

        const updated = await saveNotificationChannel({
          id: created.id,
          provider: 'smtp',
          name: 'Updated Name',
          enabled: false,
          config: '{}',
        });

        expect(updated.id).toBe(created.id);
        expect(updated.name).toBe('Updated Name');
        expect(updated.enabled).toBe(false);
      });

      it('should store enabled as boolean', async () => {
        await saveNotificationChannel({
          provider: 'smtp',
          name: 'Test',
          enabled: true,
          config: '{}',
        });

        const channel = await getNotificationChannel('smtp');
        expect(channel?.enabled).toBe(true);
      });

      it('should store optional fields as undefined when not provided', async () => {
        const channel = await saveNotificationChannel({
          provider: 'slack',
          name: 'Slack Webhook',
          enabled: true,
          config: '{}',
        });

        expect(channel.fromName).toBeUndefined();
        expect(channel.fromAddress).toBeUndefined();
      });
    });

    describe('getNotificationChannels', () => {
      it('should return empty array when no channels', async () => {
        const channels = await getNotificationChannels();
        expect(channels).toEqual([]);
      });

      it('should return all channels sorted by name', async () => {
        await saveNotificationChannel({
          provider: 'slack',
          name: 'Z Channel',
          enabled: false,
          config: '{}',
        });
        await saveNotificationChannel({
          provider: 'smtp',
          name: 'A Channel',
          enabled: false,
          config: '{}',
        });

        const channels = await getNotificationChannels();
        const names = channels.map((c) => c.name);

        expect(names).toEqual(['A Channel', 'Z Channel']);
      });
    });

    describe('getNotificationChannel', () => {
      it('should return null for non-existent provider', async () => {
        const channel = await getNotificationChannel('smtp');
        expect(channel).toBeNull();
      });

      it('should return channel by provider', async () => {
        await saveNotificationChannel({
          provider: 'telegram',
          name: 'Telegram Bot',
          enabled: true,
          config: JSON.stringify({ token: 'secret' }),
        });

        const channel = await getNotificationChannel('telegram');

        expect(channel).not.toBeNull();
        expect(channel?.provider).toBe('telegram');
        expect(channel?.config).toBe('{"token":"secret"}');
      });
    });

    describe('deleteNotificationChannel', () => {
      it('should return false for non-existent channel', async () => {
        const result = await deleteNotificationChannel('non-existent-id');
        expect(result).toBe(false);
      });

      it('should delete existing channel and return true', async () => {
        const channel = await saveNotificationChannel({
          provider: 'discord',
          name: 'Discord Webhook',
          enabled: false,
          config: '{}',
        });

        const result = await deleteNotificationChannel(channel.id);
        const retrieved = await getNotificationChannel('discord');

        expect(result).toBe(true);
        expect(retrieved).toBeNull();
      });
    });
  });
});
