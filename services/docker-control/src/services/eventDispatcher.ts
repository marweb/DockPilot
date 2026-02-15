export type EventSeverity = 'info' | 'warning' | 'critical';

export interface NotificationEvent {
  eventType: string;
  severity: EventSeverity;
  message: string;
  metadata: Record<string, unknown>;
  timestamp: string;
}

/**
 * Send notification to api-gateway notification service
 */
async function sendToNotificationService(event: NotificationEvent): Promise<void> {
  const apiGatewayUrl = process.env.API_GATEWAY_URL || 'http://api-gateway:3000';

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(`${apiGatewayUrl}/api/notifications/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(event),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(`Failed to send event to notification service: ${response.status}`);
    }
  } catch (error) {
    console.warn(
      'Failed to send event to notification service:',
      error instanceof Error ? error.message : String(error)
    );
  }
}

/**
 * Emit a notification event
 * This is fire-and-forget: errors are logged but don't block the main operation
 */
export async function emitNotificationEvent(
  eventType: string,
  severity: EventSeverity,
  message: string,
  metadata: Record<string, unknown> = {}
): Promise<void> {
  try {
    const event: NotificationEvent = {
      eventType,
      severity,
      message,
      metadata,
      timestamp: new Date().toISOString(),
    };

    // Send to api-gateway notification service
    await sendToNotificationService(event);
  } catch (error) {
    // Log error but don't throw - events are optional
    console.warn(
      'Failed to emit notification event:',
      error instanceof Error ? error.message : String(error)
    );
  }
}

/**
 * Emit system upgrade started event
 */
export async function emitSystemUpgradeStarted(
  targetVersion: string,
  currentVersion: string
): Promise<void> {
  await emitNotificationEvent(
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
  await emitNotificationEvent(
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
  await emitNotificationEvent(
    'system.upgrade.failed',
    'critical',
    `System upgrade failed: ${error}`,
    { error }
  );
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
  await emitNotificationEvent(
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
  await emitNotificationEvent(
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
  await emitNotificationEvent(
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
  await emitNotificationEvent(
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
  await emitNotificationEvent(
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
  await emitNotificationEvent(
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
  await emitNotificationEvent(
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
  await emitNotificationEvent(
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
  await emitNotificationEvent(
    'repo.webhook.received',
    'info',
    `Webhook received from ${provider} for ${repo}`,
    { provider, repo, event }
  );
}
