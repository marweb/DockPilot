import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';

export const TEST_IMAGES = {
  ALPINE: 'alpine:latest',
  BUSYBOX: 'busybox:latest',
  NGINX: 'nginx:alpine',
  REDIS: 'redis:alpine',
  POSTGRES: 'postgres:15-alpine',
} as const;

export const TEST_CONTAINERS = {
  ALPINE: 'test-alpine',
  BUSYBOX: 'test-busybox',
  NGINX: 'test-nginx',
} as const;

export const TEST_VOLUMES = {
  TEST: 'test-volume',
  DATA: 'test-data-volume',
  CONFIG: 'test-config-volume',
} as const;

export const TEST_NETWORKS = {
  TEST: 'test-network',
  BACKEND: 'test-backend',
  FRONTEND: 'test-frontend',
} as const;

export const TEST_STACKS = {
  SIMPLE: `version: '3.8'
services:
  web:
    image: nginx:alpine
    ports:
      - "8080:80"
    environment:
      - NGINX_HOST=localhost
      - NGINX_PORT=80
`,

  MULTI_SERVICE: `version: '3.8'
services:
  web:
    image: nginx:alpine
    ports:
      - "8080:80"
    depends_on:
      - api
  
  api:
    image: alpine:latest
    command: sleep 300
    environment:
      - API_PORT=3000
  
  db:
    image: redis:alpine
    volumes:
      - redis-data:/data

volumes:
  redis-data:
`,

  WITH_VOLUMES: `version: '3.8'
services:
  app:
    image: alpine:latest
    command: sleep 300
    volumes:
      - app-data:/data
      - app-config:/config
    environment:
      - DATA_DIR=/data
      - CONFIG_DIR=/config

volumes:
  app-data:
    driver: local
  app-config:
    driver: local
`,

  WITH_NETWORKS: `version: '3.8'
services:
  frontend:
    image: nginx:alpine
    networks:
      - frontend-net
  
  backend:
    image: alpine:latest
    command: sleep 300
    networks:
      - frontend-net
      - backend-net
  
  database:
    image: redis:alpine
    networks:
      - backend-net

networks:
  frontend-net:
    driver: bridge
  backend-net:
    driver: bridge
    internal: true
`,

  WITH_DEPENDS: `version: '3.8'
services:
  web:
    image: nginx:alpine
    depends_on:
      api:
        condition: service_started
  
  api:
    image: alpine:latest
    command: sleep 300
    depends_on:
      - db
  
  db:
    image: redis:alpine
`,

  COMPLEX: `version: '3.8'
services:
  web:
    image: nginx:alpine
    ports:
      - "8080:80"
      - "8443:443"
    volumes:
      - web-html:/usr/share/nginx/html
      - web-conf:/etc/nginx/conf.d
    networks:
      - frontend
    depends_on:
      - api
    environment:
      - NGINX_WORKER_PROCESSES=auto
    deploy:
      replicas: 1
      restart_policy:
        condition: on-failure
  
  api:
    image: alpine:latest
    command: sleep 300
    volumes:
      - api-logs:/var/log
    networks:
      - frontend
      - backend
    depends_on:
      - db
      - cache
    environment:
      - API_ENV=production
      - DB_HOST=db
      - CACHE_HOST=cache
  
  db:
    image: postgres:15-alpine
    volumes:
      - db-data:/var/lib/postgresql/data
    networks:
      - backend
    environment:
      - POSTGRES_USER=app
      - POSTGRES_PASSWORD=secret
      - POSTGRES_DB=appdb
  
  cache:
    image: redis:alpine
    volumes:
      - cache-data:/data
    networks:
      - backend
    command: redis-server --appendonly yes

volumes:
  web-html:
  web-conf:
  api-logs:
  db-data:
  cache-data:

networks:
  frontend:
    driver: bridge
  backend:
    driver: bridge
    internal: true
`,
} as const;

const createdResources = {
  images: new Set<string>(),
  containers: new Set<string>(),
  volumes: new Set<string>(),
  networks: new Set<string>(),
  stacks: new Set<string>(),
};

export async function createTestImage(imageName: string): Promise<void> {
  try {
    execSync(`docker pull ${imageName}`, { stdio: 'ignore' });
    createdResources.images.add(imageName);
  } catch (error) {
    console.warn(`Failed to pull image ${imageName}:`, error);
  }
}

export async function createTestContainer(
  name: string,
  options?: {
    image?: string;
    network?: string;
    command?: string;
    volumes?: string[];
    env?: Record<string, string>;
    detached?: boolean;
  }
): Promise<string> {
  const containerName = `test-${name}-${Date.now()}`;
  const image = options?.image || TEST_IMAGES.ALPINE;
  const command = options?.command || 'sleep 300';
  const detached = options?.detached !== false;

  let dockerCmd = `docker run --name ${containerName}`;

  if (detached) {
    dockerCmd += ' -d';
  }

  if (options?.network) {
    dockerCmd += ` --network ${options.network}`;
  }

  if (options?.volumes) {
    options.volumes.forEach((volume) => {
      dockerCmd += ` -v ${volume}`;
    });
  }

  if (options?.env) {
    Object.entries(options.env).forEach(([key, value]) => {
      dockerCmd += ` -e ${key}=${value}`;
    });
  }

  dockerCmd += ` ${image} ${command}`;

  try {
    execSync(dockerCmd, { stdio: 'ignore' });
    createdResources.containers.add(containerName);
    return containerName;
  } catch (error) {
    console.error(`Failed to create container ${containerName}:`, error);
    throw error;
  }
}

export async function createTestVolume(
  name: string,
  options?: {
    driver?: string;
    labels?: Record<string, string>;
  }
): Promise<string> {
  const volumeName = `test-${name}-${Date.now()}`;
  let dockerCmd = `docker volume create ${volumeName}`;

  if (options?.driver) {
    dockerCmd += ` --driver ${options.driver}`;
  }

  if (options?.labels) {
    Object.entries(options.labels).forEach(([key, value]) => {
      dockerCmd += ` --label ${key}=${value}`;
    });
  }

  try {
    execSync(dockerCmd, { stdio: 'ignore' });
    createdResources.volumes.add(volumeName);
    return volumeName;
  } catch (error) {
    console.error(`Failed to create volume ${volumeName}:`, error);
    throw error;
  }
}

export async function createTestNetwork(
  name: string,
  options?: {
    driver?: string;
    subnet?: string;
    gateway?: string;
    internal?: boolean;
    attachable?: boolean;
  }
): Promise<string> {
  const networkName = `test-${name}-${Date.now()}`;
  let dockerCmd = `docker network create ${networkName}`;

  if (options?.driver) {
    dockerCmd += ` --driver ${options.driver}`;
  }

  if (options?.subnet) {
    dockerCmd += ` --subnet ${options.subnet}`;
  }

  if (options?.gateway) {
    dockerCmd += ` --gateway ${options.gateway}`;
  }

  if (options?.internal) {
    dockerCmd += ' --internal';
  }

  if (options?.attachable) {
    dockerCmd += ' --attachable';
  }

  try {
    execSync(dockerCmd, { stdio: 'ignore' });
    createdResources.networks.add(networkName);
    return networkName;
  } catch (error) {
    console.error(`Failed to create network ${networkName}:`, error);
    throw error;
  }
}

export async function createTestComposeFile(
  name: string,
  content: string,
  tempDir: string
): Promise<string> {
  const filePath = path.join(tempDir, `${name}.yml`);

  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  fs.writeFileSync(filePath, content);
  return filePath;
}

export async function deployTestStack(
  stackName: string,
  composeContent: string,
  tempDir: string
): Promise<void> {
  const filePath = await createTestComposeFile(stackName, composeContent, tempDir);

  try {
    execSync(`docker compose -p ${stackName} -f ${filePath} up -d`, {
      stdio: 'ignore',
      cwd: tempDir,
    });
    createdResources.stacks.add(stackName);
  } catch (error) {
    console.error(`Failed to deploy stack ${stackName}:`, error);
    throw error;
  }
}

export async function cleanupTestImages(): Promise<void> {
  for (const image of createdResources.images) {
    try {
      execSync(`docker rmi ${image} --force`, { stdio: 'ignore' });
    } catch (error) {
      console.warn(`Failed to remove image ${image}:`, error);
    }
  }
  createdResources.images.clear();
}

export async function cleanupTestContainers(): Promise<void> {
  for (const container of createdResources.containers) {
    try {
      execSync(`docker stop ${container} --time 1`, { stdio: 'ignore' });
      execSync(`docker rm ${container} --force`, { stdio: 'ignore' });
    } catch (error) {
      console.warn(`Failed to remove container ${container}:`, error);
    }
  }
  createdResources.containers.clear();

  try {
    const output = execSync('docker ps -aq --filter "name=test-"', {
      encoding: 'utf-8',
    }).trim();

    if (output) {
      const containers = output.split('\n').filter(Boolean);
      for (const container of containers) {
        try {
          execSync(`docker stop ${container} --time 1`, { stdio: 'ignore' });
          execSync(`docker rm ${container} --force`, { stdio: 'ignore' });
        } catch {
          // Ignore errors
        }
      }
    }
  } catch {
    // No test containers found
  }
}

export async function cleanupTestVolumes(): Promise<void> {
  for (const volume of createdResources.volumes) {
    try {
      execSync(`docker volume rm ${volume} --force`, { stdio: 'ignore' });
    } catch (error) {
      console.warn(`Failed to remove volume ${volume}:`, error);
    }
  }
  createdResources.volumes.clear();

  try {
    const output = execSync('docker volume ls -q --filter "name=test-"', {
      encoding: 'utf-8',
    }).trim();

    if (output) {
      const volumes = output.split('\n').filter(Boolean);
      for (const volume of volumes) {
        try {
          execSync(`docker volume rm ${volume} --force`, { stdio: 'ignore' });
        } catch {
          // Ignore errors
        }
      }
    }
  } catch {
    // No test volumes found
  }
}

export async function cleanupTestNetworks(): Promise<void> {
  for (const network of createdResources.networks) {
    try {
      execSync(`docker network rm ${network}`, { stdio: 'ignore' });
    } catch (error) {
      console.warn(`Failed to remove network ${network}:`, error);
    }
  }
  createdResources.networks.clear();

  try {
    const output = execSync('docker network ls -q --filter "name=test-"', {
      encoding: 'utf-8',
    }).trim();

    if (output) {
      const networks = output.split('\n').filter(Boolean);
      for (const network of networks) {
        try {
          execSync(`docker network rm ${network}`, { stdio: 'ignore' });
        } catch {
          // Ignore errors
        }
      }
    }
  } catch {
    // No test networks found
  }
}

export async function cleanupTestStacks(): Promise<void> {
  for (const stack of createdResources.stacks) {
    try {
      execSync(`docker compose -p ${stack} down --volumes --remove-orphans`, {
        stdio: 'ignore',
      });
    } catch (error) {
      console.warn(`Failed to remove stack ${stack}:`, error);
    }
  }
  createdResources.stacks.clear();

  try {
    const output = execSync('docker ps -aq --filter "label=com.docker.compose.project"', {
      encoding: 'utf-8',
    }).trim();

    if (output) {
      const containers = output.split('\n').filter(Boolean);
      for (const container of containers) {
        const projectLabel = execSync(
          `docker inspect --format='{{index .Config.Labels "com.docker.compose.project"}}' ${container}`,
          { encoding: 'utf-8' }
        ).trim();

        if (projectLabel.startsWith('test-')) {
          try {
            execSync(`docker compose -p ${projectLabel} down --volumes --remove-orphans`, {
              stdio: 'ignore',
            });
          } catch {
            // Ignore errors
          }
        }
      }
    }
  } catch {
    // No test stacks found
  }
}

export async function cleanupAllTestResources(): Promise<void> {
  await cleanupTestStacks();
  await cleanupTestContainers();
  await cleanupTestVolumes();
  await cleanupTestNetworks();
  await cleanupTestImages();
}

export function getTestResourceCount(): {
  images: number;
  containers: number;
  volumes: number;
  networks: number;
  stacks: number;
} {
  return {
    images: createdResources.images.size,
    containers: createdResources.containers.size,
    volumes: createdResources.volumes.size,
    networks: createdResources.networks.size,
    stacks: createdResources.stacks.size,
  };
}

export async function waitForContainerStatus(
  containerName: string,
  expectedStatus: 'running' | 'exited' | 'paused',
  timeout = 30000
): Promise<boolean> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    try {
      const status = execSync(`docker inspect --format='{{.State.Status}}' ${containerName}`, {
        encoding: 'utf-8',
      }).trim();

      if (status === expectedStatus) {
        return true;
      }
    } catch {
      return false;
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  return false;
}

export async function waitForStackHealthy(stackName: string, timeout = 60000): Promise<boolean> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    try {
      const output = execSync(`docker compose -p ${stackName} ps --format json`, {
        encoding: 'utf-8',
      }).trim();

      if (output) {
        const services = JSON.parse(output);
        if (Array.isArray(services) && services.every((s) => s.State === 'running')) {
          return true;
        }
      }
    } catch {
      // Stack not ready yet
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  return false;
}
