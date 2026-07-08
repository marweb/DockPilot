import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import websocket from '@fastify/websocket';
import { validatorCompiler, serializerCompiler } from 'fastify-type-provider-zod';
import type { Config } from './config/index.js';
import { initDocker } from './services/docker.js';
import { containerRoutes } from './routes/containers.js';
import { imageRoutes } from './routes/images.js';
import { volumeRoutes } from './routes/volumes.js';
import { networkRoutes } from './routes/networks.js';
import { systemRoutes } from './routes/system.js';
import { composeRoutes } from './routes/compose.js';
import { repoRoutes } from './routes/repos.js';
import { buildRoutes } from './routes/builds.js';
import { registerContainerLogsWebSocket } from './websocket/logs.js';
import { registerContainerExecWebSocket } from './websocket/exec.js';
import {
  registerBuildStreamWebSocket,
  registerBuildStreamJsonWebSocket,
} from './websocket/build.js';

export async function createApp(config: Config) {
  const fastify = Fastify({
    logger: {
      level: config.logLevel,
      transport:
        process.env.NODE_ENV !== 'production'
          ? {
              target: 'pino-pretty',
              options: {
                colorize: true,
                translateTime: 'HH:MM:ss',
                ignore: 'pid,hostname',
              },
            }
          : undefined,
    },
    requestIdHeader: 'x-request-id',
    genReqId: () => crypto.randomUUID(),
  });

  // Enable Zod schemas in route `schema` blocks
  fastify.setValidatorCompiler(validatorCompiler);
  fastify.setSerializerCompiler(serializerCompiler);

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

  await fastify.register(websocket);

  // Initialize Docker connection
  initDocker(config);

  // Health check middleware
  fastify.addHook('onRequest', async (request, _reply) => {
    request.log.debug({ url: request.url, method: request.method }, 'Incoming request');
  });

  // Simple liveness probe for Docker healthcheck (accessible at /healthz)
  fastify.get('/healthz', async (_request, reply) => {
    return reply.send({ status: 'alive' });
  });

  // Error handler
  fastify.setErrorHandler((error, request, reply) => {
    const err = error as Error & { statusCode?: number; stack?: string };
    request.log.error({ error: err.message, stack: err.stack }, 'Request error');

    const statusCode = err.statusCode || 500;

    reply.status(statusCode).send({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: err.message,
        details: process.env.NODE_ENV !== 'production' ? err.stack : undefined,
      },
    });
  });

  // Register REST API routes
  await fastify.register(systemRoutes);
  await fastify.register(containerRoutes, { prefix: '/api' });
  await fastify.register(imageRoutes, { prefix: '/api' });
  await fastify.register(volumeRoutes, { prefix: '/api' });
  await fastify.register(networkRoutes, { prefix: '/api' });
  await fastify.register(composeRoutes, { prefix: '/api' });
  await fastify.register(repoRoutes, { prefix: '/api' });
  await fastify.register(buildRoutes, { prefix: '/api' });

  // Register WebSocket handlers
  await fastify.register(async function (fastify) {
    // Container logs WebSocket - /api/containers/:id/logs/stream
    await registerContainerLogsWebSocket(fastify);

    // Container exec WebSocket - /api/containers/:id/exec
    await registerContainerExecWebSocket(fastify);

    // Build stream WebSocket - /api/builds/:id/stream
    await registerBuildStreamWebSocket(fastify);

    // Build stream JSON WebSocket - /api/builds/:id/stream/json
    await registerBuildStreamJsonWebSocket(fastify);
  });

  return fastify;
}
