import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getDocker } from '../services/docker.js';
import type { Image, ImageInspect, ImageHistory } from '@dockpilot/types';

// Schemas
const pullImageBody = z.object({
  fromImage: z.string(),
  tag: z.string().default('latest'),
  platform: z.string().optional(),
});

const tagImageBody = z.object({
  repo: z.string(),
  tag: z.string().optional(),
});

export async function imageRoutes(fastify: FastifyInstance) {
  // List images
  fastify.get('/images', async (_request, reply) => {
    const docker = getDocker();

    const images = await docker.listImages({ all: false });

    const result: Image[] = images.map((img) => {
      const repoTags = img.RepoTags || ['<none>:<none>'];
      const [repository, tag] = repoTags[0].split(':');

      return {
        id: img.Id.replace('sha256:', '').substring(0, 12),
        repository: repository || '<none>',
        tag: tag || '<none>',
        size: img.Size,
        created: img.Created * 1000,
        labels: img.Labels || {},
        containers: Math.max(img.Containers ?? 0, 0),
      };
    });

    return reply.send({ success: true, data: result });
  });

  // Get image details
  fastify.get<{ Params: { id: string } }>('/images/:id', async (request, reply) => {
    const { id } = request.params;
    const docker = getDocker();

    try {
      const image = docker.getImage(id);
      const inspect = await image.inspect();

      const result: ImageInspect = {
        id: inspect.Id,
        repoTags: inspect.RepoTags || [],
        repoDigests: inspect.RepoDigests || [],
        created: inspect.Created,
        size: inspect.Size,
        virtualSize: inspect.VirtualSize,
        architecture: inspect.Architecture,
        os: inspect.Os,
        author: inspect.Author,
        config: {
          hostname: inspect.Config?.Hostname || '',
          domainname: inspect.Config?.Domainname || '',
          user: inspect.Config?.User || '',
          attachStdin: inspect.Config?.AttachStdin || false,
          attachStdout: inspect.Config?.AttachStdout || false,
          attachStderr: inspect.Config?.AttachStderr || false,
          exposedPorts: inspect.Config?.ExposedPorts,
          tty: inspect.Config?.Tty || false,
          openStdin: inspect.Config?.OpenStdin || false,
          stdinOnce: inspect.Config?.StdinOnce || false,
          env: inspect.Config?.Env,
          cmd: inspect.Config?.Cmd,
          image: inspect.Config?.Image || '',
          workingDir: inspect.Config?.WorkingDir || '',
          labels: inspect.Config?.Labels || {},
        },
        rootFS: {
          type: inspect.RootFS?.Type || '',
          layers: inspect.RootFS?.Layers || [],
        },
      };

      return reply.send({ success: true, data: result });
    } catch (error) {
      const err = error as Error;
      if (err.message.includes('No such image')) {
        return reply.status(404).send({ error: 'Image not found' });
      }
      throw error;
    }
  });

  // Pull image
  fastify.post<{ Body: z.infer<typeof pullImageBody> }>(
    '/images/pull',
    {
      schema: {
        body: pullImageBody,
      },
    },
    async (request, reply) => {
      const { fromImage, tag, platform } = request.body;
      const docker = getDocker();

      try {
        const stream = await docker.pull(`${fromImage}:${tag}`, {
          platform,
        });

        // Wait for pull to complete
        await new Promise<void>((resolve, reject) => {
          docker.modem.followProgress(stream, (err) => {
            if (err) reject(err);
            else resolve();
          });
        });

        return reply.send({
          success: true,
          message: `Image ${fromImage}:${tag} pulled successfully`,
        });
      } catch (error) {
        const err = error as Error;
        return reply.status(400).send({ error: err.message });
      }
    }
  );

  // Tag image
  fastify.post<{ Params: { id: string }; Body: z.infer<typeof tagImageBody> }>(
    '/images/:id/tag',
    {
      schema: {
        body: tagImageBody,
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const { repo, tag } = request.body;
      const docker = getDocker();

      try {
        const image = docker.getImage(id);
        await image.tag({ repo, tag });
        return reply.send({ success: true, message: 'Image tagged successfully' });
      } catch (error) {
        const err = error as Error;
        if (err.message.includes('No such image')) {
          return reply.status(404).send({ error: 'Image not found' });
        }
        throw error;
      }
    }
  );

  // Remove image
  fastify.delete<{ Params: { id: string } }>('/images/:id', async (request, reply) => {
    const { id } = request.params;
    const docker = getDocker();

    try {
      const image = docker.getImage(id);
      const result = await image.remove({ force: true });
      return reply.send({
        success: true,
        data: {
          untagged: result.Untagged || [],
          deleted: result.Deleted || [],
        },
      });
    } catch (error) {
      const err = error as Error;
      if (err.message.includes('No such image')) {
        return reply.status(404).send({ error: 'Image not found' });
      }
      if (err.message.includes('image is being used')) {
        return reply.status(409).send({ error: 'Image is being used by a container' });
      }
      throw error;
    }
  });

  // Get image history
  fastify.get<{ Params: { id: string } }>('/images/:id/history', async (request, reply) => {
    const { id } = request.params;
    const docker = getDocker();

    try {
      const image = docker.getImage(id);
      const history = await image.history();

      const result: ImageHistory[] = history.map(
        (h: {
          Id: string;
          Created: number;
          CreatedBy?: string;
          Size: number;
          Comment?: string;
        }) => ({
          id: h.Id.replace('sha256:', '').substring(0, 12),
          created: h.Created * 1000,
          createdBy: h.CreatedBy || '',
          size: h.Size,
          comment: h.Comment || '',
        })
      );

      return reply.send({ success: true, data: result });
    } catch (error) {
      const err = error as Error;
      if (err.message.includes('No such image')) {
        return reply.status(404).send({ error: 'Image not found' });
      }
      throw error;
    }
  });

  // Prune images
  fastify.post('/images/prune', async (_request, reply) => {
    const docker = getDocker();

    try {
      const result = await docker.pruneImages();
      return reply.send({
        success: true,
        data: {
          imagesDeleted: result.ImagesDeleted || [],
          spaceReclaimed: result.SpaceReclaimed || 0,
        },
      });
    } catch (error) {
      throw error;
    }
  });
}
