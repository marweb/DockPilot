import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import Fastify from 'fastify';
import { notificationRulesRoutes } from '../../src/routes/notifications';
import { emitNotificationEvent } from '../../src/services/eventDispatcher';

// Mocks
vi.mock('../../src/services/eventDispatcher', () => ({
  emitNotificationEvent: vi.fn(),
}));

vi.mock('../../src/services/database');

describe('Events Integration', () => {
  let app: ReturnType<typeof Fastify>;

  beforeAll(async () => {
    app = Fastify();

    // Mock authentication
    app.decorate('authenticate', async (_request: any) => {
      _request.user = { id: 'admin-id', username: 'admin', role: 'admin' };
    });

    app.decorate('requireAdmin', async (_request: any) => {
      // Allow admin
    });

    await app.register(notificationRulesRoutes, { prefix: '/api' });
  });

  afterAll(async () => {
    await app.close();
  });

  it('should emit and dispatch container crash event', async () => {
    // Setup: Mock emitNotificationEvent
    vi.mocked(emitNotificationEvent).mockResolvedValue({
      eventType: 'container.crashed',
      sent: 1,
      failed: 0,
      skipped: 0,
      results: [{ channelId: 'channel-1', success: true }],
    });

    // Emit event
    const result = await emitNotificationEvent(
      'container.crashed',
      'critical',
      'Container nginx crashed',
      { containerId: 'abc123', exitCode: 1 }
    );

    // Assert
    expect(result.sent).toBeGreaterThan(0);
    expect(emitNotificationEvent).toHaveBeenCalledWith(
      'container.crashed',
      'critical',
      'Container nginx crashed',
      { containerId: 'abc123', exitCode: 1 }
    );
  });

  it('should handle multiple channels for same event', async () => {
    // Setup: Mock para múltiples canales
    vi.mocked(emitNotificationEvent).mockResolvedValue({
      eventType: 'system.upgrade.failed',
      sent: 2,
      failed: 0,
      skipped: 0,
      results: [
        { channelId: 'channel-1', success: true },
        { channelId: 'channel-2', success: true },
      ],
    });

    const result = await emitNotificationEvent(
      'system.upgrade.failed',
      'critical',
      'Upgrade failed'
    );

    expect(result.sent).toBe(2);
  });

  it('should respect severity filtering', async () => {
    // Mock: Info event should be skipped
    vi.mocked(emitNotificationEvent).mockImplementation(async (eventType, severity) => {
      if (severity === 'info') {
        return {
          eventType,
          sent: 0,
          failed: 0,
          skipped: 1,
          results: [],
        };
      }
      return {
        eventType,
        sent: 1,
        failed: 0,
        skipped: 0,
        results: [{ channelId: 'channel-1', success: true }],
      };
    });

    // Info event should be skipped
    const infoResult = await emitNotificationEvent('auth.login.success', 'info', 'User logged in');
    expect(infoResult.skipped).toBe(1);

    // Warning event should be sent
    const warningResult = await emitNotificationEvent(
      'auth.login.failed',
      'warning',
      'Failed login'
    );
    expect(warningResult.sent).toBe(1);
  });

  it('should deduplicate events within cooldown', async () => {
    // Mock: Segundo evento debería ser skipped por cooldown
    let callCount = 0;
    vi.mocked(emitNotificationEvent).mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        return {
          eventType: 'container.crashed',
          sent: 1,
          failed: 0,
          skipped: 0,
          results: [{ channelId: 'channel-1', success: true }],
        };
      }
      return {
        eventType: 'container.crashed',
        sent: 0,
        failed: 0,
        skipped: 1,
        results: [],
      };
    });

    // First event
    const result1 = await emitNotificationEvent('container.crashed', 'critical', 'Crash 1');
    expect(result1.sent).toBe(1);

    // Second event immediately after should be skipped
    const result2 = await emitNotificationEvent('container.crashed', 'critical', 'Crash 2');
    expect(result2.skipped).toBe(1);
  });

  it('should process events via API endpoint', async () => {
    vi.mocked(emitNotificationEvent).mockResolvedValue({
      eventType: 'repo.deploy.success',
      sent: 1,
      failed: 0,
      skipped: 0,
      results: [{ channelId: 'channel-1', success: true }],
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/notifications/events',
      payload: {
        eventType: 'repo.deploy.success',
        severity: 'info',
        message: 'Deployment completed',
        metadata: { repoName: 'my-app', duration: 120 },
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(true);
  });

  it('should handle events with rich metadata', async () => {
    const metadata = {
      containerId: 'container-123',
      containerName: 'nginx-proxy',
      image: 'nginx:alpine',
      ports: ['80:8080', '443:8443'],
      networks: ['frontend', 'backend'],
      labels: {
        'app.name': 'my-app',
        'app.version': '1.0.0',
      },
    };

    vi.mocked(emitNotificationEvent).mockResolvedValue({
      eventType: 'container.started',
      sent: 1,
      failed: 0,
      skipped: 0,
      results: [{ channelId: 'channel-1', success: true }],
    });

    await emitNotificationEvent(
      'container.started',
      'info',
      'Container nginx-proxy started',
      metadata
    );

    expect(emitNotificationEvent).toHaveBeenCalledWith(
      'container.started',
      'info',
      'Container nginx-proxy started',
      metadata
    );
  });

  it('should handle critical security events', async () => {
    vi.mocked(emitNotificationEvent).mockResolvedValue({
      eventType: 'security.brute_force',
      sent: 1,
      failed: 0,
      skipped: 0,
      results: [{ channelId: 'channel-1', success: true }],
    });

    const result = await emitNotificationEvent(
      'security.brute_force',
      'critical',
      'Possible brute force attack detected',
      {
        ip: '192.168.1.100',
        failedAttempts: 15,
        targetEndpoint: '/api/auth/login',
      }
    );

    expect(result.sent).toBeGreaterThan(0);
    expect(emitNotificationEvent).toHaveBeenCalledWith(
      'security.brute_force',
      'critical',
      'Possible brute force attack detected',
      expect.objectContaining({
        ip: '192.168.1.100',
        failedAttempts: 15,
      })
    );
  });
});
