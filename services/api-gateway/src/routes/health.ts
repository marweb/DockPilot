import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import '../types/fastify.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import { readFile } from 'fs/promises';
import { resolve } from 'path';

const execAsync = promisify(exec);

// Health check response interface
interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  uptime: number;
  environment: string;
  checks: {
    database: ServiceCheck;
    docker?: ServiceCheck;
    tunnel?: ServiceCheck;
    memory: ResourceCheck;
    disk?: ResourceCheck;
  };
}

interface ServiceCheck {
  status: 'healthy' | 'unhealthy';
  responseTime?: number;
  message?: string;
  lastCheck?: string;
}

interface ResourceCheck {
  status: 'healthy' | 'warning' | 'unhealthy';
  usage: number;
  limit: number;
  percentage: number;
  message?: string;
}

// Version info from package.json
interface VersionInfo {
  version: string;
  name: string;
  description?: string;
}

let cachedVersion: VersionInfo | null = null;

/**
 * Get version information from package.json
 */
async function getVersionInfo(): Promise<VersionInfo> {
  if (cachedVersion) {
    return cachedVersion;
  }

  try {
    const packageJsonPath = resolve(process.cwd(), 'package.json');
    const packageJson = await readFile(packageJsonPath, 'utf-8');
    const parsed = JSON.parse(packageJson);
    cachedVersion = {
      version: parsed.version || '1.0.0',
      name: parsed.name || 'api-gateway',
      description: parsed.description,
    };
    return cachedVersion;
  } catch {
    return {
      version: '1.0.0',
      name: 'api-gateway',
    };
  }
}

/**
 * Check database connectivity
 */
async function checkDatabase(): Promise<ServiceCheck> {
  const start = Date.now();
  try {
    // Simple check by importing database module
    const { getDatabase } = await import('../services/database.js');
    await getDatabase();

    return {
      status: 'healthy',
      responseTime: Date.now() - start,
      lastCheck: new Date().toISOString(),
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      responseTime: Date.now() - start,
      message: error instanceof Error ? error.message : 'Database check failed',
      lastCheck: new Date().toISOString(),
    };
  }
}

/**
 * Check Docker Control service
 */
async function checkDockerService(config: { dockerControlUrl: string }): Promise<ServiceCheck> {
  const start = Date.now();
  try {
    const response = await fetch(`${config.dockerControlUrl}/api/ping`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });

    if (response.ok) {
      return {
        status: 'healthy',
        responseTime: Date.now() - start,
        lastCheck: new Date().toISOString(),
      };
    }

    return {
      status: 'unhealthy',
      responseTime: Date.now() - start,
      message: `HTTP ${response.status}`,
      lastCheck: new Date().toISOString(),
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      responseTime: Date.now() - start,
      message: error instanceof Error ? error.message : 'Docker service unreachable',
      lastCheck: new Date().toISOString(),
    };
  }
}

/**
 * Check Tunnel Control service
 */
async function checkTunnelService(config: { tunnelControlUrl: string }): Promise<ServiceCheck> {
  const start = Date.now();
  try {
    const response = await fetch(`${config.tunnelControlUrl}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });

    if (response.ok) {
      return {
        status: 'healthy',
        responseTime: Date.now() - start,
        lastCheck: new Date().toISOString(),
      };
    }

    return {
      status: 'unhealthy',
      responseTime: Date.now() - start,
      message: `HTTP ${response.status}`,
      lastCheck: new Date().toISOString(),
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      responseTime: Date.now() - start,
      message: error instanceof Error ? error.message : 'Tunnel service unreachable',
      lastCheck: new Date().toISOString(),
    };
  }
}

/**
 * Check memory usage
 */
async function checkMemory(): Promise<ResourceCheck> {
  const usage = process.memoryUsage();
  const usedMB = Math.round(usage.heapUsed / 1024 / 1024);
  const totalMB = Math.round(usage.heapTotal / 1024 / 1024);
  const percentage = Math.round((usage.heapUsed / usage.heapTotal) * 100);

  let status: ResourceCheck['status'] = 'healthy';
  let message: string | undefined;

  if (percentage > 90) {
    status = 'unhealthy';
    message = `Critical memory usage: ${percentage}%`;
  } else if (percentage > 75) {
    status = 'warning';
    message = `High memory usage: ${percentage}%`;
  }

  return {
    status,
    usage: usedMB,
    limit: totalMB,
    percentage,
    message,
  };
}

/**
 * Check disk usage
 */
async function checkDisk(): Promise<ResourceCheck> {
  try {
    const { stdout } = await execAsync('df -h / | tail -1');
    const parts = stdout.trim().split(/\s+/);
    const percentage = parseInt(parts[4].replace('%', ''), 10);
    const used = parts[2];
    const available = parts[3];

    let status: ResourceCheck['status'] = 'healthy';
    let message: string | undefined;

    if (percentage > 90) {
      status = 'unhealthy';
      message = `Critical disk usage: ${percentage}%`;
    } else if (percentage > 80) {
      status = 'warning';
      message = `High disk usage: ${percentage}%`;
    }

    return {
      status,
      usage: parseInt(used) || 0,
      limit: (parseInt(used) || 0) + (parseInt(available) || 0),
      percentage,
      message,
    };
  } catch {
    return {
      status: 'unhealthy',
      usage: 0,
      limit: 0,
      percentage: 0,
      message: 'Failed to check disk usage',
    };
  }
}

/**
 * Calculate overall health status
 */
function calculateHealthStatus(checks: HealthStatus['checks']): HealthStatus['status'] {
  const services = [checks.database, checks.docker, checks.tunnel].filter(Boolean);
  const unhealthyCount = services.filter((s) => s?.status === 'unhealthy').length;

  if (unhealthyCount === 0 && checks.memory.status !== 'unhealthy') {
    return 'healthy';
  }

  if (unhealthyCount >= services.length / 2 || checks.memory.status === 'unhealthy') {
    return 'unhealthy';
  }

  return 'degraded';
}

// Query schema
const healthQuerySchema = z.object({
  detailed: z
    .string()
    .optional()
    .transform((val) => val === 'true'),
});

/**
 * Health routes
 */
export async function healthRoutes(fastify: FastifyInstance): Promise<void> {
  // GET /api/health - Comprehensive health check
  fastify.get<{
    Querystring: z.infer<typeof healthQuerySchema>;
  }>('/', async (request, reply) => {
    const query = healthQuerySchema.parse(request.query);
    const config = fastify.config;

    const startTime = Date.now();

    // Run checks in parallel
    const [dbCheck, dockerCheck, tunnelCheck, memoryCheck, diskCheck, version] = await Promise.all([
      checkDatabase(),
      config?.dockerControlUrl
        ? checkDockerService({ dockerControlUrl: config.dockerControlUrl })
        : Promise.resolve(undefined),
      config?.tunnelControlUrl
        ? checkTunnelService({ tunnelControlUrl: config.tunnelControlUrl })
        : Promise.resolve(undefined),
      checkMemory(),
      checkDisk(),
      getVersionInfo(),
    ]);

    const checks: HealthStatus['checks'] = {
      database: dbCheck,
      docker: dockerCheck,
      tunnel: tunnelCheck,
      memory: memoryCheck,
      disk: diskCheck,
    };

    const healthStatus: HealthStatus = {
      status: calculateHealthStatus(checks),
      timestamp: new Date().toISOString(),
      version: version.version,
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      checks,
    };

    const responseTime = Date.now() - startTime;

    // Determine status code based on health
    const statusCode =
      healthStatus.status === 'healthy' ? 200 : healthStatus.status === 'degraded' ? 200 : 503;

    // Set cache headers to prevent caching
    void reply.header('Cache-Control', 'no-cache, no-store, must-revalidate');
    void reply.header('Pragma', 'no-cache');
    void reply.header('Expires', '0');
    void reply.header('X-Response-Time', `${responseTime}ms`);

    // For non-detailed requests, return simplified response
    if (!query.detailed) {
      return reply.status(statusCode).send({
        status: healthStatus.status,
        timestamp: healthStatus.timestamp,
        version: healthStatus.version,
        uptime: healthStatus.uptime,
      });
    }

    return reply.status(statusCode).send({
      success: healthStatus.status !== 'unhealthy',
      data: healthStatus,
    });
  });

  // GET /api/health/simple - Simple health check for load balancers
  fastify.get('/simple', async (_request, reply) => {
    const dbCheck = await checkDatabase();

    const isHealthy = dbCheck.status === 'healthy';

    return reply
      .status(isHealthy ? 200 : 503)
      .header('Cache-Control', 'no-cache, no-store, must-revalidate')
      .send({
        status: isHealthy ? 'healthy' : 'unhealthy',
        timestamp: new Date().toISOString(),
      });
  });

  // GET /api/health/ready - Readiness probe for Kubernetes
  fastify.get('/ready', async (request, reply) => {
    const config = request.server.config;

    const [dbCheck, dockerCheck] = await Promise.all([
      checkDatabase(),
      config?.dockerControlUrl
        ? checkDockerService({ dockerControlUrl: config.dockerControlUrl })
        : Promise.resolve(undefined),
    ]);

    const isReady = dbCheck.status === 'healthy';

    return reply
      .status(isReady ? 200 : 503)
      .header('Cache-Control', 'no-cache, no-store, must-revalidate')
      .send({
        ready: isReady,
        checks: {
          database: dbCheck.status,
          docker: dockerCheck?.status || 'unknown',
        },
      });
  });

  // GET /api/health/live - Liveness probe for Kubernetes
  fastify.get('/live', async (_request, reply) => {
    return reply.status(200).header('Cache-Control', 'no-cache, no-store, must-revalidate').send({
      alive: true,
      timestamp: new Date().toISOString(),
    });
  });

  // GET /api/health/dependencies - Check all service dependencies
  fastify.get('/dependencies', async (request, reply) => {
    const config = request.server.config;

    const [dbCheck, dockerCheck, tunnelCheck] = await Promise.all([
      checkDatabase(),
      config?.dockerControlUrl
        ? checkDockerService({ dockerControlUrl: config.dockerControlUrl })
        : Promise.resolve(undefined),
      config?.tunnelControlUrl
        ? checkTunnelService({ tunnelControlUrl: config.tunnelControlUrl })
        : Promise.resolve(undefined),
    ]);

    const allHealthy = [dbCheck, dockerCheck, tunnelCheck]
      .filter(Boolean)
      .every((check) => check?.status === 'healthy');

    return reply.send({
      success: allHealthy,
      data: {
        database: dbCheck,
        docker: dockerCheck,
        tunnel: tunnelCheck,
      },
    });
  });
}
