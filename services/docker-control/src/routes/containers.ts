import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { getDocker } from '../services/docker.js';
import type { Container, ContainerInspect, ContainerStats } from '@dockpilot/types';

// Schemas
const listContainersQuery = z.object({
  all: z.coerce.boolean().default(false),
  limit: z.coerce.number().optional(),
  filters: z.string().optional(),
});

const containerActionParams = z.object({
  id: z.string(),
});

const containerActionBody = z.object({
  t: z.coerce.number().optional(), // timeout for stop
  signal: z.string().optional(),
});

const renameBody = z.object({
  name: z.string(),
});

const execBody = z.object({
  cmd: z.array(z.string()),
  env: z.array(z.string()).optional(),
  user: z.string().optional(),
  privileged: z.boolean().optional(),
  tty: z.boolean().default(true),
  detach: z.boolean().default(false),
});

export async function containerRoutes(fastify: FastifyInstance) {
  // List containers
  fastify.get<{ Querystring: z.infer<typeof listContainersQuery> }>(
    '/containers',
    {
      schema: {
        querystring: listContainersQuery,
      },
    },
    async (request, reply) => {
      const { all, limit, filters } = request.query;
      const docker = getDocker();

      let parsedFilters: Record<string, unknown> | undefined;
      if (filters) {
        try {
          parsedFilters = JSON.parse(filters);
        } catch {
          return reply.status(400).send({ error: 'Invalid filters JSON' });
        }
      }

      const containers = await docker.listContainers({
        all,
        limit,
        filters: parsedFilters,
      });

      const result: Container[] = containers.map((c) => ({
        id: c.Id,
        name: c.Names[0]?.replace(/^\//, '') || '',
        image: c.Image,
        status: c.State as Container['status'],
        state: c.State,
        created: c.Created * 1000,
        ports: c.Ports.map((p) => ({
          containerPort: p.PrivatePort,
          hostPort: p.PublicPort,
          hostIp: p.IP,
          protocol: p.Type as 'tcp' | 'udp',
        })),
        labels: c.Labels || {},
        networks: Object.keys(c.NetworkSettings?.Networks || {}),
        command: c.Command,
      }));

      return reply.send({ success: true, data: result });
    }
  );

  // Get container details
  fastify.get<{ Params: { id: string } }>(
    '/containers/:id',
    async (request, reply) => {
      const { id } = request.params;
      const docker = getDocker();

      try {
        const container = docker.getContainer(id);
        const inspect = await container.inspect();

        const result: ContainerInspect = {
          id: inspect.Id,
          created: inspect.Created,
          path: inspect.Path,
          args: inspect.Args || [],
          state: {
            status: inspect.State.Status,
            running: inspect.State.Running,
            paused: inspect.State.Paused,
            restarting: inspect.State.Restarting,
            oomKilled: inspect.State.OomKilled,
            dead: inspect.State.Dead,
            pid: inspect.State.Pid,
            exitCode: inspect.State.ExitCode,
            error: inspect.State.Error,
            startedAt: inspect.State.StartedAt,
            finishedAt: inspect.State.FinishedAt,
          },
          image: inspect.Image,
          networkSettings: inspect.NetworkSettings as Record<string, unknown>,
          mounts: inspect.Mounts.map((m) => ({
            type: m.Type,
            name: m.Name,
            source: m.Source,
            destination: m.Destination,
            mode: m.Mode,
            rw: m.RW,
          })),
          config: {
            hostname: inspect.Config.Hostname,
            domainname: inspect.Config.Domainname,
            user: inspect.Config.User,
            attachStdin: inspect.Config.AttachStdin,
            attachStdout: inspect.Config.AttachStdout,
            attachStderr: inspect.Config.AttachStderr,
            exposedPorts: inspect.Config.ExposedPorts,
            tty: inspect.Config.Tty,
            openStdin: inspect.Config.OpenStdin,
            stdinOnce: inspect.Config.StdinOnce,
            env: inspect.Config.Env,
            cmd: inspect.Config.Cmd,
            image: inspect.Config.Image,
            workingDir: inspect.Config.WorkingDir,
            labels: inspect.Config.Labels || {},
          },
        };

        return reply.send({ success: true, data: result });
      } catch (error) {
        const err = error as Error;
        if (err.message.includes('No such container')) {
          return reply.status(404).send({ error: 'Container not found' });
        }
        throw error;
      }
    }
  );

  // Start container
  fastify.post<{ Params: { id: string } }>(
    '/containers/:id/start',
    async (request, reply) => {
      const { id } = request.params;
      const docker = getDocker();

      try {
        const container = docker.getContainer(id);
        await container.start();
        return reply.send({ success: true, message: 'Container started' });
      } catch (error) {
        const err = error as Error;
        if (err.message.includes('No such container')) {
          return reply.status(404).send({ error: 'Container not found' });
        }
        throw error;
      }
    }
  );

  // Stop container
  fastify.post<{ Params: { id: string }; Body: z.infer<typeof containerActionBody> }>(
    '/containers/:id/stop',
    {
      schema: {
        body: containerActionBody,
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const { t } = request.body;
      const docker = getDocker();

      try {
        const container = docker.getContainer(id);
        await container.stop({ t });
        return reply.send({ success: true, message: 'Container stopped' });
      } catch (error) {
        const err = error as Error;
        if (err.message.includes('No such container')) {
          return reply.status(404).send({ error: 'Container not found' });
        }
        if (err.message.includes('container already stopped')) {
          return reply.send({ success: true, message: 'Container already stopped' });
        }
        throw error;
      }
    }
  );

  // Restart container
  fastify.post<{ Params: { id: string }; Body: z.infer<typeof containerActionBody> }>(
    '/containers/:id/restart',
    {
      schema: {
        body: containerActionBody,
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const { t } = request.body;
      const docker = getDocker();

      try {
        const container = docker.getContainer(id);
        await container.restart({ t });
        return reply.send({ success: true, message: 'Container restarted' });
      } catch (error) {
        const err = error as Error;
        if (err.message.includes('No such container')) {
          return reply.status(404).send({ error: 'Container not found' });
        }
        throw error;
      }
    }
  );

  // Kill container
  fastify.post<{ Params: { id: string }; Body: z.infer<typeof containerActionBody> }>(
    '/containers/:id/kill',
    {
      schema: {
        body: containerActionBody,
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const { signal } = request.body;
      const docker = getDocker();

      try {
        const container = docker.getContainer(id);
        await container.kill({ signal });
        return reply.send({ success: true, message: 'Container killed' });
      } catch (error) {
        const err = error as Error;
        if (err.message.includes('No such container')) {
          return reply.status(404).send({ error: 'Container not found' });
        }
        throw error;
      }
    }
  );

  // Pause container
  fastify.post<{ Params: { id: string } }>(
    '/containers/:id/pause',
    async (request, reply) => {
      const { id } = request.params;
      const docker = getDocker();

      try {
        const container = docker.getContainer(id);
        await container.pause();
        return reply.send({ success: true, message: 'Container paused' });
      } catch (error) {
        const err = error as Error;
        if (err.message.includes('No such container')) {
          return reply.status(404).send({ error: 'Container not found' });
        }
        throw error;
      }
    }
  );

  // Unpause container
  fastify.post<{ Params: { id: string } }>(
    '/containers/:id/unpause',
    async (request, reply) => {
      const { id } = request.params;
      const docker = getDocker();

      try {
        const container = docker.getContainer(id);
        await container.unpause();
        return reply.send({ success: true, message: 'Container unpaused' });
      } catch (error) {
        const err = error as Error;
        if (err.message.includes('No such container')) {
          return reply.status(404).send({ error: 'Container not found' });
        }
        throw error;
      }
    }
  );

  // Remove container
  fastify.delete<{ Params: { id: string } }>(
    '/containers/:id',
    async (request, reply) => {
      const { id } = request.params;
      const docker = getDocker();

      try {
        const container = docker.getContainer(id);
        await container.remove({ force: true });
        return reply.send({ success: true, message: 'Container removed' });
      } catch (error) {
        const err = error as Error;
        if (err.message.includes('No such container')) {
          return reply.status(404).send({ error: 'Container not found' });
        }
        throw error;
      }
    }
  );

  // Rename container
  fastify.post<{ Params: { id: string }; Body: z.infer<typeof renameBody> }>(
    '/containers/:id/rename',
    {
      schema: {
        body: renameBody,
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const { name } = request.body;
      const docker = getDocker();

      try {
        const container = docker.getContainer(id);
        await container.rename({ name });
        return reply.send({ success: true, message: 'Container renamed' });
      } catch (error) {
        const err = error as Error;
        if (err.message.includes('No such container')) {
          return reply.status(404).send({ error: 'Container not found' });
        }
        throw error;
      }
    }
  );

  // Get container logs
  fastify.get<{ Params: { id: string }; Querystring: { tail?: number; follow?: boolean; since?: number } }>(
    '/containers/:id/logs',
    async (request, reply) => {
      const { id } = request.params;
      const { tail = 100, since } = request.query;
      const docker = getDocker();

      try {
        const container = docker.getContainer(id);
        const logs = await container.logs({
          stdout: true,
          stderr: true,
          tail,
          since,
          timestamps: true,
        });

        // Docker logs are multiplexed with 8-byte headers
        const logString = logs.toString('utf-8').replace(/\x00/g, '');
        return reply.send({ success: true, data: logString });
      } catch (error) {
        const err = error as Error;
        if (err.message.includes('No such container')) {
          return reply.status(404).send({ error: 'Container not found' });
        }
        throw error;
      }
    }
  );

  // Get container stats
  fastify.get<{ Params: { id: string } }>(
    '/containers/:id/stats',
    async (request, reply) => {
      const { id } = request.params;
      const docker = getDocker();

      try {
        const container = docker.getContainer(id);
        const stats = await container.stats({ stream: false });

        // Calculate CPU percentage
        const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - stats.precpu_stats.cpu_usage.total_usage;
        const systemDelta = stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage;
        const cpuPercent = systemDelta > 0 ? (cpuDelta / systemDelta) * (stats.cpu_stats.cpu_usage.percpu_usage?.length || 1) * 100 : 0;

        // Calculate memory percentage
        const memoryUsage = stats.memory_stats.usage || 0;
        const memoryLimit = stats.memory_stats.limit || 1;
        const memoryPercent = (memoryUsage / memoryLimit) * 100;

        // Network stats
        let networkRx = 0;
        let networkTx = 0;
        if (stats.networks) {
          for (const network of Object.values(stats.networks)) {
            networkRx += (network as { rx_bytes: number }).rx_bytes;
            networkTx += (network as { tx_bytes: number }).tx_bytes;
          }
        }

        // Block I/O
        let blockRead = 0;
        let blockWrite = 0;
        if (stats.blkio_stats?.io_service_bytes_recursive) {
          for (const entry of stats.blkio_stats.io_service_bytes_recursive) {
            if (entry.op === 'read') {
              blockRead += entry.value;
            } else if (entry.op === 'write') {
              blockWrite += entry.value;
            }
          }
        }

        const result: ContainerStats = {
          id: stats.id,
          name: stats.name.replace(/^\//, ''),
          cpuPercent: Math.round(cpuPercent * 100) / 100,
          memoryUsage,
          memoryLimit,
          memoryPercent: Math.round(memoryPercent * 100) / 100,
          networkRx,
          networkTx,
          blockRead,
          blockWrite,
        };

        return reply.send({ success: true, data: result });
      } catch (error) {
        const err = error as Error;
        if (err.message.includes('No such container')) {
          return reply.status(404).send({ error: 'Container not found' });
        }
        throw error;
      }
    }
  );

  // Prune containers
  fastify.post(
    '/containers/prune',
    async (request, reply) => {
      const docker = getDocker();

      try {
        const result = await docker.pruneContainers();
        return reply.send({
          success: true,
          data: {
            containersDeleted: result.ContainersDeleted || [],
            spaceReclaimed: result.SpaceReclaimed || 0,
          },
        });
      } catch (error) {
        throw error;
      }
    }
  );

  // Exec endpoint (returns exec ID for WebSocket connection)
  fastify.post<{ Params: { id: string }; Body: z.infer<typeof execBody> }>(
    '/containers/:id/exec',
    {
      schema: {
        body: execBody,
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const { cmd, env, user, privileged, tty, detach } = request.body;
      const docker = getDocker();

      try {
        const container = docker.getContainer(id);
        const exec = await container.exec({
          Cmd: cmd,
          Env: env,
          User: user,
          Privileged: privileged,
          Tty: tty,
          AttachStdin: !detach,
          AttachStdout: true,
          AttachStderr: true,
          Detach: detach,
        });

        return reply.send({
          success: true,
          data: {
            execId: exec.id,
            message: 'Exec created. Connect via WebSocket to interact.',
          },
        });
      } catch (error) {
        const err = error as Error;
        if (err.message.includes('No such container')) {
          return reply.status(404).send({ error: 'Container not found' });
        }
        throw error;
      }
    }
  );
}
