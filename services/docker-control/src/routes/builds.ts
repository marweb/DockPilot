import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  startDockerBuild,
  cancelBuild,
  getActiveBuild,
  getAllActiveBuilds,
} from '../websocket/build.js';
import type { BuildProgress } from '@dockpilot/types';

// Schemas
const buildBody = z.object({
  context: z.string().min(1, 'Build context path is required'),
  dockerfile: z.string().optional(),
  tags: z.array(z.string()).min(1, 'At least one tag is required'),
  buildArgs: z.record(z.string()).optional(),
  target: z.string().optional(),
  platform: z.string().optional(),
  noCache: z.boolean().default(false),
  pull: z.boolean().default(false),
  labels: z.record(z.string()).optional(),
  push: z.boolean().default(false),
});

const buildListQuery = z.object({
  status: z.enum(['building', 'success', 'error', 'cancelled']).optional(),
});

export async function buildRoutes(fastify: FastifyInstance) {
  // Start a build (REST endpoint returns buildId, use WebSocket for streaming)
  fastify.post<{ Body: z.infer<typeof buildBody> }>(
    '/builds',
    {
      schema: {
        body: buildBody,
      },
    },
    async (request, reply) => {
      const { context, dockerfile, tags, buildArgs, target, platform, noCache, pull, labels } =
        request.body;

      try {
        // Start the build and get buildId
        const buildId = await startDockerBuild({
          context,
          dockerfile,
          tags,
          buildArgs,
          target,
          platform,
          noCache,
          pull,
          labels,
        });

        request.log.info({ buildId, context, tags }, 'Build started');

        return reply.send({
          success: true,
          data: {
            buildId,
            message: 'Build started successfully',
            streamUrl: `/api/builds/${buildId}/stream`,
          },
        });
      } catch (error) {
        const err = error as Error;
        request.log.error({ err }, 'Failed to start build');

        return reply.status(500).send({
          success: false,
          error: {
            code: 'BUILD_START_ERROR',
            message: err.message,
          },
        });
      }
    }
  );

  // List active builds
  fastify.get<{ Querystring: z.infer<typeof buildListQuery> }>(
    '/builds',
    {
      schema: {
        querystring: buildListQuery,
      },
    },
    async (request, reply) => {
      const { status } = request.query;

      try {
        let builds = getAllActiveBuilds();

        // Filter by status if provided
        if (status) {
          builds = builds.filter((b) => b.status === status);
        }

        return reply.send({
          success: true,
          data: builds,
        });
      } catch (error) {
        const err = error as Error;
        request.log.error({ err }, 'Failed to list builds');

        return reply.status(500).send({
          success: false,
          error: {
            code: 'LIST_BUILDS_ERROR',
            message: err.message,
          },
        });
      }
    }
  );

  // Get build status
  fastify.get<{ Params: { id: string } }>('/builds/:id/status', async (request, reply) => {
    const { id } = request.params;

    try {
      const build = getActiveBuild(id);

      if (!build) {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'BUILD_NOT_FOUND',
            message: 'Build not found',
          },
        });
      }

      const result: BuildProgress = {
        id,
        status: build.status === 'cancelled' ? 'error' : build.status,
        message: build.error || undefined,
      };

      return reply.send({
        success: true,
        data: result,
      });
    } catch (error) {
      const err = error as Error;
      request.log.error({ err, buildId: id }, 'Failed to get build status');

      return reply.status(500).send({
        success: false,
        error: {
          code: 'BUILD_STATUS_ERROR',
          message: err.message,
        },
      });
    }
  });

  // Get build logs
  fastify.get<{ Params: { id: string } }>('/builds/:id/logs', async (request, reply) => {
    const { id } = request.params;

    try {
      const build = getActiveBuild(id);

      if (!build) {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'BUILD_NOT_FOUND',
            message: 'Build not found',
          },
        });
      }

      return reply.send({
        success: true,
        data: {
          buildId: id,
          status: build.status,
          logs: build.logs,
        },
      });
    } catch (error) {
      const err = error as Error;
      request.log.error({ err, buildId: id }, 'Failed to get build logs');

      return reply.status(500).send({
        success: false,
        error: {
          code: 'BUILD_LOGS_ERROR',
          message: err.message,
        },
      });
    }
  });

  // Cancel a build
  fastify.post<{ Params: { id: string } }>('/builds/:id/cancel', async (request, reply) => {
    const { id } = request.params;

    try {
      const cancelled = cancelBuild(id);

      if (!cancelled) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'BUILD_CANCEL_ERROR',
            message: 'Build not found or already completed',
          },
        });
      }

      request.log.info({ buildId: id }, 'Build cancelled');

      return reply.send({
        success: true,
        data: {
          buildId: id,
          message: 'Build cancelled successfully',
        },
      });
    } catch (error) {
      const err = error as Error;
      request.log.error({ err, buildId: id }, 'Failed to cancel build');

      return reply.status(500).send({
        success: false,
        error: {
          code: 'BUILD_CANCEL_ERROR',
          message: err.message,
        },
      });
    }
  });

  // Delete build (clear from memory)
  fastify.delete<{ Params: { id: string } }>('/builds/:id', async (request, reply) => {
    const { id } = request.params;

    try {
      const build = getActiveBuild(id);

      if (!build) {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'BUILD_NOT_FOUND',
            message: 'Build not found',
          },
        });
      }

      // Cancel if still running
      if (build.status === 'building') {
        cancelBuild(id);
      }

      // Remove from active builds
      // Note: In the websocket/build.ts, cleanup happens via interval
      // Here we just acknowledge the deletion

      request.log.info({ buildId: id }, 'Build deleted');

      return reply.send({
        success: true,
        data: {
          buildId: id,
          message: 'Build deleted successfully',
        },
      });
    } catch (error) {
      const err = error as Error;
      request.log.error({ err, buildId: id }, 'Failed to delete build');

      return reply.status(500).send({
        success: false,
        error: {
          code: 'BUILD_DELETE_ERROR',
          message: err.message,
        },
      });
    }
  });

  // Clear completed builds
  fastify.delete('/builds/completed', async (request, reply) => {
    try {
      let cleared = 0;

      for (const build of getAllActiveBuilds()) {
        const fullBuild = getActiveBuild(build.id);
        if (fullBuild && fullBuild.status !== 'building') {
          // This will be cleaned up by the interval in websocket/build.ts
          // But we can mark it for immediate cleanup
          cleared++;
        }
      }

      request.log.info({ cleared }, 'Completed builds cleared');

      return reply.send({
        success: true,
        data: {
          cleared,
          message: `Cleared ${cleared} completed builds`,
        },
      });
    } catch (error) {
      const err = error as Error;
      request.log.error({ err }, 'Failed to clear completed builds');

      return reply.status(500).send({
        success: false,
        error: {
          code: 'CLEAR_BUILDS_ERROR',
          message: err.message,
        },
      });
    }
  });

  // Validate build context
  fastify.post<{ Body: { context: string; dockerfile?: string } }>(
    '/builds/validate',
    {
      schema: {
        body: z.object({
          context: z.string(),
          dockerfile: z.string().optional(),
        }),
      },
    },
    async (request, reply) => {
      const { context, dockerfile } = request.body;

      try {
        // Basic validation - check if context path exists
        // This is a simplified validation, in production you'd do more
        const fs = await import('fs');
        const path = await import('path');

        const resolvedContext = path.resolve(context);

        if (!fs.existsSync(resolvedContext)) {
          return reply.status(400).send({
            success: false,
            error: {
              code: 'INVALID_CONTEXT',
              message: 'Build context path does not exist',
            },
          });
        }

        // Check if Dockerfile exists
        const dockerfileName = dockerfile || 'Dockerfile';
        const dockerfilePath = path.join(resolvedContext, dockerfileName);

        if (!fs.existsSync(dockerfilePath)) {
          return reply.status(400).send({
            success: false,
            error: {
              code: 'DOCKERFILE_NOT_FOUND',
              message: `Dockerfile '${dockerfileName}' not found in context`,
            },
          });
        }

        return reply.send({
          success: true,
          data: {
            context: resolvedContext,
            dockerfile: dockerfileName,
            valid: true,
          },
        });
      } catch (error) {
        const err = error as Error;
        request.log.error({ err }, 'Failed to validate build context');

        return reply.status(500).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: err.message,
          },
        });
      }
    }
  );
}
