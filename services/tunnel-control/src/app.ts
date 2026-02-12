import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import type { Config } from './config/index.js';
import { initLogger, getLogger } from './utils/logger.js';
import {
  initCloudflared,
  checkCloudflaredInstalled,
  getCloudflaredVersion,
} from './services/cloudflared.js';
import { initCloudflareAPI } from './services/cloudflare-api.js';
import { initCredentials } from './services/credentials.js';
import { tunnelRoutes } from './routes/tunnels.js';
import { authRoutes } from './routes/auth.js';
import { ingressRoutes } from './routes/ingress.js';
import { healthRoutes } from './routes/health.js';
import { errorHandler } from './errors/index.js';

export async function createApp(config: Config) {
  // Initialize logger
  initLogger(config);
  const logger = getLogger();

  const fastify = Fastify({
    loggerInstance: logger,
    requestIdHeader: 'x-request-id',
    genReqId: () => crypto.randomUUID(),
  });

  // Register plugins
  await fastify.register(cors, {
    origin: true,
    credentials: true,
  });

  await fastify.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'blob:'],
        connectSrc: ["'self'", 'ws:', 'wss:'],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
  });

  // Initialize services
  initCloudflared(config);
  initCloudflareAPI(config);
  initCredentials(config);

  // Check cloudflared on startup
  const cloudflaredInstalled = await checkCloudflaredInstalled();
  if (!cloudflaredInstalled) {
    fastify.log.warn('cloudflared binary not found. Tunnel features will not work.');
  } else {
    try {
      const version = await getCloudflaredVersion();
      fastify.log.info(`cloudflared version ${version} found and ready`);
    } catch (error) {
      fastify.log.warn('cloudflared binary found but version check failed');
    }
  }

  // Error handler
  fastify.setErrorHandler(errorHandler);

  // Not found handler
  fastify.setNotFoundHandler((request, reply) => {
    reply.status(404).send({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: `Route ${request.method} ${request.url} not found`,
      },
    });
  });

  // Register routes
  await fastify.register(healthRoutes, { prefix: '/api' });
  await fastify.register(authRoutes, { prefix: '/api' });
  await fastify.register(tunnelRoutes, { prefix: '/api' });
  await fastify.register(ingressRoutes, { prefix: '/api' });

  logger.info('All routes registered successfully');

  return fastify;
}
