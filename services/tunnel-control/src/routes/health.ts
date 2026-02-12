import type { FastifyInstance } from 'fastify';
import {
  checkCloudflaredInstalled,
  getCloudflaredVersion,
  listActiveTunnels,
} from '../services/cloudflared.js';
import { isAuthenticated, getCurrentAccountId } from '../services/cloudflare-api.js';
import { getLogger } from '../utils/logger.js';

const logger = getLogger();

interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  version: string;
  uptime: number;
  checks: {
    cloudflared: {
      status: 'ok' | 'error' | 'not_installed';
      version?: string;
      message?: string;
    };
    authentication: {
      status: 'ok' | 'not_authenticated';
      accountId?: string | null;
    };
    tunnels: {
      active: number;
      total: number;
    };
  };
}

let startTime = Date.now();

export async function healthRoutes(fastify: FastifyInstance) {
  // Health check endpoint
  fastify.get('/health', async (_request, reply) => {
    try {
      const checks = await performHealthChecks();
      const overallStatus = determineOverallStatus(checks);

      const health: HealthStatus = {
        status: overallStatus,
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0',
        uptime: Math.floor((Date.now() - startTime) / 1000),
        checks,
      };

      const statusCode =
        overallStatus === 'healthy' ? 200 : overallStatus === 'degraded' ? 200 : 503;

      return reply.status(statusCode).send({
        success: overallStatus !== 'unhealthy',
        data: health,
      });
    } catch (error) {
      logger.error({ error }, 'Health check failed');

      return reply.status(503).send({
        success: false,
        error: {
          code: 'HEALTH_CHECK_FAILED',
          message: (error as Error).message,
        },
      });
    }
  });

  // Liveness probe - basic check that service is running
  fastify.get('/healthz', async (_request, reply) => {
    return reply.send({
      status: 'alive',
      timestamp: new Date().toISOString(),
    });
  });

  // Readiness probe - check if service is ready to accept traffic
  fastify.get('/ready', async (_request, reply) => {
    try {
      const cloudflaredInstalled = await checkCloudflaredInstalled();

      if (!cloudflaredInstalled) {
        return reply.status(503).send({
          ready: false,
          reason: 'cloudflared not installed',
        });
      }

      return reply.send({
        ready: true,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      return reply.status(503).send({
        ready: false,
        reason: (error as Error).message,
      });
    }
  });

  // Detailed status endpoint
  fastify.get('/status', async (_request, reply) => {
    try {
      const cloudflaredInstalled = await checkCloudflaredInstalled();
      let cloudflaredVersion = 'unknown';

      if (cloudflaredInstalled) {
        try {
          cloudflaredVersion = await getCloudflaredVersion();
        } catch (error) {
          logger.warn({ error }, 'Failed to get cloudflared version');
        }
      }

      const activeTunnels = await listActiveTunnels();

      return reply.send({
        success: true,
        data: {
          service: 'tunnel-control',
          version: process.env.npm_package_version || '1.0.0',
          environment: process.env.NODE_ENV || 'development',
          cloudflared: {
            installed: cloudflaredInstalled,
            version: cloudflaredVersion,
            path: process.env.CLOUDFLARED_PATH || '/usr/local/bin/cloudflared',
          },
          authentication: {
            authenticated: isAuthenticated(),
            accountId: getCurrentAccountId(),
          },
          tunnels: {
            active: activeTunnels.length,
            activeIds: activeTunnels,
          },
          resources: {
            uptime: Math.floor((Date.now() - startTime) / 1000),
            memory: process.memoryUsage(),
            cpu: process.cpuUsage(),
          },
        },
      });
    } catch (error) {
      logger.error({ error }, 'Failed to get status');

      return reply.status(500).send({
        success: false,
        error: {
          code: 'STATUS_ERROR',
          message: (error as Error).message,
        },
      });
    }
  });
}

async function performHealthChecks(): Promise<HealthStatus['checks']> {
  // Check cloudflared
  let cloudflaredStatus: HealthStatus['checks']['cloudflared'];
  try {
    const installed = await checkCloudflaredInstalled();
    if (installed) {
      const version = await getCloudflaredVersion();
      cloudflaredStatus = { status: 'ok', version };
    } else {
      cloudflaredStatus = {
        status: 'not_installed',
        message: 'cloudflared binary not found',
      };
    }
  } catch (error) {
    cloudflaredStatus = {
      status: 'error',
      message: (error as Error).message,
    };
  }

  // Check authentication
  const authStatus: HealthStatus['checks']['authentication'] = {
    status: isAuthenticated() ? 'ok' : 'not_authenticated',
    accountId: getCurrentAccountId(),
  };

  // Check tunnels
  const activeTunnels = await listActiveTunnels();
  const tunnelsStatus: HealthStatus['checks']['tunnels'] = {
    active: activeTunnels.length,
    total: activeTunnels.length, // We could add total stored tunnels here
  };

  return {
    cloudflared: cloudflaredStatus,
    authentication: authStatus,
    tunnels: tunnelsStatus,
  };
}

function determineOverallStatus(checks: HealthStatus['checks']): HealthStatus['status'] {
  // If cloudflared is not installed, we're degraded
  if (checks.cloudflared.status === 'not_installed') {
    return 'degraded';
  }

  // If cloudflared has an error, we're unhealthy
  if (checks.cloudflared.status === 'error') {
    return 'unhealthy';
  }

  // If not authenticated, we're degraded (can still work if OAuth is used)
  if (checks.authentication.status === 'not_authenticated') {
    return 'degraded';
  }

  return 'healthy';
}
