import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { Duplex } from 'stream';
import { getDocker } from '../services/docker.js';

interface LogQueryParams {
  follow?: string;
  tail?: string;
  timestamps?: string;
  since?: string;
  until?: string;
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

/**
 * WebSocket handler for container logs streaming
 * Endpoint: /api/containers/:id/logs/stream
 */
export async function registerContainerLogsWebSocket(fastify: FastifyInstance): Promise<void> {
  fastify.get(
    '/api/containers/:id/logs/stream',
    { websocket: true },
    async (connection: WebSocketLike | { socket: WebSocketLike }, request: FastifyRequest) => {
      const socket = getSocket(connection);
      const params = request.params as { id: string };
      const query = request.query as LogQueryParams;
      const { id } = params;
      const { tail = '100', timestamps = 'true', since, until } = query;

      let stream: Duplex | null = null;
      let isClosed = false;

      const cleanup = () => {
        if (isClosed) return;
        isClosed = true;

        if (stream) {
          stream.destroy();
          stream = null;
        }

        try {
          socket.close();
        } catch {
          // Socket may already be closed
        }

        request.log.debug({ containerId: id }, 'Container logs WebSocket cleaned up');
      };

      try {
        const docker = getDocker();
        const container = docker.getContainer(id);

        // Verify container exists
        await container.inspect();

        const tailCount = parseInt(tail, 10) || 100;
        const logsOptions = {
          stdout: true,
          stderr: true,
          follow: true as const,
          tail: tailCount,
          timestamps: timestamps !== 'false',
          ...(since && { since: parseInt(since, 10) }),
          ...(until && { until: parseInt(until, 10) }),
        };

        request.log.info(
          { containerId: id, options: logsOptions },
          'Starting container logs stream'
        );

        // Get logs stream - when follow: true, Dockerode returns a stream
        stream = (await container.logs(logsOptions)) as unknown as Duplex;

        // Send connection established message
        socket.send(
          JSON.stringify({
            type: 'connected',
            containerId: id,
            timestamp: Date.now(),
          })
        );

        // Handle incoming data from container
        stream.on('data', (chunk: Buffer) => {
          if (isClosed) return;

          try {
            // Docker log stream format: [header(8 bytes)][payload]
            // Header: [streamType(1 byte)][padding(3 bytes)][length(4 bytes)]
            const message = parseDockerLogStream(chunk);

            socket.send(
              JSON.stringify({
                type: 'log',
                data: message,
                timestamp: Date.now(),
              })
            );
          } catch (err) {
            request.log.error({ err }, 'Error parsing log chunk');
          }
        });

        // Handle stream errors
        stream.on('error', (err: Error) => {
          request.log.error({ err, containerId: id }, 'Container logs stream error');

          if (!isClosed) {
            socket.send(
              JSON.stringify({
                type: 'error',
                error: err.message,
                timestamp: Date.now(),
              })
            );
            cleanup();
          }
        });

        // Handle stream end
        stream.on('end', () => {
          if (!isClosed) {
            socket.send(
              JSON.stringify({
                type: 'end',
                message: 'Log stream ended',
                timestamp: Date.now(),
              })
            );
            cleanup();
          }
        });

        // Handle client disconnect
        socket.on('close', () => {
          request.log.info({ containerId: id }, 'Client disconnected from logs stream');
          cleanup();
        });

        // Handle client errors - handler receives (data?: unknown)
        socket.on('error', (data?: unknown) => {
          const err = data instanceof Error ? data : new Error(String(data));
          request.log.error({ err, containerId: id }, 'WebSocket error');
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
        request.log.error({ err, containerId: id }, 'Failed to start container logs stream');

        let errorMessage = err.message;
        let statusCode = 500;

        if (err.message.includes('No such container')) {
          errorMessage = 'Container not found';
          statusCode = 404;
        } else if (
          err.message.includes('container is not running') ||
          err.message.includes('configured for logging')
        ) {
          errorMessage = 'Container is not running or has no logs available';
          statusCode = 400;
        }

        socket.send(
          JSON.stringify({
            type: 'error',
            error: errorMessage,
            code: statusCode,
            timestamp: Date.now(),
          })
        );

        cleanup();
      }
    }
  );
}

/**
 * Parse Docker multiplexed log stream format
 * Docker sends logs with an 8-byte header: [stream type][0][0][0][size (4 bytes)]
 */
function parseDockerLogStream(buffer: Buffer): string {
  const messages: string[] = [];
  let offset = 0;

  while (offset < buffer.length) {
    // Need at least 8 bytes for header
    if (offset + 8 > buffer.length) break;

    // Read payload size (big-endian, 4 bytes starting at offset 4)
    const payloadSize = buffer.readUInt32BE(offset + 4);

    // Check if we have enough data for the payload
    if (offset + 8 + payloadSize > buffer.length) break;

    // Extract payload
    const payload = buffer.slice(offset + 8, offset + 8 + payloadSize);
    messages.push(payload.toString('utf-8'));

    offset += 8 + payloadSize;
  }

  // If we couldn't parse any messages, return the whole buffer as string
  if (messages.length === 0) {
    return buffer.toString('utf-8').replace(/\x00/g, '');
  }

  return messages.join('');
}
