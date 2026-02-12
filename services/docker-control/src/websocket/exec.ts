import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { Duplex } from 'stream';
import { getDocker } from '../services/docker.js';

interface ExecQueryParams {
  cmd?: string;
  tty?: string;
  user?: string;
  privileged?: string;
  env?: string;
}

interface ResizeMessage {
  type: 'resize';
  cols: number;
  rows: number;
}

interface ExecMessage {
  type: 'exec' | 'resize' | 'ping';
  data?: string | ResizeMessage;
}

interface Connection {
  socket: {
    send: (data: string) => void;
    close: () => void;
    readyState: number;
    on: (event: string, handler: (data?: unknown) => void) => void;
  };
}

/**
 * WebSocket handler for interactive container terminal (exec)
 * Endpoint: /api/containers/:id/exec
 * Supports bidirectional communication (stdin/stdout/stderr)
 * Supports terminal resize
 */
export async function registerContainerExecWebSocket(fastify: FastifyInstance): Promise<void> {
  fastify.get(
    '/api/containers/:id/exec',
    { websocket: true },
    async (connection: Connection, request: FastifyRequest) => {
      const params = request.params as { id: string };
      const query = request.query as ExecQueryParams;
      const { id } = params;
      const { cmd = '/bin/sh', tty = 'true', user, privileged = 'false', env } = query;

      let execInstance: unknown = null;
      let stream: Duplex | null = null;
      let isClosed = false;
      let currentExecId: string | null = null;

      const cleanup = () => {
        if (isClosed) return;
        isClosed = true;

        if (stream) {
          stream.destroy();
          stream = null;
        }

        try {
          connection.socket.close();
        } catch {
          // Socket may already be closed
        }

        request.log.debug(
          { containerId: id, execId: currentExecId },
          'Container exec WebSocket cleaned up'
        );
      };

      try {
        const docker = getDocker();
        const container = docker.getContainer(id);

        // Verify container exists and is running
        const containerInfo = await container.inspect();

        if (!containerInfo.State.Running) {
          connection.socket.send(
            JSON.stringify({
              type: 'error',
              error: 'Container is not running. Start the container first.',
              code: 400,
              timestamp: Date.now(),
            })
          );
          cleanup();
          return;
        }

        // Parse environment variables
        const envVars: string[] = [];
        if (env) {
          try {
            const parsed = JSON.parse(env);
            if (Array.isArray(parsed)) {
              envVars.push(...parsed);
            }
          } catch {
            // If not JSON, treat as single env var
            envVars.push(env);
          }
        }

        // Parse command
        const command = cmd.split(' ').filter(Boolean);

        // Create exec instance
        execInstance = await container.exec({
          Cmd: command,
          AttachStdin: true,
          AttachStdout: true,
          AttachStderr: true,
          Tty: tty === 'true',
          User: user,
          Privileged: privileged === 'true',
          Env: envVars.length > 0 ? envVars : undefined,
        });

        currentExecId = (execInstance as { id: string }).id;

        request.log.info(
          { containerId: id, execId: currentExecId, cmd: command },
          'Starting container exec session'
        );

        // Start exec with hijacked stream
        const execResult = await (
          execInstance as {
            start: (opts: {
              hijack: boolean;
              stdin: boolean;
              stdout: boolean;
              stderr: boolean;
            }) => Promise<Duplex>;
          }
        ).start({
          hijack: true,
          stdin: true,
          stdout: true,
          stderr: true,
        });
        stream = execResult;

        // Send connection established message
        connection.socket.send(
          JSON.stringify({
            type: 'connected',
            containerId: id,
            execId: currentExecId,
            tty: tty === 'true',
            timestamp: Date.now(),
          })
        );

        // Handle stdout/stderr from container
        stream.on('data', (chunk: Buffer) => {
          if (isClosed) return;

          try {
            // For TTY mode, data is sent raw
            // For non-TTY, data has multiplexed headers
            let data: string;

            if (tty === 'true') {
              data = chunk.toString('utf-8');
            } else {
              data = parseDockerStream(chunk);
            }

            connection.socket.send(
              JSON.stringify({
                type: 'output',
                data,
                timestamp: Date.now(),
              })
            );
          } catch (err) {
            request.log.error({ err }, 'Error processing exec output');
          }
        });

        // Handle stream errors
        stream.on('error', (err: Error) => {
          request.log.error({ err, containerId: id, execId: currentExecId }, 'Exec stream error');

          if (!isClosed) {
            connection.socket.send(
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
            connection.socket.send(
              JSON.stringify({
                type: 'end',
                message: 'Exec session ended',
                timestamp: Date.now(),
              })
            );
            cleanup();
          }
        });

        // Handle messages from client
        connection.socket.on('message', async (rawData: unknown) => {
          if (isClosed) return;

          try {
            const data = String(rawData);

            // Try to parse as JSON for control messages
            let message: ExecMessage;
            try {
              message = JSON.parse(data);
            } catch {
              // Not JSON, treat as raw input
              message = { type: 'exec', data };
            }

            switch (message.type) {
              case 'resize':
                if (tty === 'true' && typeof message.data === 'object' && message.data !== null) {
                  const { cols, rows } = message.data as ResizeMessage;

                  if (currentExecId && cols > 0 && rows > 0) {
                    try {
                      // Resize the exec instance
                      const execObj = docker.getExec(currentExecId);
                      await (
                        execObj as { resize: (opts: { h: number; w: number }) => Promise<void> }
                      ).resize({
                        h: rows,
                        w: cols,
                      });

                      request.log.debug(
                        { containerId: id, execId: currentExecId, cols, rows },
                        'Terminal resized'
                      );
                    } catch (err) {
                      request.log.error({ err }, 'Failed to resize terminal');
                    }
                  }
                }
                break;

              case 'exec':
              default:
                // Send input to container
                if (stream && stream.writable) {
                  const input = typeof message.data === 'string' ? message.data : data;
                  stream.write(input);
                }
                break;
            }
          } catch (err) {
            request.log.error({ err }, 'Error handling client message');
          }
        });

        // Handle client disconnect
        connection.socket.on('close', () => {
          request.log.info(
            { containerId: id, execId: currentExecId },
            'Client disconnected from exec session'
          );
          cleanup();
        });

        // Handle client errors
        connection.socket.on('error', (err: Error) => {
          request.log.error({ err, containerId: id, execId: currentExecId }, 'WebSocket error');
          cleanup();
        });

        // Handle ping/pong to keep connection alive
        const pingInterval = setInterval(() => {
          if (isClosed || connection.socket.readyState !== 1) {
            clearInterval(pingInterval);
            return;
          }

          connection.socket.send(
            JSON.stringify({
              type: 'ping',
              timestamp: Date.now(),
            })
          );
        }, 30000);

        connection.socket.on('close', () => {
          clearInterval(pingInterval);
        });
      } catch (error) {
        const err = error as Error;
        request.log.error({ err, containerId: id }, 'Failed to start container exec');

        let errorMessage = err.message;
        let statusCode = 500;

        if (err.message.includes('No such container')) {
          errorMessage = 'Container not found';
          statusCode = 404;
        }

        connection.socket.send(
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
 * Parse Docker multiplexed stream format
 * Similar to logs, but for exec streams
 */
function parseDockerStream(buffer: Buffer): string {
  const messages: string[] = [];
  let offset = 0;

  while (offset < buffer.length) {
    // Need at least 8 bytes for header
    if (offset + 8 > buffer.length) {
      // Add remaining bytes as plain text
      messages.push(buffer.slice(offset).toString('utf-8'));
      break;
    }

    // Read payload size (big-endian, 4 bytes starting at offset 4)
    const payloadSize = buffer.readUInt32BE(offset + 4);

    // Check if we have enough data for the payload
    if (offset + 8 + payloadSize > buffer.length) {
      messages.push(buffer.slice(offset).toString('utf-8'));
      break;
    }

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
