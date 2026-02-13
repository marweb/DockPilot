import type { FastifyInstance } from 'fastify';
import { getDocker, getDockerInfo, getDockerVersion, checkDockerConnection } from '../services/docker.js';
import type { DockerInfo, DockerVersion, DiskUsage } from '@dockpilot/types';

export async function systemRoutes(fastify: FastifyInstance) {
  // Health check
  fastify.get('/healthz', async (_request, reply) => {
    const dockerConnected = await checkDockerConnection();
    
    if (!dockerConnected) {
      return reply.status(503).send({
        status: 'unhealthy',
        docker: 'disconnected',
      });
    }

    return reply.send({
      status: 'healthy',
      docker: 'connected',
    });
  });

  // Docker info
  fastify.get('/info', async (_request, reply) => {
    const info = await getDockerInfo();

    const result: DockerInfo = {
      id: info.ID || '',
      containers: info.Containers,
      containersRunning: info.ContainersRunning,
      containersStopped: info.ContainersStopped,
      containersPaused: info.ContainersPaused,
      images: info.Images,
      driver: info.Driver,
      driverStatus: info.DriverStatus || [],
      dockerRootDir: info.DockerRootDir,
      operatingSystem: info.OperatingSystem,
      architecture: info.Architecture,
      cpus: info.NCPU,
      memoryLimit: info.MemoryLimit,
      swapLimit: info.SwapLimit,
      kernelVersion: info.KernelVersion,
      kernelMemory: info.KernelMemory,
      osType: info.OSType,
      os: info.OperatingSystem,
      name: info.Name,
      serverVersion: info.ServerVersion,
    };

    return reply.send({ success: true, data: result });
  });

  // Docker version
  fastify.get('/version', async (_request, reply) => {
    const version = await getDockerVersion();
    const v = version as unknown as { Version?: string; ApiVersion?: string; GitCommit?: string; GoVersion?: string; Os?: string; Arch?: string; BuildTime?: string };

    const result: DockerVersion = {
      version: v.Version ?? '',
      apiVersion: v.ApiVersion ?? '',
      gitCommit: v.GitCommit ?? '',
      goVersion: v.GoVersion ?? '',
      os: v.Os ?? '',
      arch: v.Arch ?? '',
      buildTime: v.BuildTime ?? '',
    };

    return reply.send({ success: true, data: result });
  });

  // Disk usage
  fastify.get('/df', async (_request, reply) => {
    const docker = getDocker();
    const df = await docker.df();

    const result: DiskUsage = {
      layersSize: df.LayersSize,
      images: (df.Images || []).map((img: { Id?: string; Size?: number; SharedSize?: number; VirtualSize?: number }) => ({
        id: (img.Id ?? '').replace('sha256:', '').substring(0, 12),
        size: img.Size,
        sharedSize: img.SharedSize,
        virtualSize: img.VirtualSize,
      })),
      containers: (df.Containers || []).map((c: { Id?: string; SizeRw?: number; SizeRootFs?: number }) => ({
        id: (c.Id ?? '').replace('sha256:', '').substring(0, 12),
        sizeRw: c.SizeRw,
        sizeRootFs: c.SizeRootFs,
      })),
      volumes: (df.Volumes || []).map((v: { Name?: string; UsageData?: { Size?: number } }) => ({
        name: v.Name,
        size: v.UsageData?.Size || 0,
      })),
    };

    return reply.send({ success: true, data: result });
  });

  // Ping Docker daemon
  fastify.get('/ping', async (_request, reply) => {
    const docker = getDocker();
    const result = await docker.ping();
    return reply.send({ success: true, data: result.toString() });
  });
}
