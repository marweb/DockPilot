import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { ChildProcess } from 'child_process';
import { spawn } from 'child_process';
import { randomUUID } from 'crypto';

interface BuildStreamClient {
  socket: {
    send: (data: string) => void;
    close: () => void;
    readyState: number;
    on: (event: string, handler: (data?: unknown) => void) => void;
  };
  buildId: string;
  lastLogIndex: number;
}

interface BuildMessage {
  type: 'start' | 'cancel' | 'ping';
  data?: unknown;
}

/** WebSocket-like interface - @fastify/websocket passes socket as first param */
interface WebSocketLike {
  send: (data: string) => void;
  close: (code?: number, reason?: string) => void;
  readyState: number;
  on: (event: string, handler: (data?: unknown) => void) => void;
}

function getSocket(conn: WebSocketLike | { socket: WebSocketLike }): WebSocketLike {
  return 'socket' in conn ? conn.socket : conn;
}

// Store active builds with their logs and clients
interface ActiveBuild {
  id: string;
  status: 'building' | 'success' | 'error' | 'cancelled';
  process: ChildProcess;
  logs: string[];
  clients: Set<BuildStreamClient>;
  startedAt: Date;
  finishedAt?: Date;
  error?: string;
  imageId?: string;
}

const activeBuilds = new Map<string, ActiveBuild>();

// Cleanup completed builds after 1 hour
const BUILD_CLEANUP_INTERVAL = 60 * 60 * 1000;
const BUILD_MAX_AGE = 60 * 60 * 1000;

setInterval(() => {
  const now = Date.now();
  for (const [id, build] of activeBuilds.entries()) {
    if (build.status !== 'building') {
      const age = now - (build.finishedAt?.getTime() || build.startedAt.getTime());
      if (age > BUILD_MAX_AGE) {
        activeBuilds.delete(id);
      }
    }
  }
}, BUILD_CLEANUP_INTERVAL);

/**
 * Get active build by ID
 */
export function getActiveBuild(buildId: string): ActiveBuild | undefined {
  return activeBuilds.get(buildId);
}

/**
 * Get all active builds
 */
export function getAllActiveBuilds(): Array<{
  id: string;
  status: ActiveBuild['status'];
  startedAt: Date;
}> {
  return Array.from(activeBuilds.entries()).map(([id, build]) => ({
    id,
    status: build.status,
    startedAt: build.startedAt,
  }));
}

/**
 * Start a new Docker build and return build ID
 */
export async function startDockerBuild(options: {
  context: string;
  dockerfile?: string;
  tags: string[];
  buildArgs?: Record<string, string>;
  target?: string;
  platform?: string;
  noCache?: boolean;
  pull?: boolean;
  labels?: Record<string, string>;
}): Promise<string> {
  const buildId = randomUUID();
  const logs: string[] = [];

  // Build docker buildx command args
  const args = ['buildx', 'build', '--progress=plain', '--buildkitd-flags', '--debug'];

  // Add tags
  for (const tag of options.tags) {
    args.push('-t', tag);
  }

  // Add dockerfile if specified
  if (options.dockerfile) {
    args.push('-f', options.dockerfile);
  }

  // Add target if specified
  if (options.target) {
    args.push('--target', options.target);
  }

  // Add platform if specified
  if (options.platform) {
    args.push('--platform', options.platform);
  }

  // Add no-cache flag
  if (options.noCache) {
    args.push('--no-cache');
  }

  // Add pull flag
  if (options.pull) {
    args.push('--pull');
  }

  // Add build args
  if (options.buildArgs) {
    for (const [key, value] of Object.entries(options.buildArgs)) {
      args.push('--build-arg', `${key}=${value}`);
    }
  }

  // Add labels
  if (options.labels) {
    for (const [key, value] of Object.entries(options.labels)) {
      args.push('--label', `${key}=${value}`);
    }
  }

  // Add context path
  args.push(options.context);

  // Start build process
  const buildProcess = spawn('docker', args, {
    env: process.env,
  });

  const build: ActiveBuild = {
    id: buildId,
    status: 'building',
    process: buildProcess,
    logs: [],
    clients: new Set(),
    startedAt: new Date(),
  };

  activeBuilds.set(buildId, build);

  // Handle stdout
  buildProcess.stdout?.on('data', (data: Buffer) => {
    const message = data.toString();
    logs.push(message);
    broadcastToClients(buildId, { type: 'log', data: message });
  });

  // Handle stderr
  buildProcess.stderr?.on('data', (data: Buffer) => {
    const message = data.toString();
    logs.push(message);
    broadcastToClients(buildId, { type: 'log', data: message });
  });

  // Handle process close
  buildProcess.on('close', (code) => {
    const currentBuild = activeBuilds.get(buildId);
    if (currentBuild) {
      currentBuild.status = code === 0 ? 'success' : 'error';
      currentBuild.finishedAt = new Date();

      broadcastToClients(buildId, {
        type: 'complete',
        status: currentBuild.status,
        exitCode: code,
      });

      // Remove clients after completion
      currentBuild.clients.clear();
    }
  });

  // Handle process error
  buildProcess.on('error', (err) => {
    const currentBuild = activeBuilds.get(buildId);
    if (currentBuild) {
      currentBuild.status = 'error';
      currentBuild.error = err.message;
      currentBuild.finishedAt = new Date();

      broadcastToClients(buildId, {
        type: 'error',
        error: err.message,
      });

      currentBuild.clients.clear();
    }
  });

  return buildId;
}

/**
 * Cancel an active build
 */
export function cancelBuild(buildId: string): boolean {
  const build = activeBuilds.get(buildId);
  if (!build || build.status !== 'building') {
    return false;
  }

  build.process.kill('SIGTERM');
  build.status = 'cancelled';
  build.finishedAt = new Date();

  broadcastToClients(buildId, {
    type: 'cancelled',
    message: 'Build was cancelled by user',
  });

  build.clients.clear();
  return true;
}

/**
 * Broadcast message to all clients of a build
 */
function broadcastToClients(buildId: string, message: Record<string, unknown>): void {
  const build = activeBuilds.get(buildId);
  if (!build) return;

  const messageStr = JSON.stringify({
    ...message,
    timestamp: Date.now(),
    buildId,
  });

  for (const client of build.clients) {
    try {
      if (client.socket.readyState === 1) {
        client.socket.send(messageStr);
        client.lastLogIndex = build.logs.length;
      }
    } catch {
      // Client disconnected
      build.clients.delete(client);
    }
  }
}

/**
 * WebSocket handler for build progress streaming
 * Endpoint: /api/builds/:id/stream
 */
export async function registerBuildStreamWebSocket(fastify: FastifyInstance): Promise<void> {
  fastify.get(
    '/api/builds/:id/stream',
    { websocket: true },
    async (connection: WebSocketLike | { socket: WebSocketLike }, request: FastifyRequest) => {
      const socket = getSocket(connection);
      const params = request.params as { id: string };
      const { id: buildId } = params;
      let isClosed = false;
      let client: BuildStreamClient | null = null;

      const cleanup = () => {
        if (isClosed) return;
        isClosed = true;

        const build = activeBuilds.get(buildId);
        if (build && client) {
          build.clients.delete(client);
        }

        try {
          socket.close();
        } catch {
          // Socket may already be closed
        }

        request.log.debug({ buildId }, 'Build stream WebSocket cleaned up');
      };

      try {
        const build = activeBuilds.get(buildId);

        if (!build) {
          socket.send(
            JSON.stringify({
              type: 'error',
              error: 'Build not found',
              code: 404,
              timestamp: Date.now(),
            })
          );
          cleanup();
          return;
        }

        // Register client
        client = {
          socket,
          buildId,
          lastLogIndex: 0,
        };
        build.clients.add(client);

        request.log.info({ buildId }, 'Client connected to build stream');

        // Send connection established message
        socket.send(
          JSON.stringify({
            type: 'connected',
            buildId,
            status: build.status,
            timestamp: Date.now(),
          })
        );

        // Send existing logs to catch up
        if (build.logs.length > 0) {
          socket.send(
            JSON.stringify({
              type: 'logs',
              data: build.logs.join(''),
              timestamp: Date.now(),
            })
          );
          client.lastLogIndex = build.logs.length;
        }

        // If build already finished, send completion message
        if (build.status !== 'building') {
          socket.send(
            JSON.stringify({
              type: 'complete',
              status: build.status,
              error: build.error,
              timestamp: Date.now(),
            })
          );
        }

        // Handle messages from client
        socket.on('message', (rawData: unknown) => {
          if (isClosed) return;

          try {
            const data = String(rawData);
            const message: BuildMessage = JSON.parse(data);

            switch (message.type) {
              case 'cancel':
                const cancelled = cancelBuild(buildId);
                if (cancelled) {
                  socket.send(
                    JSON.stringify({
                      type: 'cancelled',
                      message: 'Build cancelled',
                      timestamp: Date.now(),
                    })
                  );
                }
                break;

              case 'ping':
                socket.send(
                  JSON.stringify({
                    type: 'pong',
                    timestamp: Date.now(),
                  })
                );
                break;
            }
          } catch {
            // Invalid message, ignore
          }
        });

        // Handle client disconnect
        socket.on('close', () => {
          request.log.info({ buildId }, 'Client disconnected from build stream');
          cleanup();
        });

        // Handle client errors - handler receives (data?: unknown)
        socket.on('error', (data?: unknown) => {
          const err = data instanceof Error ? data : new Error(String(data));
          request.log.error({ err, buildId }, 'WebSocket error');
          cleanup();
        });

        // Handle ping/pong to keep connection alive
        const pingInterval = setInterval(() => {
          if (isClosed || socket.readyState !== 1) {
            clearInterval(pingInterval);
            return;
          }

          socket.send(
            JSON.stringify({
              type: 'ping',
              timestamp: Date.now(),
            })
          );
        }, 30000);

        socket.on('close', () => {
          clearInterval(pingInterval);
        });
      } catch (error) {
        const err = error as Error;
        request.log.error({ err, buildId }, 'Error in build stream WebSocket');

        socket.send(
          JSON.stringify({
            type: 'error',
            error: err.message,
            timestamp: Date.now(),
          })
        );

        cleanup();
      }
    }
  );
}

/**
 * Alternative build stream using Docker API for detailed progress
 * This streams directly from docker buildx with JSON progress
 */
export async function registerBuildStreamJsonWebSocket(fastify: FastifyInstance): Promise<void> {
  fastify.get(
    '/api/builds/:id/stream/json',
    { websocket: true },
    async (connection: WebSocketLike | { socket: WebSocketLike }, request: FastifyRequest) => {
      const socket = getSocket(connection);
      const params = request.params as { id: string };
      const { id: buildId } = params;
      let isClosed = false;

      const cleanup = () => {
        if (isClosed) return;
        isClosed = true;

        try {
          socket.close();
        } catch {
          // Socket may already be closed
        }

        request.log.debug({ buildId }, 'Build JSON stream WebSocket cleaned up');
      };

      try {
        const build = activeBuilds.get(buildId);

        if (!build) {
          socket.send(
            JSON.stringify({
              type: 'error',
              error: 'Build not found',
              code: 404,
              timestamp: Date.now(),
            })
          );
          cleanup();
          return;
        }

        // Send connection established
        socket.send(
          JSON.stringify({
            type: 'connected',
            buildId,
            status: build.status,
            timestamp: Date.now(),
          })
        );

        // Watch for build completion
        const checkInterval = setInterval(() => {
          if (isClosed) {
            clearInterval(checkInterval);
            return;
          }

          const currentBuild = activeBuilds.get(buildId);
          if (!currentBuild) {
            socket.send(
              JSON.stringify({
                type: 'error',
                error: 'Build not found',
                code: 404,
                timestamp: Date.now(),
              })
            );
            clearInterval(checkInterval);
            cleanup();
            return;
          }

          // Send any new logs
          if (currentBuild.logs.length > 0) {
            socket.send(
              JSON.stringify({
                type: 'log',
                data: currentBuild.logs.join(''),
                timestamp: Date.now(),
              })
            );
          }

          // Check if build finished
          if (currentBuild.status !== 'building') {
            socket.send(
              JSON.stringify({
                type: 'complete',
                status: currentBuild.status,
                error: currentBuild.error,
                timestamp: Date.now(),
              })
            );
            clearInterval(checkInterval);
            cleanup();
          }
        }, 1000);

        // Handle client disconnect
        socket.on('close', () => {
          clearInterval(checkInterval);
          cleanup();
        });

        // Handle client errors
        socket.on('error', () => {
          clearInterval(checkInterval);
          cleanup();
        });
      } catch (error) {
        const err = error as Error;
        request.log.error({ err, buildId }, 'Error in build JSON stream WebSocket');
        cleanup();
      }
    }
  );
}
