import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, rm } from 'fs/promises';
import os from 'os';
import path from 'path';
import { createApp } from '../../src/app.js';
import type { Config } from '../../src/config/index.js';
import * as eventDispatcher from '../../src/services/eventDispatcher.js';

const tempDirs: string[] = [];
const TEST_INTERNAL_SECRET = 'test-internal-api-secret-minimum-32-chars';

async function buildConfig(): Promise<Config> {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), 'dockpilot-events-test-'));
  tempDirs.push(dataDir);

  return {
    port: 3000,
    host: '127.0.0.1',
    corsOrigin: '*',
    jwtSecret: 'test-secret-with-at-least-thirty-two-characters',
    jwtExpiresIn: '15m',
    refreshTokenExpiresIn: '7d',
    dockerControlUrl: 'http://127.0.0.1:3901',
    tunnelControlUrl: 'http://127.0.0.1:3902',
    dataDir,
    logLevel: 'error',
    rateLimitMax: 100,
    rateLimitWindow: '1 minute',
    masterKey: 'test-master-key-with-at-least-16-chars',
    internalApiSecret: TEST_INTERNAL_SECRET,
  };
}

describe('Internal events endpoint integration', () => {
  beforeEach(() => {
    vi.spyOn(eventDispatcher, 'emitNotificationEvent').mockResolvedValue({
      eventType: 'container.crashed',
      sent: 1,
      failed: 0,
      skipped: 0,
      results: [{ channelId: 'channel-1', success: true }],
    });
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    while (tempDirs.length > 0) {
      const dir = tempDirs.pop();
      if (dir) {
        await rm(dir, { recursive: true, force: true });
      }
    }
  });

  it('accepts events with valid internal secret without JWT', async () => {
    const app = await createApp(await buildConfig());

    const response = await app.inject({
      method: 'POST',
      url: '/api/notifications/events',
      headers: {
        'x-internal-secret': TEST_INTERNAL_SECRET,
      },
      payload: {
        eventType: 'container.crashed',
        severity: 'critical',
        message: 'Container nginx crashed',
        metadata: { containerId: 'abc123', exitCode: 1 },
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      success: true,
      message: 'Event processed successfully',
    });
    expect(eventDispatcher.emitNotificationEvent).toHaveBeenCalledWith(
      'container.crashed',
      'critical',
      'Container nginx crashed',
      { containerId: 'abc123', exitCode: 1 }
    );

    await app.close();
  });

  it('rejects events without internal secret', async () => {
    const app = await createApp(await buildConfig());

    const response = await app.inject({
      method: 'POST',
      url: '/api/notifications/events',
      payload: {
        eventType: 'container.crashed',
        severity: 'critical',
        message: 'Container nginx crashed',
      },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({
      success: false,
      error: { message: 'Invalid or missing internal API secret' },
    });

    await app.close();
  });

  it('rejects events with invalid internal secret', async () => {
    const app = await createApp(await buildConfig());

    const response = await app.inject({
      method: 'POST',
      url: '/api/notifications/events',
      headers: {
        'x-internal-secret': 'wrong-secret-value-that-is-long-enough',
      },
      payload: {
        eventType: 'container.crashed',
        severity: 'critical',
        message: 'Container nginx crashed',
      },
    });

    expect(response.statusCode).toBe(401);

    await app.close();
  });

  it('rejects events with missing required fields', async () => {
    const app = await createApp(await buildConfig());

    const response = await app.inject({
      method: 'POST',
      url: '/api/notifications/events',
      headers: {
        'x-internal-secret': TEST_INTERNAL_SECRET,
      },
      payload: {
        eventType: 'container.crashed',
      },
    });

    expect(response.statusCode).toBe(400);

    await app.close();
  });
});
