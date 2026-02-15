import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getDocker } from '../services/docker.js';
import type { Network, NetworkCreateOptions } from '@dockpilot/types';

// Schemas
const createNetworkBody = z.object({
  name: z.string(),
  driver: z.string().default('bridge'),
  subnet: z.string().optional(),
  gateway: z.string().optional(),
  labels: z.record(z.string()).optional(),
});

const connectContainerBody = z.object({
  containerId: z.string(),
  ipAddress: z.string().optional(),
});

export async function networkRoutes(fastify: FastifyInstance) {
  // List networks
  fastify.get('/networks', async (_request, reply) => {
    const docker = getDocker();

    const networks = await docker.listNetworks();

    const result: Network[] = networks.map((n) => ({
      id: n.Id,
      name: n.Name,
      driver: n.Driver,
      scope: n.Scope as 'local' | 'swarm',
      subnet: n.IPAM?.Config?.[0]?.Subnet,
      gateway: n.IPAM?.Config?.[0]?.Gateway,
      ipam: {
        driver: n.IPAM?.Driver || 'default',
        config: (n.IPAM?.Config ?? []).map((c) => ({
          subnet: c.Subnet ?? '',
          gateway: c.Gateway,
        })),
      },
      labels: n.Labels || {},
    }));

    return reply.send({ success: true, data: result });
  });

  // Get network details
  fastify.get<{ Params: { id: string } }>('/networks/:id', async (request, reply) => {
    const { id } = request.params;
    const docker = getDocker();

    try {
      const network = docker.getNetwork(id);
      const inspect = await network.inspect();

      const containers: Record<
        string,
        {
          name: string;
          endpointId: string;
          macAddress: string;
          ipv4Address: string;
          ipv6Address: string;
        }
      > = {};

      if (inspect.Containers) {
        for (const [containerId, container] of Object.entries(inspect.Containers)) {
          const c = container as {
            Name: string;
            EndpointID: string;
            MacAddress: string;
            IPv4Address: string;
            IPv6Address: string;
          };
          containers[containerId] = {
            name: c.Name,
            endpointId: c.EndpointID,
            macAddress: c.MacAddress,
            ipv4Address: c.IPv4Address,
            ipv6Address: c.IPv6Address,
          };
        }
      }

      const result: Network = {
        id: inspect.Id,
        name: inspect.Name,
        driver: inspect.Driver,
        scope: inspect.Scope as 'local' | 'swarm',
        subnet: inspect.IPAM?.Config?.[0]?.Subnet,
        gateway: inspect.IPAM?.Config?.[0]?.Gateway,
        ipam: {
          driver: inspect.IPAM?.Driver || 'default',
          config: (inspect.IPAM?.Config ?? []).map((c) => ({
            subnet: c.Subnet ?? '',
            gateway: c.Gateway,
          })),
        },
        containers,
        labels: inspect.Labels || {},
      };

      return reply.send({ success: true, data: result });
    } catch (error) {
      const err = error as Error;
      if (err.message.includes('No such network')) {
        return reply.status(404).send({ error: 'Network not found' });
      }
      throw error;
    }
  });

  // Create network
  fastify.post<{ Body: z.infer<typeof createNetworkBody> }>(
    '/networks',
    {
      schema: {
        body: createNetworkBody,
      },
    },
    async (request, reply) => {
      const { name, driver, subnet, gateway, labels } = request.body;
      const docker = getDocker();

      try {
        const options: NetworkCreateOptions = {
          name,
          driver,
          labels,
        };

        if (subnet || gateway) {
          options.subnet = subnet;
          options.gateway = gateway;
        }

        await docker.createNetwork({
          Name: name,
          Driver: driver,
          Labels: labels,
          IPAM: subnet
            ? {
                Config: [
                  {
                    Subnet: subnet,
                    Gateway: gateway,
                  },
                ],
              }
            : undefined,
        });

        return reply.send({ success: true, message: `Network ${name} created` });
      } catch (error) {
        const err = error as Error;
        return reply.status(400).send({ error: err.message });
      }
    }
  );

  // Remove network
  fastify.delete<{ Params: { id: string } }>('/networks/:id', async (request, reply) => {
    const { id } = request.params;
    const docker = getDocker();

    try {
      const network = docker.getNetwork(id);
      await network.remove();
      return reply.send({ success: true, message: `Network ${id} removed` });
    } catch (error) {
      const err = error as Error;
      if (err.message.includes('No such network')) {
        return reply.status(404).send({ error: 'Network not found' });
      }
      if (err.message.includes('has active endpoints')) {
        return reply.status(409).send({ error: 'Network has active containers connected' });
      }
      throw error;
    }
  });

  // Connect container to network
  fastify.post<{ Params: { id: string }; Body: z.infer<typeof connectContainerBody> }>(
    '/networks/:id/connect',
    {
      schema: {
        body: connectContainerBody,
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const { containerId, ipAddress } = request.body;
      const docker = getDocker();

      try {
        const network = docker.getNetwork(id);
        await network.connect({
          Container: containerId,
          EndpointConfig: ipAddress
            ? {
                IPAMConfig: {
                  IPv4Address: ipAddress,
                },
              }
            : undefined,
        });

        return reply.send({ success: true, message: 'Container connected to network' });
      } catch (error) {
        const err = error as Error;
        if (err.message.includes('No such network')) {
          return reply.status(404).send({ error: 'Network not found' });
        }
        throw error;
      }
    }
  );

  // Disconnect container from network
  fastify.post<{ Params: { id: string }; Body: { containerId: string } }>(
    '/networks/:id/disconnect',
    {
      schema: {
        body: z.object({ containerId: z.string() }),
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const { containerId } = request.body;
      const docker = getDocker();

      try {
        const network = docker.getNetwork(id);
        await network.disconnect({ Container: containerId });
        return reply.send({ success: true, message: 'Container disconnected from network' });
      } catch (error) {
        const err = error as Error;
        if (err.message.includes('No such network')) {
          return reply.status(404).send({ error: 'Network not found' });
        }
        throw error;
      }
    }
  );

  // Prune networks
  fastify.post('/networks/prune', async (_request, reply) => {
    const docker = getDocker();

    try {
      const result = await docker.pruneNetworks();
      return reply.send({
        success: true,
        data: {
          networksDeleted: result.NetworksDeleted || [],
        },
      });
    } catch (error) {
      throw error;
    }
  });
}
