import { loadConfig } from './config/index.js';
import { createApp } from './app.js';
import { checkDockerConnection } from './services/docker.js';

async function main() {
  const config = loadConfig();
  const app = await createApp(config);

  // Check Docker connection on startup
  const dockerConnected = await checkDockerConnection();
  if (!dockerConnected) {
    app.log.warn('Docker daemon not reachable. Some features may not work.');
  } else {
    app.log.info('Docker daemon connected successfully');
  }

  // Start server
  try {
    await app.listen({ port: config.port, host: config.host });
    app.log.info(`Docker Control service listening on http://${config.host}:${config.port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }

  // Graceful shutdown
  const signals = ['SIGINT', 'SIGTERM'] as const;
  for (const signal of signals) {
    process.on(signal, async () => {
      app.log.info(`Received ${signal}, shutting down...`);
      await app.close();
      process.exit(0);
    });
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
