import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { Config } from '../config/index.js';
import WebSocket from 'ws';

interface WebSocketClient {
  socket: {
    send: (data: string | WebSocket.RawData) => void;
    close: (code?: number, reason?: string) => void;
    readyState: number;
    on: (event: string, handler: (data?: unknown) => void) => void;
  };
  targetWs: WebSocket | null;
  isClosed: boolean;
  pingInterval?: NodeJS.Timeout;
}

interface Connection {
  socket: {
    send: (data: string | WebSocket.RawData) => void;
    close: (code?: number, reason?: string) => void;
    readyState: number;
    on: (event: string, handler: (data?: unknown) => void) => void;
  };
}

/**
 * WebSocket proxy with JWT authentication
 * Routes WebSocket connections to docker-control service
 */
export async function registerWebSocketProxy(
  fastify: FastifyInstance,
  config: Config
): Promise<void> {
  // Container logs WebSocket proxy
  fastify.get(
    '/ws/containers/:id/logs',
    { websocket: true },
    async (connection: Connection, request: FastifyRequest) => {
      const params = request.params as { id: string };
      const { id } = params;
      const query = new URLSearchParams(request.url.split('?')[1] || '');

      // Authenticate WebSocket connection
      const authenticated = await authenticateWebSocket(connection, request, fastify);
      if (!authenticated) return;

      const targetUrl = `${config.dockerControlUrl}/api/containers/${id}/logs/stream?${query.toString()}`;

      await proxyWebSocket(connection, request, targetUrl, fastify);
    }
  );

  // Container exec WebSocket proxy
  fastify.get(
    '/ws/containers/:id/exec',
    { websocket: true },
    async (connection: Connection, request: FastifyRequest) => {
      const params = request.params as { id: string };
      const { id } = params;
      const query = new URLSearchParams(request.url.split('?')[1] || '');

      // Authenticate WebSocket connection
      const authenticated = await authenticateWebSocket(connection, request, fastify);
      if (!authenticated) return;

      const targetUrl = `${config.dockerControlUrl}/api/containers/${id}/exec?${query.toString()}`;

      await proxyWebSocket(connection, request, targetUrl, fastify);
    }
  );

  // Build stream WebSocket proxy
  fastify.get(
    '/ws/builds/:id',
    { websocket: true },
    async (connection: Connection, request: FastifyRequest) => {
      const params = request.params as { id: string };
      const { id } = params;

      // Authenticate WebSocket connection
      const authenticated = await authenticateWebSocket(connection, request, fastify);
      if (!authenticated) return;

      const targetUrl = `${config.dockerControlUrl}/api/builds/${id}/stream`;

      await proxyWebSocket(connection, request, targetUrl, fastify);
    }
  );

  // Build stream JSON WebSocket proxy
  fastify.get(
    '/ws/builds/:id/json',
    { websocket: true },
    async (connection: Connection, request: FastifyRequest) => {
      const params = request.params as { id: string };
      const { id } = params;

      // Authenticate WebSocket connection
      const authenticated = await authenticateWebSocket(connection, request, fastify);
      if (!authenticated) return;

      const targetUrl = `${config.dockerControlUrl}/api/builds/${id}/stream/json`;

      await proxyWebSocket(connection, request, targetUrl, fastify);
    }
  );

  // Generic WebSocket proxy for docker-control
  fastify.get(
    '/ws/*',
    { websocket: true },
    async (connection: Connection, request: FastifyRequest) => {
      // Authenticate WebSocket connection
      const authenticated = await authenticateWebSocket(connection, request, fastify);
      if (!authenticated) return;

      const path = request.url.replace('/ws/', '');
      const targetUrl = `${config.dockerControlUrl}/ws/${path}`;

      await proxyWebSocket(connection, request, targetUrl, fastify);
    }
  );
}

/**
 * Authenticate WebSocket connection using JWT
 */
async function authenticateWebSocket(
  connection: Connection,
  request: FastifyRequest,
  fastify: FastifyInstance
): Promise<boolean> {
  try {
    // Get token from query params or headers
    const url = new URL(request.url, 'http://localhost');
    const token =
      url.searchParams.get('token') || request.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      connection.socket.send(
        JSON.stringify({
          type: 'error',
          error: 'Authentication required. Provide token via query param or Authorization header.',
          code: 401,
        })
      );
      connection.socket.close(1008, 'Authentication required');
      return false;
    }

    // Verify JWT token
    const decoded = fastify.jwt.verify(token) as {
      id: string;
      username: string;
      role: string;
    };

    // Attach user to request
    request.user = decoded;

    // Check permissions for WebSocket routes
    const urlPath = request.url.split('?')[0];
    const requiredPermission = getRequiredPermission(urlPath);

    if (requiredPermission && !hasPermission(decoded.role, requiredPermission)) {
      connection.socket.send(
        JSON.stringify({
          type: 'error',
          error: 'Insufficient permissions',
          code: 403,
        })
      );
      connection.socket.close(1008, 'Insufficient permissions');
      return false;
    }

    return true;
  } catch (error) {
    const err = error as Error;
    request.log.error({ err }, 'WebSocket authentication error');

    connection.socket.send(
      JSON.stringify({
        type: 'error',
        error: 'Invalid or expired token',
        code: 401,
      })
    );
    connection.socket.close(1008, 'Authentication failed');
    return false;
  }
}

/**
 * Get required permission for WebSocket route
 */
function getRequiredPermission(url: string): string | null {
  if (url.startsWith('/ws/containers/') && url.includes('/logs')) {
    return 'containers:logs';
  }
  if (url.startsWith('/ws/containers/') && url.includes('/exec')) {
    return 'containers:exec';
  }
  if (url.startsWith('/ws/builds/')) {
    return 'builds:get';
  }
  return null;
}

/**
 * Check if role has permission
 */
function hasPermission(role: string, permission: string): boolean {
  const rolePermissions: Record<string, string[]> = {
    admin: ['*'],
    operator: [
      'containers:list',
      'containers:get',
      'containers:start',
      'containers:stop',
      'containers:restart',
      'containers:logs',
      'containers:exec',
      'containers:stats',
      'images:list',
      'images:get',
      'images:pull',
      'volumes:list',
      'volumes:get',
      'networks:list',
      'networks:get',
      'builds:create',
      'builds:get',
      'compose:list',
      'compose:get',
      'compose:up',
      'compose:down',
      'compose:logs',
      'system:*',
    ],
    viewer: [
      'containers:list',
      'containers:get',
      'containers:logs',
      'containers:stats',
      'images:list',
      'images:get',
      'volumes:list',
      'volumes:get',
      'networks:list',
      'networks:get',
      'builds:get',
      'compose:list',
      'compose:get',
      'compose:logs',
      'system:*',
    ],
  };

  const permissions = rolePermissions[role] || [];

  if (permissions.includes('*')) return true;
  if (permissions.includes(permission)) return true;

  // Check wildcard permissions
  const [resource] = permission.split(':');
  if (permissions.includes(`${resource}:*`)) return true;

  return false;
}

/**
 * Proxy WebSocket connection to target service
 */
async function proxyWebSocket(
  connection: Connection,
  request: FastifyRequest,
  targetUrl: string,
  fastify: FastifyInstance
): Promise<void> {
  const client: WebSocketClient = {
    socket: connection.socket,
    targetWs: null,
    isClosed: false,
  };

  const cleanup = () => {
    if (client.isClosed) return;
    client.isClosed = true;

    if (client.pingInterval) {
      clearInterval(client.pingInterval);
    }

    if (client.targetWs) {
      try {
        client.targetWs.close();
      } catch {
        // Already closed
      }
      client.targetWs = null;
    }

    try {
      connection.socket.close();
    } catch {
      // Already closed
    }

    request.log.debug({ targetUrl }, 'WebSocket proxy cleaned up');
  };

  try {
    // Create WebSocket connection to target
    const targetWs = new WebSocket(targetUrl);
    client.targetWs = targetWs;

    targetWs.on('open', () => {
      request.log.debug({ targetUrl }, 'WebSocket connected to target');

      // Forward messages from client to target
      connection.socket.on('message', (data: unknown) => {
        if (client.isClosed) return;

        try {
          if (targetWs.readyState === WebSocket.OPEN) {
            targetWs.send(data as string);
          }
        } catch (err) {
          request.log.error({ err }, 'Error forwarding message to target');
        }
      });

      // Forward messages from target to client
      targetWs.on('message', (data: WebSocket.RawData) => {
        if (client.isClosed) return;

        try {
          if (connection.socket.readyState === 1) {
            connection.socket.send(data);
          }
        } catch (err) {
          request.log.error({ err }, 'Error forwarding message to client');
        }
      });
    });

    // Handle target errors
    targetWs.on('error', (err: Error) => {
      request.log.error({ err, targetUrl }, 'Target WebSocket error');

      if (!client.isClosed) {
        try {
          connection.socket.send(
            JSON.stringify({
              type: 'error',
              error: 'Connection to backend service failed',
              timestamp: Date.now(),
            })
          );
        } catch {
          // Socket may be closed
        }
        cleanup();
      }
    });

    // Handle target close
    targetWs.on('close', (code: number, reason: Buffer) => {
      request.log.debug({ code, reason: reason.toString() }, 'Target WebSocket closed');
      cleanup();
    });

    // Handle client close
    connection.socket.on('close', () => {
      request.log.debug('Client WebSocket closed');
      cleanup();
    });

    // Handle client errors
    connection.socket.on('error', (err: Error) => {
      request.log.error({ err }, 'Client WebSocket error');
      cleanup();
    });

    // Setup ping/pong to keep connection alive
    client.pingInterval = setInterval(() => {
      if (client.isClosed) return;

      // Send ping through target if connected
      if (targetWs.readyState === WebSocket.OPEN) {
        targetWs.ping();
      }
    }, 30000);

    targetWs.on('pong', () => {
      // Target is alive
    });
  } catch (error) {
    const err = error as Error;
    request.log.error({ err, targetUrl }, 'Failed to create WebSocket proxy');

    connection.socket.send(
      JSON.stringify({
        type: 'error',
        error: 'Failed to establish connection to backend service',
        timestamp: Date.now(),
      })
    );

    cleanup();
  }
}
