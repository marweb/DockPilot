import type { FastifyInstance } from 'fastify';
import {
  UpdateIngressSchema,
  IngressRuleSchema,
  TunnelIdParamSchema,
  type UpdateIngressInput,
  type IngressRuleInput,
} from '../schemas/index.js';
import { getIngressRules, updateIngressRules, deleteIngressRule } from '../services/cloudflared.js';
import { getLogger } from '../utils/logger.js';

const logger = getLogger();

export async function ingressRoutes(fastify: FastifyInstance) {
  // Get ingress rules for a tunnel
  fastify.get<{
    Params: { id: string };
  }>(
    '/tunnels/:id/ingress',
    {
      schema: {
        params: TunnelIdParamSchema,
      },
    },
    async (request, reply) => {
      try {
        const { id } = request.params;
        const ingress = await getIngressRules(id);

        return reply.send({
          success: true,
          data: {
            tunnelId: id,
            ingress,
            count: ingress.length,
          },
        });
      } catch (error) {
        logger.error({ error, tunnelId: request.params.id }, 'Failed to get ingress rules');

        if ((error as Error).message === 'Tunnel not found') {
          return reply.status(404).send({
            success: false,
            error: { code: 'NOT_FOUND', message: 'Tunnel not found' },
          });
        }

        return reply.status(500).send({
          success: false,
          error: { code: 'INTERNAL_ERROR', message: (error as Error).message },
        });
      }
    }
  );

  // Update ingress rules for a tunnel
  fastify.post<{
    Params: { id: string };
    Body: UpdateIngressInput;
  }>(
    '/tunnels/:id/ingress',
    {
      schema: {
        params: TunnelIdParamSchema,
        body: UpdateIngressSchema,
      },
    },
    async (request, reply) => {
      try {
        const { id } = request.params;
        const { ingress } = request.body;

        // Validate each ingress rule
        for (const rule of ingress) {
          const result = IngressRuleSchema.safeParse(rule);
          if (!result.success) {
            return reply.status(400).send({
              success: false,
              error: {
                code: 'VALIDATION_ERROR',
                message: `Invalid ingress rule: ${result.error.errors.map((e) => e.message).join(', ')}`,
              },
            });
          }
        }

        await updateIngressRules(id, ingress);

        logger.info({ tunnelId: id, ruleCount: ingress.length }, 'Ingress rules updated');

        return reply.send({
          success: true,
          message: 'Ingress rules updated successfully',
          data: {
            tunnelId: id,
            ingress,
            count: ingress.length,
          },
        });
      } catch (error) {
        logger.error({ error, tunnelId: request.params.id }, 'Failed to update ingress rules');

        if ((error as Error).message === 'Tunnel not found') {
          return reply.status(404).send({
            success: false,
            error: { code: 'NOT_FOUND', message: 'Tunnel not found' },
          });
        }

        return reply.status(500).send({
          success: false,
          error: { code: 'INTERNAL_ERROR', message: (error as Error).message },
        });
      }
    }
  );

  // Add a single ingress rule
  fastify.put<{
    Params: { id: string };
    Body: IngressRuleInput;
  }>(
    '/tunnels/:id/ingress',
    {
      schema: {
        params: TunnelIdParamSchema,
        body: IngressRuleSchema,
      },
    },
    async (request, reply) => {
      try {
        const { id } = request.params;
        const newRule = request.body;

        // Get existing rules
        const existingRules = await getIngressRules(id);

        // Check for duplicate hostname
        if (existingRules.some((rule) => rule.hostname === newRule.hostname)) {
          return reply.status(409).send({
            success: false,
            error: {
              code: 'CONFLICT',
              message: `Ingress rule for hostname "${newRule.hostname}" already exists`,
            },
          });
        }

        // Add new rule
        const updatedRules = [...existingRules, newRule];
        await updateIngressRules(id, updatedRules);

        logger.info({ tunnelId: id, hostname: newRule.hostname }, 'Ingress rule added');

        return reply.status(201).send({
          success: true,
          message: 'Ingress rule added successfully',
          data: {
            tunnelId: id,
            rule: newRule,
          },
        });
      } catch (error) {
        logger.error({ error, tunnelId: request.params.id }, 'Failed to add ingress rule');

        if ((error as Error).message === 'Tunnel not found') {
          return reply.status(404).send({
            success: false,
            error: { code: 'NOT_FOUND', message: 'Tunnel not found' },
          });
        }

        return reply.status(500).send({
          success: false,
          error: { code: 'INTERNAL_ERROR', message: (error as Error).message },
        });
      }
    }
  );

  // Delete a specific ingress rule by hostname
  fastify.delete<{
    Params: { id: string; hostname: string };
  }>(
    '/tunnels/:id/ingress/:hostname',
    {
      schema: {
        params: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            hostname: { type: 'string', minLength: 1 },
          },
          required: ['id', 'hostname'],
        },
      },
    },
    async (request, reply) => {
      try {
        const { id, hostname } = request.params;

        await deleteIngressRule(id, hostname);

        logger.info({ tunnelId: id, hostname }, 'Ingress rule deleted');

        return reply.send({
          success: true,
          message: `Ingress rule for hostname "${hostname}" deleted successfully`,
        });
      } catch (error) {
        logger.error(
          { error, tunnelId: request.params.id, hostname: request.params.hostname },
          'Failed to delete ingress rule'
        );

        if ((error as Error).message === 'Tunnel not found') {
          return reply.status(404).send({
            success: false,
            error: { code: 'NOT_FOUND', message: 'Tunnel not found' },
          });
        }

        if ((error as Error).message.includes('not found')) {
          return reply.status(404).send({
            success: false,
            error: { code: 'NOT_FOUND', message: (error as Error).message },
          });
        }

        return reply.status(500).send({
          success: false,
          error: { code: 'INTERNAL_ERROR', message: (error as Error).message },
        });
      }
    }
  );

  // Update a specific ingress rule
  fastify.patch<{
    Params: { id: string; hostname: string };
    Body: Partial<IngressRuleInput>;
  }>(
    '/tunnels/:id/ingress/:hostname',
    {
      schema: {
        params: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            hostname: { type: 'string', minLength: 1 },
          },
          required: ['id', 'hostname'],
        },
        body: {
          type: 'object',
          properties: {
            service: { type: 'string' },
            originRequest: { type: 'object' },
            path: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const { id, hostname } = request.params;
        const updates = request.body;

        // Get existing rules
        const existingRules = await getIngressRules(id);

        // Find and update the rule
        const ruleIndex = existingRules.findIndex((rule) => rule.hostname === hostname);
        if (ruleIndex === -1) {
          return reply.status(404).send({
            success: false,
            error: {
              code: 'NOT_FOUND',
              message: `Ingress rule for hostname "${hostname}" not found`,
            },
          });
        }

        // Update the rule
        existingRules[ruleIndex] = {
          ...existingRules[ruleIndex],
          ...updates,
          hostname, // Keep the original hostname
        };

        await updateIngressRules(id, existingRules);

        logger.info({ tunnelId: id, hostname }, 'Ingress rule updated');

        return reply.send({
          success: true,
          message: 'Ingress rule updated successfully',
          data: {
            tunnelId: id,
            rule: existingRules[ruleIndex],
          },
        });
      } catch (error) {
        logger.error(
          { error, tunnelId: request.params.id, hostname: request.params.hostname },
          'Failed to update ingress rule'
        );

        if ((error as Error).message === 'Tunnel not found') {
          return reply.status(404).send({
            success: false,
            error: { code: 'NOT_FOUND', message: 'Tunnel not found' },
          });
        }

        return reply.status(500).send({
          success: false,
          error: { code: 'INTERNAL_ERROR', message: (error as Error).message },
        });
      }
    }
  );
}
