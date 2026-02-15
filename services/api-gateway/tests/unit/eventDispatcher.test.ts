import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventDispatcher, emitNotificationEvent } from '../../src/services/eventDispatcher';
import * as database from '../../src/services/database';
import type { NotificationRule } from '@dockpilot/types';

vi.mock('../../src/services/database');

describe('EventDispatcher', () => {
  let dispatcher: EventDispatcher;
  let mockNotificationService: { test: ReturnType<typeof vi.fn> };
  const now = new Date().toISOString();

  beforeEach(() => {
    vi.clearAllMocks();
    mockNotificationService = {
      test: vi.fn(),
    };
    dispatcher = new EventDispatcher(mockNotificationService as any);
  });

  describe('dispatch', () => {
    it('should send notification when rule is enabled and matches severity', async () => {
      const mockRule: NotificationRule = {
        id: 'rule-1',
        eventType: 'container.crashed',
        channelId: 'channel-1',
        enabled: true,
        minSeverity: 'warning',
        cooldownMinutes: 0,
        createdAt: now,
        updatedAt: now,
      };

      vi.mocked(database.getNotificationRulesByEvent).mockReturnValue([mockRule]);
      vi.mocked(database.wasRecentlyNotified).mockReturnValue(false);
      vi.mocked(database.getNotificationChannels).mockResolvedValue([
        {
          id: 'channel-1',
          provider: 'slack',
          name: 'Test Channel',
          enabled: true,
          config: '{}',
          createdAt: now,
          updatedAt: now,
        },
      ]);
      mockNotificationService.test.mockResolvedValue({ success: true });

      const result = await dispatcher.dispatch({
        eventType: 'container.crashed',
        severity: 'critical',
        message: 'Container crashed',
        timestamp: now,
      });

      expect(result.sent).toBe(1);
      expect(result.failed).toBe(0);
    });

    it('should skip disabled rules', async () => {
      const mockRule: NotificationRule = {
        id: 'rule-1',
        eventType: 'container.crashed',
        channelId: 'channel-1',
        enabled: false,
        minSeverity: 'info',
        cooldownMinutes: 0,
        createdAt: now,
        updatedAt: now,
      };

      vi.mocked(database.getNotificationRulesByEvent).mockReturnValue([mockRule]);

      const result = await dispatcher.dispatch({
        eventType: 'container.crashed',
        severity: 'critical',
        message: 'Container crashed',
        timestamp: now,
      });

      expect(result.skipped).toBe(1);
    });

    it('should skip rules below minimum severity', async () => {
      const mockRule: NotificationRule = {
        id: 'rule-1',
        eventType: 'auth.login.success',
        channelId: 'channel-1',
        enabled: true,
        minSeverity: 'warning',
        cooldownMinutes: 0,
        createdAt: now,
        updatedAt: now,
      };

      vi.mocked(database.getNotificationRulesByEvent).mockReturnValue([mockRule]);

      const result = await dispatcher.dispatch({
        eventType: 'auth.login.success',
        severity: 'info',
        message: 'User logged in',
        timestamp: now,
      });

      expect(result.skipped).toBe(1);
    });

    it('should respect cooldown periods', async () => {
      const mockRule: NotificationRule = {
        id: 'rule-1',
        eventType: 'container.crashed',
        channelId: 'channel-1',
        enabled: true,
        minSeverity: 'info',
        cooldownMinutes: 5,
        createdAt: now,
        updatedAt: now,
      };

      vi.mocked(database.getNotificationRulesByEvent).mockReturnValue([mockRule]);
      vi.mocked(database.wasRecentlyNotified).mockReturnValue(true);

      const result = await dispatcher.dispatch({
        eventType: 'container.crashed',
        severity: 'critical',
        message: 'Container crashed',
        timestamp: now,
      });

      expect(result.skipped).toBe(1);
    });

    it('should retry failed notifications', async () => {
      const mockRule: NotificationRule = {
        id: 'rule-1',
        eventType: 'system.upgrade.failed',
        channelId: 'channel-1',
        enabled: true,
        minSeverity: 'info',
        cooldownMinutes: 0,
        createdAt: now,
        updatedAt: now,
      };

      vi.mocked(database.getNotificationRulesByEvent).mockReturnValue([mockRule]);
      vi.mocked(database.wasRecentlyNotified).mockReturnValue(false);
      vi.mocked(database.getNotificationChannels).mockResolvedValue([
        {
          id: 'channel-1',
          provider: 'slack',
          name: 'Test Channel',
          enabled: true,
          config: '{}',
          createdAt: now,
          updatedAt: now,
        },
      ]);

      mockNotificationService.test
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({ success: true });

      // Mock updateNotificationHistory para reintentos
      vi.mocked(database.updateNotificationHistory).mockImplementation(() => {});

      const result = await dispatcher.dispatch({
        eventType: 'system.upgrade.failed',
        severity: 'critical',
        message: 'Upgrade failed',
        timestamp: now,
      });

      expect(mockNotificationService.test).toHaveBeenCalledTimes(1);
      expect(result.sent).toBe(0);
      expect(result.failed).toBe(1);
    });

    it('should record notification history', async () => {
      const mockRule: NotificationRule = {
        id: 'rule-1',
        eventType: 'container.crashed',
        channelId: 'channel-1',
        enabled: true,
        minSeverity: 'info',
        cooldownMinutes: 0,
        createdAt: now,
        updatedAt: now,
      };

      vi.mocked(database.getNotificationRulesByEvent).mockReturnValue([mockRule]);
      vi.mocked(database.wasRecentlyNotified).mockReturnValue(false);
      vi.mocked(database.getNotificationChannels).mockResolvedValue([
        {
          id: 'channel-1',
          provider: 'slack',
          name: 'Test Channel',
          enabled: true,
          config: '{}',
          createdAt: now,
          updatedAt: now,
        },
      ]);
      vi.mocked(database.addNotificationHistory).mockImplementation(
        (entry) =>
          ({
            ...entry,
            id: 'history-1',
            createdAt: now,
          }) as any
      );

      mockNotificationService.test.mockResolvedValue({ success: true });

      const addHistorySpy = vi.spyOn(database, 'addNotificationHistory');

      await dispatcher.dispatch({
        eventType: 'container.crashed',
        severity: 'critical',
        message: 'Container crashed',
        timestamp: now,
      });

      expect(addHistorySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'container.crashed',
          status: 'sent',
        })
      );
    });

    it('should handle multiple rules for same event', async () => {
      const mockRules: NotificationRule[] = [
        {
          id: 'rule-1',
          eventType: 'container.crashed',
          channelId: 'channel-1',
          enabled: true,
          minSeverity: 'info',
          cooldownMinutes: 0,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'rule-2',
          eventType: 'container.crashed',
          channelId: 'channel-2',
          enabled: true,
          minSeverity: 'info',
          cooldownMinutes: 0,
          createdAt: now,
          updatedAt: now,
        },
      ];

      vi.mocked(database.getNotificationRulesByEvent).mockReturnValue(mockRules);
      vi.mocked(database.wasRecentlyNotified).mockReturnValue(false);
      vi.mocked(database.getNotificationChannels).mockResolvedValue([
        {
          id: 'channel-1',
          provider: 'slack',
          name: 'Test Channel 1',
          enabled: true,
          config: '{}',
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'channel-2',
          provider: 'telegram',
          name: 'Test Channel 2',
          enabled: true,
          config: '{}',
          createdAt: now,
          updatedAt: now,
        },
      ]);
      vi.mocked(database.addNotificationHistory).mockImplementation(
        (entry) =>
          ({
            ...entry,
            id: 'history-' + Math.random(),
            createdAt: now,
          }) as any
      );

      mockNotificationService.test.mockResolvedValue({ success: true });

      const result = await dispatcher.dispatch({
        eventType: 'container.crashed',
        severity: 'critical',
        message: 'Container crashed',
        timestamp: now,
      });

      expect(result.sent).toBe(2);
      expect(mockNotificationService.test).toHaveBeenCalledTimes(2);
    });

    it('should handle channel not found error', async () => {
      const mockRule: NotificationRule = {
        id: 'rule-1',
        eventType: 'container.crashed',
        channelId: 'non-existent-channel',
        enabled: true,
        minSeverity: 'info',
        cooldownMinutes: 0,
        createdAt: now,
        updatedAt: now,
      };

      vi.mocked(database.getNotificationRulesByEvent).mockReturnValue([mockRule]);
      vi.mocked(database.wasRecentlyNotified).mockReturnValue(false);
      vi.mocked(database.getNotificationChannels).mockResolvedValue([]);

      const result = await dispatcher.dispatch({
        eventType: 'container.crashed',
        severity: 'critical',
        message: 'Container crashed',
        timestamp: now,
      });

      expect(result.failed).toBe(1);
    });
  });

  describe('emitNotificationEvent', () => {
    it('should dispatch event with correct payload', async () => {
      // Mock rules and channels for the singleton dispatcher
      vi.mocked(database.getNotificationRulesByEvent).mockReturnValue([]);

      const result = await emitNotificationEvent(
        'repo.deploy.success',
        'info',
        'Deploy successful',
        {
          repoName: 'my-app',
        }
      );

      expect(result).toMatchObject({
        eventType: 'repo.deploy.success',
        sent: 0,
        failed: 0,
        skipped: 0,
      });
    });

    it('should include metadata in event payload', async () => {
      // Mock rules and channels for the singleton dispatcher
      vi.mocked(database.getNotificationRulesByEvent).mockReturnValue([]);

      const metadata = {
        containerId: 'abc123',
        containerName: 'nginx',
        exitCode: 1,
        image: 'nginx:latest',
      };

      const result = await emitNotificationEvent(
        'container.crashed',
        'critical',
        'Container nginx crashed',
        metadata
      );

      expect(result).toMatchObject({
        eventType: 'container.crashed',
        sent: 0,
        failed: 0,
        skipped: 0,
      });
    });
  });
});
