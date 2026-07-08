import { FastifyInstance } from 'fastify';
import { timingSafeEqual } from 'crypto';
import { z } from 'zod';
import {
  getNotificationRules,
  saveNotificationRule,
  updateNotificationRule,
  deleteNotificationRule,
  getNotificationRulesMatrix,
  getRecentNotificationHistory,
} from '../services/database.js';
import { requireAdmin } from '../middleware/auth.js';
import { logAuditEntry } from '../middleware/audit.js';
import { NOTIFICATION_EVENTS } from '@dockpilot/types';
import { emitNotificationEvent } from '../services/eventDispatcher.js';

// Schemas de validación
const ruleSchema = z.object({
  eventType: z.enum(Object.keys(NOTIFICATION_EVENTS) as [string, ...string[]]),
  channelId: z.string().uuid(),
  enabled: z.boolean().default(true),
  minSeverity: z.enum(['info', 'warning', 'critical']).default('info'),
  cooldownMinutes: z.number().min(0).max(1440).default(0),
});

function validateInternalSecret(
  provided: string | undefined,
  expected: string
): boolean {
  if (!provided || !expected) {
    return false;
  }

  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);

  if (providedBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(providedBuffer, expectedBuffer);
}

export async function notificationRulesRoutes(fastify: FastifyInstance) {
  // GET /api/notifications/rules - Obtener todas las reglas
  fastify.get(
    '/notifications/rules',
    {
      preHandler: requireAdmin,
    },
    async (request, reply) => {
    try {
      const rules = getNotificationRules();
      return {
        success: true,
        data: { rules },
      };
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        success: false,
        error: { message: 'Failed to fetch notification rules' },
      });
    }
  }
  );

  // GET /api/notifications/rules/matrix - Matriz evento×canal
  fastify.get(
    '/notifications/rules/matrix',
    {
      preHandler: requireAdmin,
    },
    async (request, reply) => {
    try {
      const matrix = getNotificationRulesMatrix();
      return {
        success: true,
        data: {
          matrix,
          events: NOTIFICATION_EVENTS,
        },
      };
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        success: false,
        error: { message: 'Failed to fetch notification matrix' },
      });
    }
  }
  );

  // POST /api/notifications/rules - Crear nueva regla
  fastify.post(
    '/notifications/rules',
    {
      preHandler: requireAdmin,
    },
    async (request, reply) => {
      try {
        const body = request.body as z.infer<typeof ruleSchema>;
        const rule = saveNotificationRule(body);

        await logAuditEntry({
          userId: (request.user as { id: string }).id,
          username: (request.user as { username: string }).username,
          action: 'notification.rule.create',
          resource: 'notification',
          details: { ruleId: rule.id, eventType: rule.eventType },
          ip: request.ip,
          userAgent: request.headers['user-agent'] || 'unknown',
          success: true,
        });

        return reply.status(201).send({
          success: true,
          data: { rule },
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.status(500).send({
          success: false,
          error: { message: 'Failed to create notification rule' },
        });
      }
    }
  );

  // PUT /api/notifications/rules/:id - Actualizar regla
  fastify.put(
    '/notifications/rules/:id',
    {
      preHandler: requireAdmin,
    },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const body = request.body as Partial<z.infer<typeof ruleSchema>>;
        const rule = updateNotificationRule(id, body);

        await logAuditEntry({
          userId: (request.user as { id: string }).id,
          username: (request.user as { username: string }).username,
          action: 'notification.rule.update',
          resource: 'notification',
          details: { ruleId: id },
          ip: request.ip,
          userAgent: request.headers['user-agent'] || 'unknown',
          success: true,
        });

        return {
          success: true,
          data: { rule },
        };
      } catch (error) {
        fastify.log.error(error);
        return reply.status(500).send({
          success: false,
          error: { message: 'Failed to update notification rule' },
        });
      }
    }
  );

  // DELETE /api/notifications/rules/:id - Eliminar regla
  fastify.delete(
    '/notifications/rules/:id',
    {
      preHandler: requireAdmin,
    },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        deleteNotificationRule(id);

        await logAuditEntry({
          userId: (request.user as { id: string }).id,
          username: (request.user as { username: string }).username,
          action: 'notification.rule.delete',
          resource: 'notification',
          details: { ruleId: id },
          ip: request.ip,
          userAgent: request.headers['user-agent'] || 'unknown',
          success: true,
        });

        return {
          success: true,
          message: 'Notification rule deleted',
        };
      } catch (error) {
        fastify.log.error(error);
        return reply.status(500).send({
          success: false,
          error: { message: 'Failed to delete notification rule' },
        });
      }
    }
  );

  // GET /api/notifications/history - Historial de notificaciones
  fastify.get(
    '/notifications/history',
    {
      preHandler: requireAdmin,
    },
    async (request, reply) => {
    try {
      const query = request.query as { limit?: string };
      const limit = parseInt(query.limit || '50', 10);
      const history = getRecentNotificationHistory(limit);

      return {
        success: true,
        data: { history },
      };
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        success: false,
        error: { message: 'Failed to fetch notification history' },
      });
    }
  }
  );

  // POST /api/notifications/events - Internal endpoint for receiving events from docker-control
  fastify.post(
    '/notifications/events',
    async (request, reply) => {
      try {
        const internalSecret = fastify.config.internalApiSecret;
        const providedSecret = request.headers['x-internal-secret'];

        if (
          !validateInternalSecret(
            typeof providedSecret === 'string' ? providedSecret : undefined,
            internalSecret
          )
        ) {
          return reply.status(401).send({
            success: false,
            error: { message: 'Invalid or missing internal API secret' },
          });
        }

        const body = request.body as {
          eventType: string;
          severity: 'info' | 'warning' | 'critical';
          message: string;
          metadata?: Record<string, unknown>;
          timestamp?: string;
        };

        if (!body.eventType || !body.severity || !body.message) {
          return reply.status(400).send({
            success: false,
            error: { message: 'Missing required fields: eventType, severity, message' },
          });
        }

        // Forward the event to notification channels
        await emitNotificationEvent(
          body.eventType,
          body.severity,
          body.message,
          body.metadata || {}
        );

        return {
          success: true,
          message: 'Event processed successfully',
        };
      } catch (error) {
        fastify.log.error(error);
        return reply.status(500).send({
          success: false,
          error: { message: 'Failed to process event' },
        });
      }
    }
  );
}
