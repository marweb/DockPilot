import Docker from 'dockerode';
import type { Config } from '../config/index.js';

let docker: Docker | null = null;

export function initDocker(config: Config): Docker {
  if (docker) {
    return docker;
  }

  // Parse Docker host
  const host = config.dockerHost;
  
  if (host.startsWith('unix://')) {
    docker = new Docker({ socketPath: host.replace('unix://', '') });
  } else if (host.startsWith('tcp://')) {
    const url = new URL(host);
    docker = new Docker({
      host: url.hostname,
      port: parseInt(url.port, 10) || 2375,
    });
  } else if (host.startsWith('unix:///') || host.startsWith('/')) {
    docker = new Docker({ socketPath: host.replace('unix://', '') });
  } else {
    // Default to socket
    docker = new Docker({ socketPath: '/var/run/docker.sock' });
  }

  return docker;
}

export function getDocker(): Docker {
  if (!docker) {
    throw new Error('Docker not initialized. Call initDocker first.');
  }
  return docker;
}

export async function checkDockerConnection(): Promise<boolean> {
  try {
    const d = getDocker();
    await d.ping();
    return true;
  } catch {
    return false;
  }
}

export async function getDockerInfo(): Promise<Docker.Info> {
  const d = getDocker();
  return d.info();
}

export async function getDockerVersion(): Promise<Docker.Version> {
  const d = getDocker();
  return d.version();
}
