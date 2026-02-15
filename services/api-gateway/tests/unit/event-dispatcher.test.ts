import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  EventDispatcher,
  getEventDispatcher,
  emitContainerCrash,
  emitContainerRestart,
  emitContainerOOM,
  emitContainerHealthFailed,
  emitDeployStarted,
  emitDeploySuccess,
  emitDeployFailed,
  emitDeployRolledBack,
  emitWebhookReceived,
  emitSystemUpgradeStarted,
  emitSystemUpgradeCompleted,
  emitSystemUpgradeFailed,
  emitAuthLoginSuccess,
  emitAuthLoginFailed,
  emitAuthPasswordChanged,
  emitSecurityBruteForce,
  emitSecurityUnauthorizedAccess,
} from '../../src/services/eventDispatcher.js';

// Mock dependencies
vi.mock('../../src/services/database.js', () => ({
  getNotificationRulesByEvent: vi.fn(() => []),
  wasRecentlyNotified: vi.fn(() => false),
  addNotificationHistory: vi.fn(() => ({
    id: 'history-1',
    eventType: 'test',
    channelId: 'channel-1',
    severity: 'info',
    message: 'Test',
    status: 'sent',
    retryCount: 0,
    createdAt: '2024-01-01T00:00:00Z',
  })),
  updateNotificationHistory: vi.fn(),
  getNotificationChannels: vi.fn(() => Promise.resolve([])),
  getNotificationChannel: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../../src/services/notifications.js', () => ({
  getDefaultNotificationService: vi.fn(() => ({
    test: vi.fn(() =>
      Promise.resolve({
        success: true,
        message: 'Test sent',
        timestamp: new Date().toISOString(),
      })
    ),
  })),
  NotificationService: vi.fn(() => ({
    sendEvent: vi.fn(() => Promise.resolve()),
  })),
}));

vi.mock('../../src/utils/crypto.js', () => ({
  decrypt: vi.fn((value) => `decrypted_${value}`),
}));

import {
  getNotificationRulesByEvent,
  wasRecentlyNotified,
  getNotificationChannels,
} from '../../src/services/database.js';

describe('EventDispatcher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.MASTER_KEY = 'test-master-key-for-testing-12345';
  });

  describe('dispatch', () => {
    it('should dispatch event to matching rules', async () => {
      const mockChannel = {
        id: 'channel-1',
        provider: 'slack' as const,
        name: 'Test Slack',
        enabled: true,
        config: JSON.stringify({ webhookUrl: 'enc:encrypted-url' }),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockRules = [
        {
          id: 'rule-1',
          eventType: 'container.crashed',
          channelId: 'channel-1',
          enabled: true,
          minSeverity: 'warning' as const,
          cooldownMinutes: 0,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
      ];

      vi.mocked(getNotificationChannels).mockResolvedValue([mockChannel]);
      vi.mocked(getNotificationRulesByEvent).mockReturnValue(mockRules);
      vi.mocked(wasRecentlyNotified).mockReturnValue(false);

      const dispatcher = new EventDispatcher();

      const result = await dispatcher.dispatch({
        eventType: 'container.crashed',
        severity: 'critical',
        message: 'Container crashed',
        timestamp: new Date().toISOString(),
      });

      expect(result.eventType).toBe('container.crashed');
    });

    it('should skip disabled rules', async () => {
      const mockRules = [
        {
          id: 'rule-1',
          eventType: 'container.crashed',
          channelId: 'channel-1',
          enabled: false,
          minSeverity: 'warning' as const,
          cooldownMinutes: 0,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
      ];

      vi.mocked(getNotificationRulesByEvent).mockReturnValue(mockRules);

      const dispatcher = new EventDispatcher();
      const result = await dispatcher.dispatch({
        eventType: 'container.crashed',
        severity: 'critical',
        message: 'Container crashed',
        timestamp: new Date().toISOString(),
      });

      expect(result.skipped).toBe(1);
    });

    it('should skip rules with insufficient severity', async () => {
      const mockRules = [
        {
          id: 'rule-1',
          eventType: 'container.crashed',
          channelId: 'channel-1',
          enabled: true,
          minSeverity: 'critical' as const,
          cooldownMinutes: 0,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
      ];

      vi.mocked(getNotificationRulesByEvent).mockReturnValue(mockRules);

      const dispatcher = new EventDispatcher();
      const result = await dispatcher.dispatch({
        eventType: 'container.crashed',
        severity: 'info',
        message: 'Container info',
        timestamp: new Date().toISOString(),
      });

      expect(result.skipped).toBe(1);
    });

    it('should skip rules in cooldown period', async () => {
      const mockRules = [
        {
          id: 'rule-1',
          eventType: 'container.crashed',
          channelId: 'channel-1',
          enabled: true,
          minSeverity: 'info' as const,
          cooldownMinutes: 10,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
      ];

      vi.mocked(getNotificationRulesByEvent).mockReturnValue(mockRules);
      vi.mocked(wasRecentlyNotified).mockReturnValue(true);

      const dispatcher = new EventDispatcher();
      const result = await dispatcher.dispatch({
        eventType: 'container.crashed',
        severity: 'critical',
        message: 'Container crashed',
        timestamp: new Date().toISOString(),
      });

      expect(result.skipped).toBe(1);
    });
  });

  describe('getEventDispatcher', () => {
    it('should return singleton instance', () => {
      const instance1 = getEventDispatcher();
      const instance2 = getEventDispatcher();
      expect(instance1).toBe(instance2);
    });
  });

  describe('Legacy event emitters', () => {
    beforeEach(() => {
      vi.mocked(getNotificationChannels).mockResolvedValue([]);
    });

    it('should emit container crash event', async () => {
      await expect(
        emitContainerCrash('container-1', 'test-container', 1, 'nginx:latest')
      ).resolves.not.toThrow();
    });

    it('should emit container restart event', async () => {
      await expect(emitContainerRestart('container-1', 'test-container', 2)).resolves.not.toThrow();
    });

    it('should emit container OOM event', async () => {
      await expect(
        emitContainerOOM('container-1', 'test-container', 536870912, 536870912)
      ).resolves.not.toThrow();
    });

    it('should emit container health failed event', async () => {
      await expect(
        emitContainerHealthFailed('container-1', 'test-container', 'unhealthy')
      ).resolves.not.toThrow();
    });

    it('should emit deploy started event', async () => {
      await expect(emitDeployStarted('my-repo', 'repo-1', 'main')).resolves.not.toThrow();
    });

    it('should emit deploy success event', async () => {
      await expect(emitDeploySuccess('my-repo', 120000, ['web', 'api'])).resolves.not.toThrow();
    });

    it('should emit deploy failed event', async () => {
      await expect(emitDeployFailed('my-repo', 'Build failed', 'build')).resolves.not.toThrow();
    });

    it('should emit deploy rolled back event', async () => {
      await expect(emitDeployRolledBack('my-repo', 'Health check failed')).resolves.not.toThrow();
    });

    it('should emit webhook received event', async () => {
      await expect(emitWebhookReceived('github', 'my-repo', 'push')).resolves.not.toThrow();
    });

    it('should emit system upgrade started event', async () => {
      await expect(emitSystemUpgradeStarted('2.0.0', '1.9.0')).resolves.not.toThrow();
    });

    it('should emit system upgrade completed event', async () => {
      await expect(emitSystemUpgradeCompleted('2.0.0')).resolves.not.toThrow();
    });

    it('should emit system upgrade failed event', async () => {
      await expect(emitSystemUpgradeFailed('Connection refused')).resolves.not.toThrow();
    });

    it('should emit auth login success event', async () => {
      await expect(emitAuthLoginSuccess('admin', '192.168.1.1')).resolves.not.toThrow();
    });

    it('should emit auth login failed event', async () => {
      await expect(
        emitAuthLoginFailed('admin', '192.168.1.1', 'Invalid password')
      ).resolves.not.toThrow();
    });

    it('should emit auth password changed event', async () => {
      await expect(emitAuthPasswordChanged('admin')).resolves.not.toThrow();
    });

    it('should emit security brute force event', async () => {
      await expect(
        emitSecurityBruteForce('192.168.1.1', 10, '/api/auth/login')
      ).resolves.not.toThrow();
    });

    it('should emit security unauthorized access event', async () => {
      await expect(
        emitSecurityUnauthorizedAccess('user1', '/api/admin', '192.168.1.1')
      ).resolves.not.toThrow();
    });
  });
});
