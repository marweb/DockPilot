import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getDocker } from '../services/docker.js';
import type { Volume, VolumeInspect } from '@dockpilot/types';

// Schemas
const createVolumeBody = z.object({
  name: z.string(),
  driver: z.string().default('local'),
  labels: z.record(z.string()).optional(),
  options: z.record(z.string()).optional(),
});

export async function volumeRoutes(fastify: FastifyInstance) {
  // List volumes
  fastify.get('/volumes', async (_request, reply) => {
    const docker = getDocker();

    const result = await docker.listVolumes();

    const volumes: Volume[] = (result.Volumes || []).map((v) => ({
      name: v.Name,
      driver: v.Driver,
      mountpoint: v.Mountpoint,
      createdAt: (v as { CreatedAt?: string }).CreatedAt,
      labels: v.Labels || {},
      scope: v.Scope as 'local' | 'global',
      options: v.Options ?? undefined,
      usageData: v.UsageData
        ? {
            size: v.UsageData.Size,
            refCount: v.UsageData.RefCount,
          }
        : undefined,
    }));

    return reply.send({ success: true, data: volumes });
  });

  // Get volume details
  fastify.get<{ Params: { name: string } }>('/volumes/:name', async (request, reply) => {
    const { name } = request.params;
    const docker = getDocker();

    try {
      const volume = docker.getVolume(name);
      const inspect = await volume.inspect();

      const result: VolumeInspect = {
        name: inspect.Name,
        driver: inspect.Driver,
        mountpoint: inspect.Mountpoint,
        createdAt: (inspect as { CreatedAt?: string }).CreatedAt,
        labels: inspect.Labels || {},
        scope: inspect.Scope as 'local' | 'global',
        options: inspect.Options ?? undefined,
        status: inspect.Status,
        usageData: inspect.UsageData
          ? {
              size: inspect.UsageData.Size,
              refCount: inspect.UsageData.RefCount,
            }
          : undefined,
      };

      return reply.send({ success: true, data: result });
    } catch (error) {
      const err = error as Error;
      if (err.message.includes('No such volume')) {
        return reply.status(404).send({ error: 'Volume not found' });
      }
      throw error;
    }
  });

  // Create volume
  fastify.post<{ Body: z.infer<typeof createVolumeBody> }>(
    '/volumes',
    {
      schema: {
        body: createVolumeBody,
      },
    },
    async (request, reply) => {
      const { name, driver, labels, options } = request.body;
      const docker = getDocker();

      try {
        await docker.createVolume({
          Name: name,
          Driver: driver,
          Labels: labels,
          DriverOpts: options,
        });

        return reply.send({ success: true, message: `Volume ${name} created` });
      } catch (error) {
        const err = error as Error;
        return reply.status(400).send({ error: err.message });
      }
    }
  );

  // Remove volume
  fastify.delete<{ Params: { name: string } }>('/volumes/:name', async (request, reply) => {
    const { name } = request.params;
    const docker = getDocker();

    try {
      const volume = docker.getVolume(name);
      await volume.remove();
      return reply.send({ success: true, message: `Volume ${name} removed` });
    } catch (error) {
      const err = error as Error;
      if (err.message.includes('No such volume')) {
        return reply.status(404).send({ error: 'Volume not found' });
      }
      if (err.message.includes('volume is in use')) {
        return reply.status(409).send({ error: 'Volume is in use by a container' });
      }
      throw error;
    }
  });

  // Prune volumes
  fastify.post('/volumes/prune', async (_request, reply) => {
    const docker = getDocker();

    try {
      const result = await docker.pruneVolumes();
      return reply.send({
        success: true,
        data: {
          volumesDeleted: result.VolumesDeleted || [],
          spaceReclaimed: result.SpaceReclaimed || 0,
        },
      });
    } catch (error) {
      throw error;
    }
  });
}
