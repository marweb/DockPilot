import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { loadConfig } from '../../src/config/index.js';

describe('tunnel-control health endpoint', () => {
  let originalMasterKey: string | undefined;

  beforeEach(() => {
    originalMasterKey = process.env.MASTER_KEY;
    process.env.MASTER_KEY = 'test-master-key-with-at-least-16-chars';
    process.env.LOG_LEVEL = 'error';
  });

  afterEach(() => {
    process.env.MASTER_KEY = originalMasterKey;
  });

  it('returns healthy status at /healthz', async () => {
    const config = loadConfig();
    const app = await createApp(config);

    const response = await app.inject({
      method: 'GET',
      url: '/healthz',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ status: 'alive' });

    await app.close();
  });
});
