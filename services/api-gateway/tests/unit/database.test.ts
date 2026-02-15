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
  getNotificationRules,
  getNotificationRulesByEvent,
  saveNotificationRule,
  updateNotificationRule,
  deleteNotificationRule,
  getNotificationRulesMatrix,
  addNotificationHistory,
  updateNotificationHistory,
  getRecentNotificationHistory,
  getNotificationHistoryByEvent,
  wasRecentlyNotified,
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

  describe('Notification Rules (DP-202)', () => {
    beforeEach(async () => {
      const sqlite = await import('../../src/services/database.js').then((m) => m.getDatabase());
      sqlite.prepare('DELETE FROM notification_rules').run();
      sqlite.prepare('DELETE FROM notification_channels').run();
    });

    describe('saveNotificationRule', () => {
      it('should create a new rule', async () => {
        const channel = await saveNotificationChannel({
          provider: 'smtp',
          name: 'Test SMTP',
          enabled: true,
          config: '{}',
        });

        const rule = saveNotificationRule({
          eventType: 'auth.login.success',
          channelId: channel.id,
          enabled: true,
          minSeverity: 'info',
          cooldownMinutes: 0,
        });

        expect(rule.id).toBeDefined();
        expect(rule.eventType).toBe('auth.login.success');
        expect(rule.channelId).toBe(channel.id);
        expect(rule.enabled).toBe(true);
        expect(rule.minSeverity).toBe('info');
        expect(rule.cooldownMinutes).toBe(0);
        expect(rule.createdAt).toBeDefined();
        expect(rule.updatedAt).toBeDefined();
      });

      it('should throw error for duplicate event type and channel', async () => {
        const channel = await saveNotificationChannel({
          provider: 'smtp',
          name: 'Test SMTP',
          enabled: true,
          config: '{}',
        });

        saveNotificationRule({
          eventType: 'auth.login.failed',
          channelId: channel.id,
          enabled: true,
          minSeverity: 'warning',
          cooldownMinutes: 5,
        });

        expect(() =>
          saveNotificationRule({
            eventType: 'auth.login.failed',
            channelId: channel.id,
            enabled: false,
            minSeverity: 'info',
            cooldownMinutes: 0,
          })
        ).toThrow();
      });
    });

    describe('getNotificationRules', () => {
      it('should return empty array when no rules', () => {
        const rules = getNotificationRules();
        expect(rules).toEqual([]);
      });

      it('should return all rules', async () => {
        const channel1 = await saveNotificationChannel({
          provider: 'smtp',
          name: 'SMTP 1',
          enabled: true,
          config: '{}',
        });
        const channel2 = await saveNotificationChannel({
          provider: 'slack',
          name: 'Slack',
          enabled: true,
          config: '{}',
        });

        saveNotificationRule({
          eventType: 'auth.login.success',
          channelId: channel1.id,
          enabled: true,
          minSeverity: 'info',
          cooldownMinutes: 0,
        });
        saveNotificationRule({
          eventType: 'system.upgrade.failed',
          channelId: channel2.id,
          enabled: true,
          minSeverity: 'critical',
          cooldownMinutes: 0,
        });

        const rules = getNotificationRules();
        expect(rules).toHaveLength(2);
      });
    });

    describe('getNotificationRulesByEvent', () => {
      it('should return rules for specific event type', async () => {
        const channel = await saveNotificationChannel({
          provider: 'smtp',
          name: 'Test SMTP',
          enabled: true,
          config: '{}',
        });

        saveNotificationRule({
          eventType: 'container.crashed',
          channelId: channel.id,
          enabled: true,
          minSeverity: 'critical',
          cooldownMinutes: 0,
        });

        const rules = getNotificationRulesByEvent('container.crashed');
        expect(rules).toHaveLength(1);
        expect(rules[0].eventType).toBe('container.crashed');
      });

      it('should return empty array for non-existent event', () => {
        const rules = getNotificationRulesByEvent('nonexistent.event');
        expect(rules).toEqual([]);
      });
    });

    describe('updateNotificationRule', () => {
      it('should update rule properties', async () => {
        const channel = await saveNotificationChannel({
          provider: 'smtp',
          name: 'Test SMTP',
          enabled: true,
          config: '{}',
        });

        const rule = saveNotificationRule({
          eventType: 'auth.login.success',
          channelId: channel.id,
          enabled: true,
          minSeverity: 'info',
          cooldownMinutes: 0,
        });

        const updated = updateNotificationRule(rule.id, {
          enabled: false,
          minSeverity: 'warning',
          cooldownMinutes: 10,
        });

        expect(updated.enabled).toBe(false);
        expect(updated.minSeverity).toBe('warning');
        expect(updated.cooldownMinutes).toBe(10);
      });

      it('should throw error for non-existent rule', () => {
        expect(() => updateNotificationRule('non-existent-id', { enabled: false })).toThrow(
          'Notification rule not found'
        );
      });
    });

    describe('deleteNotificationRule', () => {
      it('should delete existing rule', async () => {
        const channel = await saveNotificationChannel({
          provider: 'smtp',
          name: 'Test SMTP',
          enabled: true,
          config: '{}',
        });

        const rule = saveNotificationRule({
          eventType: 'auth.login.success',
          channelId: channel.id,
          enabled: true,
          minSeverity: 'info',
          cooldownMinutes: 0,
        });

        deleteNotificationRule(rule.id);

        const rules = getNotificationRules();
        expect(rules).toHaveLength(0);
      });

      it('should throw error for non-existent rule', () => {
        expect(() => deleteNotificationRule('non-existent-id')).toThrow(
          'Notification rule not found'
        );
      });
    });

    describe('getNotificationRulesMatrix', () => {
      it('should group rules by event type', async () => {
        const channel1 = await saveNotificationChannel({
          provider: 'smtp',
          name: 'SMTP',
          enabled: true,
          config: '{}',
        });
        const channel2 = await saveNotificationChannel({
          provider: 'slack',
          name: 'Slack',
          enabled: true,
          config: '{}',
        });

        saveNotificationRule({
          eventType: 'container.crashed',
          channelId: channel1.id,
          enabled: true,
          minSeverity: 'critical',
          cooldownMinutes: 0,
        });
        saveNotificationRule({
          eventType: 'container.crashed',
          channelId: channel2.id,
          enabled: true,
          minSeverity: 'critical',
          cooldownMinutes: 0,
        });
        saveNotificationRule({
          eventType: 'auth.login.success',
          channelId: channel1.id,
          enabled: true,
          minSeverity: 'info',
          cooldownMinutes: 0,
        });

        const matrix = getNotificationRulesMatrix();

        expect(Object.keys(matrix)).toHaveLength(2);
        expect(matrix['container.crashed']).toHaveLength(2);
        expect(matrix['auth.login.success']).toHaveLength(1);
      });
    });
  });

  describe('Notification History (DP-202)', () => {
    beforeEach(async () => {
      const sqlite = await import('../../src/services/database.js').then((m) => m.getDatabase());
      sqlite.prepare('DELETE FROM notification_history').run();
      sqlite.prepare('DELETE FROM notification_channels').run();
    });

    describe('addNotificationHistory', () => {
      it('should add history entry', async () => {
        const channel = await saveNotificationChannel({
          provider: 'smtp',
          name: 'Test SMTP',
          enabled: true,
          config: '{}',
        });

        const entry = addNotificationHistory({
          eventType: 'auth.login.success',
          channelId: channel.id,
          severity: 'info',
          message: 'User admin logged in',
          status: 'sent',
          retryCount: 0,
        });

        expect(entry.id).toBeDefined();
        expect(entry.eventType).toBe('auth.login.success');
        expect(entry.status).toBe('sent');
        expect(entry.createdAt).toBeDefined();
      });

      it('should add entry with optional fields', async () => {
        const channel = await saveNotificationChannel({
          provider: 'smtp',
          name: 'Test SMTP',
          enabled: true,
          config: '{}',
        });

        const entry = addNotificationHistory({
          eventType: 'container.crashed',
          channelId: channel.id,
          severity: 'critical',
          message: 'Container nginx crashed',
          recipients: JSON.stringify(['admin@example.com']),
          status: 'pending',
          error: undefined,
          retryCount: 0,
          sentAt: undefined,
        });

        expect(entry.recipients).toBe(JSON.stringify(['admin@example.com']));
      });
    });

    describe('getRecentNotificationHistory', () => {
      it('should return empty array when no history', () => {
        const history = getRecentNotificationHistory();
        expect(history).toEqual([]);
      });

      it('should return recent history entries', async () => {
        const channel = await saveNotificationChannel({
          provider: 'smtp',
          name: 'Test SMTP',
          enabled: true,
          config: '{}',
        });

        addNotificationHistory({
          eventType: 'auth.login.success',
          channelId: channel.id,
          severity: 'info',
          message: 'Test message 1',
          status: 'sent',
          retryCount: 0,
        });
        addNotificationHistory({
          eventType: 'auth.login.failed',
          channelId: channel.id,
          severity: 'warning',
          message: 'Test message 2',
          status: 'failed',
          retryCount: 1,
        });

        const history = getRecentNotificationHistory(10);
        expect(history).toHaveLength(2);
      });

      it('should respect limit parameter', async () => {
        const channel = await saveNotificationChannel({
          provider: 'smtp',
          name: 'Test SMTP',
          enabled: true,
          config: '{}',
        });

        for (let i = 0; i < 5; i++) {
          addNotificationHistory({
            eventType: 'auth.login.success',
            channelId: channel.id,
            severity: 'info',
            message: `Test message ${i}`,
            status: 'sent',
            retryCount: 0,
          });
        }

        const history = getRecentNotificationHistory(3);
        expect(history).toHaveLength(3);
      });
    });

    describe('getNotificationHistoryByEvent', () => {
      it('should return history for specific event', async () => {
        const channel = await saveNotificationChannel({
          provider: 'smtp',
          name: 'Test SMTP',
          enabled: true,
          config: '{}',
        });

        addNotificationHistory({
          eventType: 'auth.login.success',
          channelId: channel.id,
          severity: 'info',
          message: 'Login success',
          status: 'sent',
          retryCount: 0,
        });
        addNotificationHistory({
          eventType: 'container.crashed',
          channelId: channel.id,
          severity: 'critical',
          message: 'Container crash',
          status: 'sent',
          retryCount: 0,
        });

        const history = getNotificationHistoryByEvent('auth.login.success');
        expect(history).toHaveLength(1);
        expect(history[0].eventType).toBe('auth.login.success');
      });
    });

    describe('updateNotificationHistory', () => {
      it('should update history entry status', async () => {
        const channel = await saveNotificationChannel({
          provider: 'smtp',
          name: 'Test SMTP',
          enabled: true,
          config: '{}',
        });

        const entry = addNotificationHistory({
          eventType: 'auth.login.success',
          channelId: channel.id,
          severity: 'info',
          message: 'Test message',
          status: 'pending',
          retryCount: 0,
        });

        updateNotificationHistory(entry.id, {
          status: 'sent',
          sentAt: new Date().toISOString(),
        });

        const history = getRecentNotificationHistory();
        expect(history[0].status).toBe('sent');
        expect(history[0].sentAt).toBeDefined();
      });

      it('should update retry count and error', async () => {
        const channel = await saveNotificationChannel({
          provider: 'smtp',
          name: 'Test SMTP',
          enabled: true,
          config: '{}',
        });

        const entry = addNotificationHistory({
          eventType: 'auth.login.success',
          channelId: channel.id,
          severity: 'info',
          message: 'Test message',
          status: 'pending',
          retryCount: 0,
        });

        updateNotificationHistory(entry.id, {
          status: 'failed',
          retryCount: 1,
          error: 'Connection timeout',
        });

        const history = getRecentNotificationHistory();
        expect(history[0].status).toBe('failed');
        expect(history[0].retryCount).toBe(1);
      });
    });

    describe('wasRecentlyNotified', () => {
      it('should return false when no cooldown', async () => {
        const channel = await saveNotificationChannel({
          provider: 'smtp',
          name: 'Test SMTP',
          enabled: true,
          config: '{}',
        });

        const result = wasRecentlyNotified('auth.login.success', channel.id, 0);
        expect(result).toBe(false);
      });

      it('should return true when recently notified', async () => {
        const channel = await saveNotificationChannel({
          provider: 'smtp',
          name: 'Test SMTP',
          enabled: true,
          config: '{}',
        });

        addNotificationHistory({
          eventType: 'auth.login.success',
          channelId: channel.id,
          severity: 'info',
          message: 'Test message',
          status: 'sent',
          retryCount: 0,
          sentAt: new Date().toISOString(),
        });

        const result = wasRecentlyNotified('auth.login.success', channel.id, 60);
        expect(result).toBe(true);
      });

      it('should return false when outside cooldown window', async () => {
        const channel = await saveNotificationChannel({
          provider: 'smtp',
          name: 'Test SMTP',
          enabled: true,
          config: '{}',
        });

        const oldDate = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(); // 2 hours ago
        addNotificationHistory({
          eventType: 'auth.login.success',
          channelId: channel.id,
          severity: 'info',
          message: 'Test message',
          status: 'sent',
          retryCount: 0,
          sentAt: oldDate,
        });

        const result = wasRecentlyNotified('auth.login.success', channel.id, 60);
        expect(result).toBe(false);
      });
    });
  });
});
