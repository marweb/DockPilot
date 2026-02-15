import {
  NotificationServiceManager,
  NotificationService,
  getDefaultNotificationService,
} from './notifications.js';
import {
  getNotificationRulesByEvent,
  wasRecentlyNotified,
  addNotificationHistory,
  updateNotificationHistory,
  getNotificationChannels,
  getNotificationChannel,
} from './database.js';
import { decrypt } from '../utils/crypto.js';
import type { NotificationEventType, NotificationSeverity } from '@dockpilot/types';
import { NOTIFICATION_EVENTS } from '@dockpilot/types';

export type EventSeverity = 'info' | 'warning' | 'critical';

export interface NotificationEvent {
  eventType: string;
  severity: EventSeverity;
  message: string;
  metadata: Record<string, unknown>;
  timestamp: string;
}

interface EventPayload {
  eventType: NotificationEventType;
  severity: NotificationSeverity;
  message: string;
  details?: Record<string, unknown>;
  timestamp: string;
}

interface DispatchResult {
  eventType: string;
  sent: number;
  failed: number;
  skipped: number;
  results: Array<{
    channelId: string;
    success: boolean;
    error?: string;
  }>;
}

export class EventDispatcher {
  private notificationService: NotificationServiceManager;
  private masterKey: string;

  constructor(notificationService?: NotificationServiceManager) {
    this.masterKey = process.env.MASTER_KEY || '';
    this.notificationService = notificationService || getDefaultNotificationService();
  }

  async dispatch(event: EventPayload): Promise<DispatchResult> {
    const results: DispatchResult = {
      eventType: event.eventType,
      sent: 0,
      failed: 0,
      skipped: 0,
      results: [],
    };

    // Obtener reglas para este evento
    const rules = getNotificationRulesByEvent(event.eventType);

    for (const rule of rules) {
      // Verificar si está habilitada
      if (!rule.enabled) {
        results.skipped++;
        continue;
      }

      // Verificar severidad mínima
      const severityOrder = { info: 0, warning: 1, critical: 2 };
      if (severityOrder[event.severity] < severityOrder[rule.minSeverity]) {
        results.skipped++;
        continue;
      }

      // Verificar cooldown (deduplicación)
      if (wasRecentlyNotified(event.eventType, rule.channelId, rule.cooldownMinutes)) {
        results.skipped++;
        continue;
      }

      try {
        // Obtener configuración del canal
        const channel = await this.getChannelConfig(rule.channelId);
        if (!channel) {
          throw new Error('Channel not found');
        }

        // Descifrar configuración
        const decryptedConfig = this.decryptConfig(channel);

        // Enviar notificación
        const sendResult = await this.notificationService.test(channel.provider, decryptedConfig);

        // Registrar en historial
        const historyEntry = addNotificationHistory({
          eventType: event.eventType,
          channelId: rule.channelId,
          severity: event.severity,
          message: event.message,
          status: sendResult.success ? 'sent' : 'failed',
          error: sendResult.error,
          retryCount: 0,
        });

        if (sendResult.success) {
          results.sent++;
        } else {
          results.failed++;
          // Reintentar si falló
          await this.retryNotification(historyEntry.id, event, channel, decryptedConfig);
        }

        results.results.push({
          channelId: rule.channelId,
          success: sendResult.success,
          error: sendResult.error,
        });
      } catch (error) {
        results.failed++;
        results.results.push({
          channelId: rule.channelId,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return results;
  }

  private async retryNotification(
    historyId: string,
    event: EventPayload,
    channel: any,
    config: any,
    maxRetries = 3
  ): Promise<void> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      // Esperar antes de reintentar (backoff exponencial)
      await this.delay(Math.pow(2, attempt) * 1000);

      try {
        const result = await this.notificationService.test(channel.provider, config);

        if (result.success) {
          updateNotificationHistory(historyId, {
            status: 'sent',
            retryCount: attempt,
          });
          return;
        }

        updateNotificationHistory(historyId, {
          status: attempt === maxRetries ? 'failed' : 'retrying',
          retryCount: attempt,
          error: result.error,
        });
      } catch (error) {
        updateNotificationHistory(historyId, {
          status: attempt === maxRetries ? 'failed' : 'retrying',
          retryCount: attempt,
          error: error instanceof Error ? error.message : 'Retry failed',
        });
      }
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async getChannelConfig(channelId: string): Promise<any> {
    const channels = await getNotificationChannels();
    return channels.find((c) => c.id === channelId);
  }

  private decryptConfig(channel: any): any {
    const config = JSON.parse(channel.config);

    const sensitiveFields: Record<string, string[]> = {
      smtp: ['password'],
      resend: ['apiKey'],
      slack: ['webhookUrl'],
      telegram: ['botToken'],
      discord: ['webhookUrl'],
    };

    const fields = sensitiveFields[channel.provider];
    if (fields) {
      for (const field of fields) {
        if (config[field] && typeof config[field] === 'string') {
          try {
            config[field] = decrypt(config[field], this.masterKey);
          } catch (error) {
            // If decryption fails, the value might not be encrypted
            console.warn(`Failed to decrypt field ${field} for ${channel.provider}:`, error);
          }
        }
      }
    }

    return config;
  }
}

// Singleton
let dispatcherInstance: EventDispatcher | null = null;

export function getEventDispatcher(): EventDispatcher {
  if (!dispatcherInstance) {
    dispatcherInstance = new EventDispatcher();
  }
  return dispatcherInstance;
}

// Helper para emitir eventos
export async function emitNotificationEvent(
  eventType: NotificationEventType | string,
  severity: NotificationSeverity,
  message: string,
  details?: Record<string, unknown>
): Promise<DispatchResult> {
  const dispatcher = getEventDispatcher();
  return dispatcher.dispatch({
    eventType: eventType as NotificationEventType,
    severity,
    message,
    details,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Emit a notification event to all configured channels
 * This is fire-and-forget: errors are logged but don't block the main operation
 * Legacy version for backward compatibility
 */
export async function emitNotificationEventLegacy(
  eventType: string,
  severity: EventSeverity,
  message: string,
  metadata: Record<string, unknown> = {}
): Promise<void> {
  const masterKey = process.env.MASTER_KEY;
  if (!masterKey) {
    // Silently skip if MASTER_KEY is not configured
    return;
  }

  try {
    const channels = await getNotificationChannels();
    const enabledChannels = channels.filter((c) => c.enabled);

    if (enabledChannels.length === 0) {
      // No channels configured, silently return
      return;
    }

    const event: NotificationEvent = {
      eventType,
      severity,
      message,
      metadata,
      timestamp: new Date().toISOString(),
    };

    const notificationService = new NotificationService(masterKey);

    // Send to all enabled channels in parallel
    const sendPromises = enabledChannels.map(async (channel) => {
      try {
        await notificationService.sendEvent(channel, event);
      } catch (error) {
        // Log error but don't throw - this is fire-and-forget
        console.warn(
          `Failed to send notification event to ${channel.provider}:`,
          error instanceof Error ? error.message : String(error)
        );
      }
    });

    await Promise.all(sendPromises);
  } catch (error) {
    // Log error but don't throw - events are optional
    console.warn(
      'Failed to emit notification event:',
      error instanceof Error ? error.message : String(error)
    );
  }
}

/**
 * Initialize the event dispatcher on system startup
 */
export async function initializeEventDispatcher(): Promise<void> {
  await emitNotificationEventLegacy('system.startup', 'info', 'DockPilot system started', {
    version: process.env.DOCKPILOT_VERSION || process.env.npm_package_version || 'unknown',
    nodeVersion: process.version,
    platform: process.platform,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Emit container crash event
 */
export async function emitContainerCrash(
  containerId: string,
  containerName: string,
  exitCode: number,
  image: string
): Promise<void> {
  await emitNotificationEventLegacy(
    'container.crashed',
    'critical',
    `Container ${containerName} crashed with exit code ${exitCode}`,
    { containerId, containerName, exitCode, image }
  );
}

/**
 * Emit container restart event
 */
export async function emitContainerRestart(
  containerId: string,
  containerName: string,
  restartCount: number
): Promise<void> {
  await emitNotificationEventLegacy(
    'container.restarted',
    'warning',
    `Container ${containerName} was restarted`,
    { containerId, containerName, restartCount }
  );
}

/**
 * Emit container OOM event
 */
export async function emitContainerOOM(
  containerId: string,
  containerName: string,
  memoryLimit: number,
  memoryUsage: number
): Promise<void> {
  await emitNotificationEventLegacy(
    'container.oom',
    'critical',
    `Container ${containerName} was killed (Out of Memory)`,
    { containerId, containerName, memoryLimit, memoryUsage }
  );
}

/**
 * Emit container health check failure event
 */
export async function emitContainerHealthFailed(
  containerId: string,
  containerName: string,
  healthStatus: string
): Promise<void> {
  await emitNotificationEventLegacy(
    'container.health.failed',
    'warning',
    `Container ${containerName} health check failed`,
    { containerId, containerName, healthStatus }
  );
}

/**
 * Emit deployment started event
 */
export async function emitDeployStarted(
  repoName: string,
  repoId: string,
  branch: string
): Promise<void> {
  await emitNotificationEventLegacy(
    'repo.deploy.started',
    'info',
    `Deployment started for repository ${repoName}`,
    { repoName, repoId, branch }
  );
}

/**
 * Emit deployment success event
 */
export async function emitDeploySuccess(
  repoName: string,
  duration: number,
  servicesDeployed: string[]
): Promise<void> {
  await emitNotificationEventLegacy(
    'repo.deploy.success',
    'info',
    `Deployment completed successfully for ${repoName}`,
    { repoName, duration, servicesDeployed }
  );
}

/**
 * Emit deployment failed event
 */
export async function emitDeployFailed(
  repoName: string,
  error: string,
  stage: string
): Promise<void> {
  await emitNotificationEventLegacy(
    'repo.deploy.failed',
    'critical',
    `Deployment failed for ${repoName}: ${error}`,
    { repoName, error, stage }
  );
}

/**
 * Emit deployment rolled back event
 */
export async function emitDeployRolledBack(repoName: string, reason: string): Promise<void> {
  await emitNotificationEventLegacy(
    'repo.deploy.rolled_back',
    'warning',
    `Deployment rolled back for ${repoName}`,
    { repoName, reason }
  );
}

/**
 * Emit webhook received event
 */
export async function emitWebhookReceived(
  provider: string,
  repo: string,
  event: string
): Promise<void> {
  await emitNotificationEventLegacy(
    'repo.webhook.received',
    'info',
    `Webhook received from ${provider} for ${repo}`,
    { provider, repo, event }
  );
}

/**
 * Emit system upgrade started event
 */
export async function emitSystemUpgradeStarted(
  targetVersion: string,
  currentVersion: string
): Promise<void> {
  await emitNotificationEventLegacy(
    'system.upgrade.started',
    'warning',
    `System upgrade to version ${targetVersion} started`,
    { targetVersion, currentVersion }
  );
}

/**
 * Emit system upgrade completed event
 */
export async function emitSystemUpgradeCompleted(version: string): Promise<void> {
  await emitNotificationEventLegacy(
    'system.upgrade.completed',
    'info',
    `System successfully upgraded to version ${version}`,
    { version }
  );
}

/**
 * Emit system upgrade failed event
 */
export async function emitSystemUpgradeFailed(error: string): Promise<void> {
  await emitNotificationEventLegacy(
    'system.upgrade.failed',
    'critical',
    `System upgrade failed: ${error}`,
    { error }
  );
}

/**
 * Emit auth login success event
 */
export async function emitAuthLoginSuccess(username: string, ip: string): Promise<void> {
  await emitNotificationEventLegacy(
    'auth.login.success',
    'info',
    `User ${username} logged in from ${ip}`,
    { username, ip }
  );
}

/**
 * Emit auth login failed event
 */
export async function emitAuthLoginFailed(
  username: string,
  ip: string,
  reason: string
): Promise<void> {
  await emitNotificationEventLegacy(
    'auth.login.failed',
    'warning',
    `Failed login attempt for ${username} from ${ip}`,
    { username, ip, reason }
  );
}

/**
 * Emit auth password changed event
 */
export async function emitAuthPasswordChanged(username: string): Promise<void> {
  await emitNotificationEventLegacy(
    'auth.password.changed',
    'info',
    `User ${username} changed their password`,
    { username }
  );
}

/**
 * Emit security brute force attack detected event
 */
export async function emitSecurityBruteForce(
  ip: string,
  failedAttempts: number,
  targetEndpoint: string
): Promise<void> {
  await emitNotificationEventLegacy(
    'security.brute_force',
    'critical',
    `Possible brute force attack detected from ${ip}`,
    { ip, failedAttempts, targetEndpoint }
  );
}

/**
 * Emit security unauthorized access attempt event
 */
export async function emitSecurityUnauthorizedAccess(
  username: string,
  resource: string,
  ip: string
): Promise<void> {
  await emitNotificationEventLegacy(
    'security.unauthorized_access',
    'critical',
    `Unauthorized access attempt to ${resource} by ${username}`,
    { username, resource, ip }
  );
}
