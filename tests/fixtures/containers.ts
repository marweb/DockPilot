/**
 * Container test fixtures for E2E testing
 * Provides configurations for various container types used in tests
 */

// Local Container type definition for test fixtures
interface Container {
  id: string;
  name: string;
  image: string;
  status: string;
  state: string;
  created: number;
  ports: Array<{
    containerPort: number;
    hostPort: number;
    hostIp: string;
    protocol: string;
  }>;
  labels: Record<string, string>;
  networks: string[];
  command?: string;
  env?: Record<string, string>;
  mounts?: Array<{
    source: string;
    destination: string;
    mode: string;
  }>;
}

/**
 * Base container configuration interface
 */
export interface ContainerTestConfig {
  name: string;
  image: string;
  tag?: string;
  command?: string;
  ports?: Array<{
    hostPort: number;
    containerPort: number;
    protocol?: 'tcp' | 'udp';
    hostIp?: string;
  }>;
  env?: Record<string, string>;
  labels?: Record<string, string>;
  volumes?: Array<{
    hostPath?: string;
    containerPath: string;
    mode?: 'ro' | 'rw';
  }>;
  networks?: string[];
  memory?: number;
  cpus?: number;
  restartPolicy?: 'no' | 'always' | 'unless-stopped' | 'on-failure';
}

/**
 * Nginx container configuration
 * Simple web server for testing HTTP functionality
 */
export const nginxContainer: ContainerTestConfig = {
  name: 'test-nginx',
  image: 'nginx',
  tag: 'alpine',
  command: 'nginx -g "daemon off;"',
  ports: [{ hostPort: 8888, containerPort: 80, protocol: 'tcp', hostIp: '0.0.0.0' }],
  env: {
    NGINX_HOST: 'localhost',
    NGINX_PORT: '80',
  },
  labels: {
    'test.suite': 'e2e',
    'app.type': 'web-server',
    'app.name': 'nginx',
  },
  memory: 128 * 1024 * 1024, // 128MB
  cpus: 0.5,
  restartPolicy: 'unless-stopped',
};

/**
 * Redis container configuration
 * In-memory data store for testing caching functionality
 */
export const redisContainer: ContainerTestConfig = {
  name: 'test-redis',
  image: 'redis',
  tag: 'alpine',
  command: 'redis-server --appendonly yes',
  ports: [{ hostPort: 6380, containerPort: 6379, protocol: 'tcp', hostIp: '0.0.0.0' }],
  env: {
    REDIS_PASSWORD: 'testpassword123',
  },
  labels: {
    'test.suite': 'e2e',
    'app.type': 'cache',
    'app.name': 'redis',
  },
  volumes: [{ containerPath: '/data', mode: 'rw' }],
  memory: 256 * 1024 * 1024, // 256MB
  cpus: 0.5,
  restartPolicy: 'unless-stopped',
};

/**
 * Alpine container configuration
 * Minimal Linux container for testing basic functionality
 */
export const alpineContainer: ContainerTestConfig = {
  name: 'test-alpine',
  image: 'alpine',
  tag: 'latest',
  command: 'sh -c "while true; do sleep 3600; done"',
  env: {
    TEST_ENV: 'true',
    APP_ENV: 'testing',
  },
  labels: {
    'test.suite': 'e2e',
    'app.type': 'test',
    'app.name': 'alpine',
  },
  memory: 64 * 1024 * 1024, // 64MB
  cpus: 0.25,
};

/**
 * PostgreSQL container configuration
 * Database container for testing data persistence
 */
export const postgresContainer: ContainerTestConfig = {
  name: 'test-postgres',
  image: 'postgres',
  tag: '15-alpine',
  command: 'postgres',
  ports: [{ hostPort: 5433, containerPort: 5432, protocol: 'tcp', hostIp: '0.0.0.0' }],
  env: {
    POSTGRES_USER: 'testuser',
    POSTGRES_PASSWORD: 'testpass123',
    POSTGRES_DB: 'testdb',
  },
  labels: {
    'test.suite': 'e2e',
    'app.type': 'database',
    'app.name': 'postgres',
  },
  volumes: [{ containerPath: '/var/lib/postgresql/data', mode: 'rw' }],
  memory: 512 * 1024 * 1024, // 512MB
  cpus: 1.0,
  restartPolicy: 'unless-stopped',
};

/**
 * MySQL container configuration
 * Alternative database container
 */
export const mysqlContainer: ContainerTestConfig = {
  name: 'test-mysql',
  image: 'mysql',
  tag: '8.0',
  command: 'mysqld',
  ports: [{ hostPort: 3307, containerPort: 3306, protocol: 'tcp', hostIp: '0.0.0.0' }],
  env: {
    MYSQL_ROOT_PASSWORD: 'rootpass123',
    MYSQL_DATABASE: 'testdb',
    MYSQL_USER: 'testuser',
    MYSQL_PASSWORD: 'testpass123',
  },
  labels: {
    'test.suite': 'e2e',
    'app.type': 'database',
    'app.name': 'mysql',
  },
  volumes: [{ containerPath: '/var/lib/mysql', mode: 'rw' }],
  memory: 512 * 1024 * 1024, // 512MB
  cpus: 1.0,
  restartPolicy: 'unless-stopped',
};

/**
 * Node.js container configuration
 * Application runtime container
 */
export const nodeContainer: ContainerTestConfig = {
  name: 'test-node',
  image: 'node',
  tag: '20-alpine',
  command: 'node -e "setInterval(() => console.log(\\"Running...\\"), 5000)"',
  ports: [{ hostPort: 3001, containerPort: 3000, protocol: 'tcp', hostIp: '0.0.0.0' }],
  env: {
    NODE_ENV: 'test',
    PORT: '3000',
  },
  labels: {
    'test.suite': 'e2e',
    'app.type': 'runtime',
    'app.name': 'node',
  },
  memory: 256 * 1024 * 1024, // 256MB
  cpus: 0.5,
};

/**
 * Busybox container configuration
 * Minimal container for quick tests
 */
export const busyboxContainer: ContainerTestConfig = {
  name: 'test-busybox',
  image: 'busybox',
  tag: 'latest',
  command: 'sh -c "echo Started && sleep 3600"',
  labels: {
    'test.suite': 'e2e',
    'app.type': 'minimal',
    'app.name': 'busybox',
  },
  memory: 32 * 1024 * 1024, // 32MB
  cpus: 0.1,
};

/**
 * All predefined test containers
 */
export const testContainers: ContainerTestConfig[] = [
  nginxContainer,
  redisContainer,
  alpineContainer,
  postgresContainer,
  mysqlContainer,
  nodeContainer,
  busyboxContainer,
];

/**
 * Get container config by name
 */
export function getContainerByName(name: string): ContainerTestConfig | undefined {
  return testContainers.find((c) => c.name === name);
}

/**
 * Get containers by type label
 */
export function getContainersByType(type: string): ContainerTestConfig[] {
  return testContainers.filter((c) => c.labels?.['app.type'] === type);
}

/**
 * Generate a unique container name
 */
export function generateContainerName(baseName: string): string {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 10000);
  return `${baseName}-${timestamp}-${random}`;
}

/**
 * Create a custom container configuration
 */
export function createContainerConfig(
  overrides: Partial<ContainerTestConfig> & { name: string; image: string }
): ContainerTestConfig {
  return {
    tag: 'latest',
    labels: { 'test.suite': 'e2e' },
    restartPolicy: 'no',
    ...overrides,
  };
}

/**
 * Expected container states
 */
export const expectedStates = {
  CREATED: 'created',
  RUNNING: 'running',
  PAUSED: 'paused',
  RESTARTING: 'restarting',
  REMOVING: 'removing',
  EXITED: 'exited',
  DEAD: 'dead',
} as const;

export type ExpectedState = (typeof expectedStates)[keyof typeof expectedStates];

/**
 * Container status mapping
 */
export const containerStatusMap: Record<string, string> = {
  created: 'Created',
  running: 'Up',
  paused: 'Paused',
  restarting: 'Restarting',
  removing: 'Removal In Progress',
  exited: 'Exited',
  dead: 'Dead',
};

/**
 * Get human-readable status from state
 */
export function getStatusFromState(state: string): string {
  return containerStatusMap[state] || state;
}

/**
 * Mock container for testing (used when Docker is not available)
 */
export function createMockContainer(
  config: ContainerTestConfig,
  overrides: Partial<Container> = {}
): Container {
  const now = Date.now();

  return {
    id: `mock-${config.name}-${now}`,
    name: config.name,
    image: `${config.image}:${config.tag || 'latest'}`,
    status: 'running',
    state: 'running',
    created: now,
    ports:
      config.ports?.map((p) => ({
        containerPort: p.containerPort,
        hostPort: p.hostPort,
        hostIp: p.hostIp || '0.0.0.0',
        protocol: p.protocol || 'tcp',
      })) || [],
    labels: config.labels || {},
    networks: config.networks || ['bridge'],
    command: config.command || '',
    env: config.env || {},
    mounts:
      config.volumes?.map((v) => ({
        source: v.hostPath || 'anonymous',
        destination: v.containerPath,
        mode: v.mode || 'rw',
      })) || [],
    ...overrides,
  };
}

/**
 * Container cleanup helper
 */
export interface ContainerCleanupResult {
  deleted: string[];
  failed: Array<{ id: string; error: string }>;
}

/**
 * Health check configuration for containers
 */
export interface HealthCheckConfig {
  test: string[];
  interval: number;
  timeout: number;
  retries: number;
  startPeriod: number;
}

/**
 * Add health check to container config
 */
export function withHealthCheck(
  config: ContainerTestConfig,
  healthCheck: HealthCheckConfig
): ContainerTestConfig {
  return {
    ...config,
    labels: {
      ...config.labels,
      'health.check.enabled': 'true',
    },
  };
}

/**
 * Common health checks
 */
export const healthChecks = {
  http: (path: string = '/', port: number = 80): HealthCheckConfig => ({
    test: ['CMD', 'wget', '--quiet', '--tries=1', '--spider', `http://localhost:${port}${path}`],
    interval: 30000000000, // 30s in nanoseconds
    timeout: 10000000000, // 10s
    retries: 3,
    startPeriod: 5000000000, // 5s
  }),

  redis: (): HealthCheckConfig => ({
    test: ['CMD', 'redis-cli', 'ping'],
    interval: 30000000000,
    timeout: 10000000000,
    retries: 3,
    startPeriod: 5000000000,
  }),

  postgres: (): HealthCheckConfig => ({
    test: ['CMD-SHELL', 'pg_isready -U postgres'],
    interval: 30000000000,
    timeout: 10000000000,
    retries: 3,
    startPeriod: 10000000000, // 10s for DB startup
  }),
};

export default {
  nginxContainer,
  redisContainer,
  alpineContainer,
  postgresContainer,
  mysqlContainer,
  nodeContainer,
  busyboxContainer,
  testContainers,
  getContainerByName,
  getContainersByType,
  generateContainerName,
  createContainerConfig,
  expectedStates,
  containerStatusMap,
  getStatusFromState,
  createMockContainer,
  withHealthCheck,
  healthChecks,
};
