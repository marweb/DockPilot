import type { User, Container, Image, Tunnel, UserRole } from '@dockpilot/types';

// Users fixtures
export const mockUsers: User[] = [
  {
    id: 'user-1',
    username: 'admin',
    role: 'admin' as UserRole,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
  {
    id: 'user-2',
    username: 'operator',
    role: 'operator' as UserRole,
    createdAt: new Date('2024-01-02'),
    updatedAt: new Date('2024-01-02'),
  },
  {
    id: 'user-3',
    username: 'viewer',
    role: 'viewer' as UserRole,
    createdAt: new Date('2024-01-03'),
    updatedAt: new Date('2024-01-03'),
  },
];

// Admin user with password
export const mockAdminUser = {
  ...mockUsers[0],
  passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$c29tZXNhbHRzb21lc2FsdA$hash',
  refreshToken: 'valid-refresh-token',
};

// Tokens fixtures
export const mockTokens = {
  accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.mock-access-token',
  refreshToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.mock-refresh-token',
  expiresIn: 900,
};

// Containers fixtures
export const mockContainers: Container[] = [
  {
    id: 'container-1',
    name: 'nginx-container',
    image: 'nginx:latest',
    status: 'running',
    state: 'running',
    created: Date.now() - 86400000,
    ports: [
      {
        containerPort: 80,
        hostPort: 8080,
        hostIp: '0.0.0.0',
        protocol: 'tcp',
      },
    ],
    labels: {
      app: 'nginx',
      env: 'production',
    },
    networks: ['bridge'],
    command: 'nginx -g daemon off;',
  },
  {
    id: 'container-2',
    name: 'redis-container',
    image: 'redis:alpine',
    status: 'exited',
    state: 'exited',
    created: Date.now() - 172800000,
    ports: [
      {
        containerPort: 6379,
        hostPort: 6379,
        hostIp: '0.0.0.0',
        protocol: 'tcp',
      },
    ],
    labels: {
      app: 'redis',
    },
    networks: ['bridge'],
    command: 'redis-server',
  },
  {
    id: 'container-3',
    name: 'postgres-container',
    image: 'postgres:15',
    status: 'running',
    state: 'running',
    created: Date.now() - 259200000,
    ports: [
      {
        containerPort: 5432,
        hostPort: 5432,
        hostIp: '0.0.0.0',
        protocol: 'tcp',
      },
    ],
    labels: {},
    networks: ['bridge', 'backend'],
    command: 'postgres',
  },
];

// Images fixtures
export const mockImages: Image[] = [
  {
    id: 'image-1',
    repository: 'nginx',
    tag: 'latest',
    size: 142000000,
    created: Date.now() - 604800000,
    labels: {},
    containers: 1,
  },
  {
    id: 'image-2',
    repository: 'redis',
    tag: 'alpine',
    size: 32000000,
    created: Date.now() - 1209600000,
    labels: {},
    containers: 0,
  },
  {
    id: 'image-3',
    repository: 'postgres',
    tag: '15',
    size: 378000000,
    created: Date.now() - 1814400000,
    labels: {},
    containers: 1,
  },
];

// Tunnels fixtures
export const mockTunnels: Tunnel[] = [
  {
    id: 'tunnel-1',
    name: 'web-tunnel',
    accountId: 'account-123',
    zoneId: 'zone-456',
    status: 'active',
    createdAt: new Date('2024-01-15'),
    publicUrl: 'https://web-tunnel.trycloudflare.com',
    ingressRules: [
      {
        hostname: 'app.example.com',
        service: 'http://localhost',
        port: 3000,
      },
    ],
    connectedServices: ['http://localhost:3000'],
  },
  {
    id: 'tunnel-2',
    name: 'api-tunnel',
    accountId: 'account-123',
    status: 'inactive',
    createdAt: new Date('2024-01-16'),
    ingressRules: [],
    connectedServices: [],
  },
];

// Docker Info fixture
export const mockDockerInfo = {
  ID: 'docker-id-123',
  Containers: 3,
  ContainersRunning: 2,
  ContainersPaused: 0,
  ContainersStopped: 1,
  Images: 5,
  Driver: 'overlay2',
  DriverStatus: [],
  SystemStatus: null,
  Plugins: {
    Volume: ['local'],
    Network: ['bridge', 'host', 'none'],
  },
  MemoryLimit: true,
  SwapLimit: true,
  KernelMemory: true,
  CpuCfsPeriod: true,
  CpuCfsQuota: true,
  CPUShares: true,
  CPUSet: true,
  PidsLimit: true,
  IPv4Forwarding: true,
  BridgeNfIptables: true,
  BridgeNfIp6tables: true,
  Debug: false,
  NFd: 30,
  OomKillDisable: true,
  NGoroutines: 50,
  SystemTime: new Date().toISOString(),
  LoggingDriver: 'json-file',
  CgroupDriver: 'systemd',
  CgroupVersion: '2',
  NEventsListener: 0,
  KernelVersion: '5.15.0',
  OperatingSystem: 'Ubuntu 22.04',
  OSVersion: '22.04',
  OSType: 'linux',
  Architecture: 'x86_64',
  IndexServerAddress: 'https://index.docker.io/v1/',
  RegistryConfig: {},
  NCPU: 8,
  MemTotal: 16777216000,
  GenericResources: null,
  DockerRootDir: '/var/lib/docker',
  HttpProxy: '',
  HttpsProxy: '',
  NoProxy: '',
  Name: 'docker-host',
  Labels: [],
  ExperimentalBuild: false,
  ServerVersion: '24.0.7',
  ClusterStore: '',
  ClusterAdvertise: '',
  Runtimes: {
    runc: {
      path: 'runc',
    },
  },
  DefaultRuntime: 'runc',
  Swarm: {
    NodeID: '',
    NodeAddr: '',
    LocalNodeState: 'inactive',
    ControlAvailable: false,
    Error: '',
    RemoteManagers: null,
  },
  LiveRestoreEnabled: false,
  Isolation: '',
  InitBinary: 'docker-init',
  ContainerdCommit: {
    ID: '',
    Expected: '',
  },
  RuncCommit: {
    ID: '',
    Expected: '',
  },
  InitCommit: {
    ID: '',
    Expected: '',
  },
  SecurityOptions: ['name=seccomp,profile=default'],
  ProductLicense: '',
  DefaultAddressPools: null,
  Warnings: null,
};

// API Response fixtures
export const createApiResponse = <T>(data: T, success = true) => ({
  success,
  data,
});

export const createApiError = (error: string, code = 'ERROR') => ({
  success: false,
  error: {
    code,
    message: error,
  },
});
