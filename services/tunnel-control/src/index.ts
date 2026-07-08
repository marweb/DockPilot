import { loadConfig } from './config/index.js';
import { createApp } from './app.js';
import { getLogger } from './utils/logger.js';
import {
  checkCloudflaredInstalled,
  startConfiguredAutoStartTunnels,
} from './services/cloudflared.js';
import { initCredentials, migratePlainCredentials } from './services/credentials.js';

async function main() {
  const config = loadConfig();
  initCredentials(config);
  const app = await createApp(config);
  const logger = getLogger();

  try {
    const migrated = await migratePlainCredentials();
    if (migrated > 0) {
      logger.info(`Migrated ${migrated} plain-text Cloudflare credential(s) to encrypted storage`);
    }
  } catch (error) {
    logger.warn({ error }, 'Failed to migrate plain-text credentials');
  }

  // Check cloudflared on startup
  const cloudflaredInstalled = await checkCloudflaredInstalled();
  if (!cloudflaredInstalled) {
    logger.warn('cloudflared binary not found. Tunnel features will not work.');
  }

  // Start server
  try {
    await app.listen({ port: config.port, host: config.host });
    logger.info(`Tunnel Control service listening on http://${config.host}:${config.port}`);

    await startConfiguredAutoStartTunnels();
  } catch (err) {
    logger.error(err);
    process.exit(1);
  }

  // Graceful shutdown
  const signals = ['SIGINT', 'SIGTERM'] as const;
  for (const signal of signals) {
    process.on(signal, async () => {
      logger.info(`Received ${signal}, shutting down...`);
      await app.close();
      process.exit(0);
    });
  }

  // Handle uncaught exceptions
  process.on('uncaughtException', (err) => {
    logger.error({ err }, 'Uncaught exception');
    process.exit(1);
  });

  process.on('unhandledRejection', (reason, promise) => {
    logger.error({ reason, promise }, 'Unhandled rejection');
  });
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
