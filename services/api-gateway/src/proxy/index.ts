import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { request as httpRequest, Agent } from 'http';
import { request as httpsRequest } from 'https';

// Create agents for connection pooling
const httpAgent = new Agent({
  keepAlive: true,
  maxSockets: 50,
});

const httpsAgent = new Agent({
  keepAlive: true,
  maxSockets: 50,
});

// Proxy request to a target service
export async function proxyRequest(
  request: FastifyRequest,
  reply: FastifyReply,
  targetUrl: string
): Promise<void> {
  const url = new URL(targetUrl);
  const isHttps = url.protocol === 'https:';

  const forwardedHeaders: Record<string, string | string[]> = {};
  const hopByHopHeaders = new Set([
    'connection',
    'keep-alive',
    'proxy-authenticate',
    'proxy-authorization',
    'te',
    'trail',
    'upgrade',
    'transfer-encoding',
  ]);

  for (const [key, value] of Object.entries(request.headers)) {
    if (value === undefined) continue;
    if (hopByHopHeaders.has(key.toLowerCase())) continue;
    forwardedHeaders[key] = value;
  }

  forwardedHeaders.host = url.host;

  const options = {
    hostname: url.hostname,
    port: url.port || (isHttps ? 443 : 80),
    path: url.pathname + url.search,
    method: request.method,
    headers: forwardedHeaders,
    agent: isHttps ? httpsAgent : httpAgent,
  };

  return new Promise((resolve, reject) => {
    const proxyReq = (isHttps ? httpsRequest : httpRequest)(options, (proxyRes) => {
      // Forward status code and headers
      reply.status(proxyRes.statusCode || 200);

      // Forward headers (excluding hop-by-hop)
      for (const [key, value] of Object.entries(proxyRes.headers)) {
        if (value !== undefined && !hopByHopHeaders.has(key.toLowerCase())) {
          reply.header(key, value);
        }
      }

      // Stream response body
      proxyRes.pipe(reply.raw);
      proxyRes.on('end', resolve);
      proxyRes.on('error', reject);
    });

    proxyReq.on('error', (err) => {
      request.log.error({ err }, 'Proxy request error');
      reply.status(502).send({
        success: false,
        error: 'Service unavailable',
      });
      resolve();
    });

    // Forward request body - use parsed body or pipe raw stream, never both
    if (request.body !== undefined && request.body !== null) {
      proxyReq.write(JSON.stringify(request.body));
      proxyReq.end();
    } else {
      request.raw.pipe(proxyReq);
    }
  });
}

// Create proxy routes for a service
export function createProxyRoutes(fastify: FastifyInstance, prefix: string, targetBaseUrl: string) {
  // Catch-all route for proxying
  fastify.all(`${prefix}/*`, async (request, reply) => {
    const path = (request.params as { '*': string })['*'];
    const queryString = request.url.split('?')[1] || '';
    const targetUrl = `${targetBaseUrl}/${path}${queryString ? '?' + queryString : ''}`;

    await proxyRequest(request, reply, targetUrl);
  });
}

// WebSocket proxy handler
export function createWebSocketProxy(
  fastify: FastifyInstance,
  prefix: string,
  targetBaseUrl: string
) {
  fastify.register(async function (fastify) {
    fastify.get(`${prefix}/ws/*`, { websocket: true }, (socket, request) => {
      const path = (request.params as { '*': string })['*'];
      const targetUrl = `${targetBaseUrl}/ws/${path}`;

      // Create WebSocket connection to target
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const WebSocket = require('ws');
      const targetWs = new WebSocket(targetUrl);

      targetWs.on('open', () => {
        // Forward messages from client to target
        (socket as { on: (e: string, h: (d: unknown) => void) => void }).on(
          'message',
          (data: unknown) => {
            targetWs.send(data as string);
          }
        );

        // Forward messages from target to client
        targetWs.on('message', (data: unknown) => {
          (socket as { send: (d: unknown) => void }).send(data);
        });
      });

      targetWs.on('error', (err: Error) => {
        request.log.error({ err }, 'WebSocket proxy error');
        (socket as { close: () => void }).close();
      });

      (socket as { on: (e: string, h: () => void) => void }).on('close', () => {
        targetWs.close();
      });
    });
  });
}
