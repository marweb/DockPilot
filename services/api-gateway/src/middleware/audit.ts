import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import '../types/fastify.js';
import { addAuditLog, getAuditLogs as getAuditLogsFromDb } from '../services/database.js';

// Audit log entry interface
export interface AuditLogEntry {
  id: string;
  timestamp: string;
  userId: string;
  username: string;
  action: string;
  resource: string;
  resourceId?: string;
  details?: Record<string, unknown>;
  ip: string;
  userAgent: string;
  success: boolean;
  errorMessage?: string;
}

// Configuration
interface AuditConfig {
  enabled: boolean;
  logSuccessfulRequests: boolean;
  logFailedRequests: boolean;
  excludedPaths: string[];
  retentionDays: number;
}

// Default configuration
const defaultConfig: AuditConfig = {
  enabled: true,
  logSuccessfulRequests: true,
  logFailedRequests: true,
  excludedPaths: ['/healthz', '/api/health', '/api/auth/setup-status'],
  retentionDays: 90,
};

let config: AuditConfig = { ...defaultConfig };

/**
 * Configure audit middleware
 */
export function configureAudit(newConfig: Partial<AuditConfig>): void {
  config = { ...config, ...newConfig };
}

/**
 * Get current audit configuration
 */
export function getAuditConfig(): AuditConfig {
  return { ...config };
}

/**
 * Check if path should be excluded from audit
 */
function isExcludedPath(path: string): boolean {
  return config.excludedPaths.some((excluded) => path === excluded || path.startsWith(excluded));
}

/**
 * Extract resource and action from request
 */
function extractResourceAndAction(
  method: string,
  path: string
): { resource: string; action: string } {
  const parts = path.split('/').filter(Boolean);
  const resource = parts[1] || 'unknown';

  let action: string;
  switch (method.toUpperCase()) {
    case 'GET':
      action = parts.length > 2 ? 'get' : 'list';
      break;
    case 'POST':
      action = 'create';
      break;
    case 'PUT':
    case 'PATCH':
      action = 'update';
      break;
    case 'DELETE':
      action = 'delete';
      break;
    default:
      action = method.toLowerCase();
  }

  return { resource, action };
}

/**
 * Audit middleware - logs all requests
 */
export async function auditMiddleware(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  if (!config.enabled || isExcludedPath(request.url)) {
    return;
  }

  const startTime = Date.now();

  // Store original send for interception
  const originalSend = reply.send.bind(reply);

  // Override send to capture response
  reply.send = function (payload: unknown): typeof reply {
    const duration = Date.now() - startTime;
    const success = reply.statusCode < 400;

    // Only log if configured to do so
    if ((success && config.logSuccessfulRequests) || (!success && config.logFailedRequests)) {
      const { resource, action } = extractResourceAndAction(request.method, request.url);

      const errorMessage =
        !success && payload && typeof payload === 'object'
          ? ((payload as Record<string, unknown>).message as string) ||
            ((payload as Record<string, unknown>).error as string)
          : undefined;

      void logAuditEntry({
        userId: request.user?.id || 'anonymous',
        username: request.user?.username || 'anonymous',
        action: `${resource}.${action}`,
        resource,
        resourceId: (request.params as Record<string, string> | undefined)?.id,
        details: {
          method: request.method,
          path: request.url,
          statusCode: reply.statusCode,
          duration,
          query: request.query,
        },
        ip: request.ip,
        userAgent: request.headers['user-agent'] || 'unknown',
        success,
        errorMessage,
      });
    }

    return originalSend(payload);
  };
}

/**
 * Log an audit entry
 */
export async function logAuditEntry(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>): Promise<void> {
  if (!config.enabled) {
    return;
  }

  try {
    await addAuditLog({
      userId: entry.userId,
      username: entry.username,
      action: entry.action,
      resource: entry.resource,
      resourceId: entry.resourceId,
      details: entry.details,
      ip: entry.ip,
      userAgent: entry.userAgent,
    });
  } catch (error) {
    console.error('Failed to write audit log:', error);
  }
}

/**
 * Get audit logs with pagination and filtering
 */
export async function getAuditLogs(
  options: {
    limit?: number;
    offset?: number;
    userId?: string;
    resource?: string;
    action?: string;
    startDate?: string;
    endDate?: string;
  } = {}
): Promise<{ logs: AuditLogEntry[]; total: number }> {
  const { limit = 100, offset = 0 } = options;

  const logs = await getAuditLogsFromDb(limit + offset);

  let filteredLogs = logs;

  if (options.userId) {
    filteredLogs = filteredLogs.filter((log) => log.userId === options.userId);
  }

  if (options.resource) {
    filteredLogs = filteredLogs.filter((log) => log.resource === options.resource);
  }

  if (options.action) {
    filteredLogs = filteredLogs.filter((log) => log.action.includes(options.action as string));
  }

  if (options.startDate) {
    const start = new Date(options.startDate).getTime();
    filteredLogs = filteredLogs.filter((log) => new Date(log.timestamp).getTime() >= start);
  }

  if (options.endDate) {
    const end = new Date(options.endDate).getTime();
    filteredLogs = filteredLogs.filter((log) => new Date(log.timestamp).getTime() <= end);
  }

  const total = filteredLogs.length;
  const paginatedLogs = filteredLogs.slice(offset, offset + limit);

  return {
    logs: paginatedLogs.map((log) => ({
      ...log,
      success: true, // Default for backwards compatibility
    })),
    total,
  };
}

// Query schema for audit logs
const auditLogsQuerySchema = z.object({
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 100)),
  offset: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 0)),
  userId: z.string().optional(),
  resource: z.string().optional(),
  action: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

/**
 * Register audit routes
 */
export async function auditRoutes(fastify: FastifyInstance): Promise<void> {
  // Get audit logs (admin only)
  fastify.get<{
    Querystring: z.infer<typeof auditLogsQuerySchema>;
  }>('/audit/logs', async (request, reply) => {
    if (!request.user || request.user.role !== 'admin') {
      return reply.status(403).send({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Admin access required',
        },
      });
    }

    const query = auditLogsQuerySchema.parse(request.query);
    const result = await getAuditLogs(query);

    return reply.send({
      success: true,
      data: result.logs,
      pagination: {
        total: result.total,
        limit: query.limit || 100,
        offset: query.offset || 0,
      },
    });
  });

  // Get audit configuration (admin only)
  fastify.get('/audit/config', async (request, reply) => {
    if (!request.user || request.user.role !== 'admin') {
      return reply.status(403).send({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Admin access required',
        },
      });
    }

    return reply.send({
      success: true,
      data: getAuditConfig(),
    });
  });

  // Update audit configuration (admin only)
  fastify.patch<{
    Body: Partial<AuditConfig>;
  }>('/audit/config', async (request, reply) => {
    if (!request.user || request.user.role !== 'admin') {
      return reply.status(403).send({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Admin access required',
        },
      });
    }

    configureAudit(request.body);

    return reply.send({
      success: true,
      data: getAuditConfig(),
    });
  });
}
