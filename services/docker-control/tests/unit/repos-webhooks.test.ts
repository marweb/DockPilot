import { createHmac } from 'crypto';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Config } from '../../src/config/index.js';

const config: Config = {
  port: 3001,
  host: '127.0.0.1',
  dockerHost: 'unix:///var/run/docker.sock',
  logLevel: 'error',
};

describe('repos webhook auth and idempotency', () => {
  let reposDir = '';

  beforeEach(async () => {
    reposDir = await mkdtemp(path.join(tmpdir(), 'dockpilot-repos-tests-'));
    process.env.REPOS_DIR = reposDir;
    process.env.NODE_ENV = 'test';
    process.env.PUBLIC_BASE_URL = 'https://dockpilot.test';
    process.env.GITHUB_WEBHOOK_SECRET = 'github-secret-test';
    process.env.GITLAB_WEBHOOK_SECRET = 'gitlab-secret-test';
    process.env.MASTER_KEY = 'test-master-key-32-characters-minimum';
  });

  afterEach(async () => {
    vi.resetModules();
    delete process.env.REPOS_DIR;
    delete process.env.PUBLIC_BASE_URL;
    delete process.env.GITHUB_WEBHOOK_SECRET;
    delete process.env.GITLAB_WEBHOOK_SECRET;
    delete process.env.MASTER_KEY;

    if (reposDir) {
      await rm(reposDir, { recursive: true, force: true });
    }
  });

  it('rejects GitHub webhook with invalid signature', async () => {
    const { createApp } = await import('../../src/app.js');
    const app = await createApp(config);

    const response = await app.inject({
      method: 'POST',
      url: '/api/repos/webhooks/github',
      headers: {
        'content-type': 'application/json',
        'x-github-event': 'push',
        'x-github-delivery': 'delivery-invalid-signature',
        'x-hub-signature-256': 'sha256=invalid',
      },
      payload: JSON.stringify({ ref: 'refs/heads/main' }),
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({
      success: false,
      error: 'Invalid GitHub webhook signature',
    });

    await app.close();
  });

  it('marks duplicate GitHub delivery id as idempotent', async () => {
    const { createApp } = await import('../../src/app.js');
    const app = await createApp(config);

    const body = {
      ref: 'refs/heads/main',
      repository: {
        clone_url: 'https://github.com/example/repo.git',
      },
    };
    const payload = JSON.stringify(body);
    const signature = `sha256=${createHmac('sha256', process.env.GITHUB_WEBHOOK_SECRET || '')
      .update(payload)
      .digest('hex')}`;

    const headers = {
      'content-type': 'application/json',
      'x-github-event': 'push',
      'x-github-delivery': 'delivery-duplicate',
      'x-hub-signature-256': signature,
    };

    const first = await app.inject({
      method: 'POST',
      url: '/api/repos/webhooks/github',
      headers,
      payload,
    });

    expect(first.statusCode).toBe(200);
    expect(first.json()).toMatchObject({
      success: true,
      data: {
        handled: false,
      },
    });

    const second = await app.inject({
      method: 'POST',
      url: '/api/repos/webhooks/github',
      headers,
      payload,
    });

    expect(second.statusCode).toBe(200);
    expect(second.json()).toMatchObject({
      success: true,
      data: {
        duplicate: true,
        deliveryId: 'delivery-duplicate',
      },
    });

    await app.close();
  });

  it('rejects GitLab webhook with invalid token', async () => {
    const { createApp } = await import('../../src/app.js');
    const app = await createApp(config);

    const response = await app.inject({
      method: 'POST',
      url: '/api/repos/webhooks/gitlab',
      headers: {
        'content-type': 'application/json',
        'x-gitlab-event': 'Push Hook',
        'x-gitlab-event-uuid': 'gitlab-invalid-token',
        'x-gitlab-token': 'wrong-token',
      },
      payload: JSON.stringify({ ref: 'refs/heads/main' }),
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({
      success: false,
      error: 'Invalid GitLab webhook token',
    });

    await app.close();
  });

  it('marks duplicate GitLab delivery id as idempotent', async () => {
    const { createApp } = await import('../../src/app.js');
    const app = await createApp(config);

    const payload = JSON.stringify({
      ref: 'refs/heads/main',
      project: {
        git_http_url: 'https://gitlab.com/example/repo.git',
      },
    });

    const headers = {
      'content-type': 'application/json',
      'x-gitlab-event': 'Push Hook',
      'x-gitlab-event-uuid': 'gitlab-duplicate',
      'x-gitlab-token': process.env.GITLAB_WEBHOOK_SECRET || '',
    };

    const first = await app.inject({
      method: 'POST',
      url: '/api/repos/webhooks/gitlab',
      headers,
      payload,
    });

    expect(first.statusCode).toBe(200);
    expect(first.json()).toMatchObject({
      success: true,
      data: {
        handled: false,
      },
    });

    const second = await app.inject({
      method: 'POST',
      url: '/api/repos/webhooks/gitlab',
      headers,
      payload,
    });

    expect(second.statusCode).toBe(200);
    expect(second.json()).toMatchObject({
      success: true,
      data: {
        duplicate: true,
        deliveryId: 'gitlab-duplicate',
      },
    });

    await app.close();
  });

  it('rejects webhook calls when PUBLIC_BASE_URL is missing', async () => {
    delete process.env.PUBLIC_BASE_URL;
    vi.resetModules();
    const { createApp } = await import('../../src/app.js');
    const app = await createApp(config);

    const payload = JSON.stringify({ ref: 'refs/heads/main' });
    const signature = `sha256=${createHmac('sha256', process.env.GITHUB_WEBHOOK_SECRET || '')
      .update(payload)
      .digest('hex')}`;

    const response = await app.inject({
      method: 'POST',
      url: '/api/repos/webhooks/github',
      headers: {
        'content-type': 'application/json',
        'x-github-event': 'push',
        'x-github-delivery': 'delivery-no-public-url',
        'x-hub-signature-256': signature,
      },
      payload,
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      success: false,
      error: 'Webhook endpoint requires a publicly reachable PUBLIC_BASE_URL',
    });

    await app.close();
  });
});
