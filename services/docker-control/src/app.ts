import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import websocket from '@fastify/websocket';
import pino from 'pino';
import type { Config } from './config/index.js';
import { initDocker } from './services/docker.js';
import { containerRoutes } from './routes/containers.js';
import { imageRoutes } from './routes/images.js';
import { volumeRoutes } from './routes/volumes.js';
import { networkRoutes } from './routes/networks.js';
import { systemRoutes } from './routes/system.js';
import { composeRoutes } from './routes/compose.js';
import { buildRoutes } from './routes/builds.js';
import { registerContainerLogsWebSocket } from './websocket/logs.js';
import { registerContainerExecWebSocket } from './websocket/exec.js';
import {
  registerBuildStreamWebSocket,
  registerBuildStreamJsonWebSocket,
} from './websocket/build.js';

export async function createApp(config: Config) {
  const logger = pino({
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
  });

  const fastify = Fastify({
    logger,
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

  await fastify.register(websocket);

  // Initialize Docker connection
  initDocker(config);

  // Health check middleware
  fastify.addHook('onRequest', async (request, reply) => {
    request.log.debug({ url: request.url, method: request.method }, 'Incoming request');
  });

  // Error handler
  fastify.setErrorHandler((error, request, reply) => {
    request.log.error({ error: error.message, stack: error.stack }, 'Request error');

    const statusCode = error.statusCode || 500;

    reply.status(statusCode).send({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error.message,
        details: process.env.NODE_ENV !== 'production' ? error.stack : undefined,
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

  // Legacy WebSocket routes (for backward compatibility)
  fastify.register(async function (fastify) {
    fastify.get('/ws/containers/:id/logs', { websocket: true }, async (connection, request) => {
      const { id } = request.params as { id: string };
      const { tail = 100 } = request.query as { tail?: number };

      try {
        const { getDocker } = await import('./services/docker.js');
        const docker = getDocker();
        const container = docker.getContainer(id);

        const stream = await container.logs({
          stdout: true,
          stderr: true,
          tail,
          follow: true,
          timestamps: true,
        });

        stream.on('data', (chunk) => {
          const message = chunk.toString('utf-8').replace(/\x00/g, '');
          connection.socket.send(JSON.stringify({ type: 'log', data: message }));
        });

        stream.on('error', (err) => {
          connection.socket.send(JSON.stringify({ type: 'error', data: err.message }));
          connection.socket.close();
        });

        connection.socket.on('close', () => {
          stream.destroy();
        });
      } catch (error) {
        const err = error as Error;
        connection.socket.send(JSON.stringify({ type: 'error', data: err.message }));
        connection.socket.close();
      }
    });

    fastify.get('/ws/containers/:id/exec', { websocket: true }, async (connection, request) => {
      const { id } = request.params as { id: string };
      const { cmd = '/bin/sh' } = request.query as { cmd?: string };

      try {
        const { getDocker } = await import('./services/docker.js');
        const docker = getDocker();
        const container = docker.getContainer(id);

        const exec = await container.exec({
          Cmd: [cmd],
          AttachStdin: true,
          AttachStdout: true,
          AttachStderr: true,
          Tty: true,
        });

        const stream = await exec.start({
          hijack: true,
          stdin: true,
          stdout: true,
          stderr: true,
        });

        connection.socket.on('message', (data) => {
          stream.write(data.toString());
        });

        stream.on('data', (chunk) => {
          connection.socket.send(chunk.toString());
        });

        stream.on('error', (err) => {
          connection.socket.send(JSON.stringify({ type: 'error', data: err.message }));
          connection.socket.close();
        });

        connection.socket.on('close', () => {
          stream.destroy();
        });
      } catch (error) {
        const err = error as Error;
        connection.socket.send(JSON.stringify({ type: 'error', data: err.message }));
        connection.socket.close();
      }
    });

    fastify.get('/ws/builds/:id', { websocket: true }, async (connection, request) => {
      const { id } = request.params as { id: string };

      connection.socket.send(JSON.stringify({ type: 'connected', buildId: id }));
    });
  });

  return fastify;
}
