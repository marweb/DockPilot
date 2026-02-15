// User and Auth Types
export type UserRole = 'admin' | 'operator' | 'viewer';

export interface User {
  id: string;
  username: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  user: User;
  tokens: AuthTokens;
}

export interface SetupRequest {
  username: string;
  password: string;
}

// Container Types
export type ContainerStatus =
  | 'created'
  | 'running'
  | 'paused'
  | 'restarting'
  | 'removing'
  | 'exited'
  | 'dead';

export interface Container {
  id: string;
  name: string;
  image: string;
  status: ContainerStatus;
  state: string;
  created: number;
  ports: PortMapping[];
  labels: Record<string, string>;
  networks: string[];
  command?: string;
  entrypoint?: string[];
  env?: string[];
}

export interface PortMapping {
  containerPort: number;
  hostPort?: number;
  hostIp?: string;
  protocol: 'tcp' | 'udp';
}

export interface ContainerStats {
  id: string;
  name: string;
  cpuPercent: number;
  memoryUsage: number;
  memoryLimit: number;
  memoryPercent: number;
  networkRx: number;
  networkTx: number;
  blockRead: number;
  blockWrite: number;
}

export interface ContainerInspect {
  id: string;
  created: string;
  path: string;
  args: string[];
  state: {
    status: string;
    running: boolean;
    paused: boolean;
    restarting: boolean;
    oomKilled: boolean;
    dead: boolean;
    pid: number;
    exitCode: number;
    error: string;
    startedAt: string;
    finishedAt: string;
  };
  image: string;
  networkSettings: Record<string, unknown>;
  mounts: Array<{
    type: string;
    name?: string;
    source: string;
    destination: string;
    mode: string;
    rw: boolean;
  }>;
  config: {
    hostname: string;
    domainname: string;
    user: string;
    attachStdin: boolean;
    attachStdout: boolean;
    attachStderr: boolean;
    exposedPorts?: Record<string, unknown>;
    tty: boolean;
    openStdin: boolean;
    stdinOnce: boolean;
    env?: string[];
    cmd?: string[];
    image: string;
    workingDir: string;
    labels: Record<string, string>;
  };
}

export interface ContainerCreateOptions {
  name?: string;
  image: string;
  env?: string[];
  ports?: PortMapping[];
  volumes?: VolumeMount[];
  networks?: string[];
  command?: string[];
  labels?: Record<string, string>;
}

export interface VolumeMount {
  type: 'bind' | 'volume' | 'tmpfs';
  source: string;
  target: string;
  readOnly?: boolean;
}

// Image Types
export interface Image {
  id: string;
  repository: string;
  tag: string;
  size: number;
  created: number;
  labels: Record<string, string>;
  containers: number;
}

export interface ImageInspect {
  id: string;
  repoTags: string[];
  repoDigests: string[];
  created: string;
  size: number;
  virtualSize: number;
  architecture: string;
  os: string;
  author: string;
  config: {
    hostname: string;
    domainname: string;
    user: string;
    attachStdin: boolean;
    attachStdout: boolean;
    attachStderr: boolean;
    exposedPorts?: Record<string, unknown>;
    tty: boolean;
    openStdin: boolean;
    stdinOnce: boolean;
    env?: string[];
    cmd?: string[];
    image: string;
    workingDir: string;
    labels: Record<string, string>;
  };
  rootFS: {
    type: string;
    layers: string[];
  };
}

export interface ImageHistory {
  id: string;
  created: number;
  createdBy: string;
  size: number;
  comment: string;
}

export interface ImagePullOptions {
  fromImage: string;
  tag?: string;
  platform?: string;
}

// Volume Types
export interface Volume {
  name: string;
  driver: string;
  mountpoint: string;
  createdAt?: string;
  labels: Record<string, string>;
  scope: 'local' | 'global';
  options?: Record<string, string>;
  usageData?: {
    size: number;
    refCount: number;
  };
}

export interface VolumeInspect {
  name: string;
  driver: string;
  mountpoint: string;
  createdAt?: string;
  labels: Record<string, string>;
  scope: 'local' | 'global';
  options?: Record<string, string>;
  status?: Record<string, unknown>;
  usageData?: {
    size: number;
    refCount: number;
  };
}

// Network Types
export interface Network {
  id: string;
  name: string;
  driver: string;
  scope: 'local' | 'swarm';
  subnet?: string;
  gateway?: string;
  ipam: {
    driver: string;
    config: Array<{
      subnet: string;
      gateway?: string;
    }>;
  };
  containers?: Record<
    string,
    {
      name: string;
      endpointId: string;
      macAddress: string;
      ipv4Address: string;
      ipv6Address: string;
    }
  >;
  labels: Record<string, string>;
}

export interface NetworkCreateOptions {
  name: string;
  driver?: string;
  subnet?: string;
  gateway?: string;
  labels?: Record<string, string>;
}

// Build Types
export interface BuildOptions {
  context: string;
  dockerfile?: string;
  tags: string[];
  buildArgs?: Record<string, string>;
  target?: string;
  platform?: string;
  noCache?: boolean;
  pull?: boolean;
}

export interface BuildProgress {
  id: string;
  status: 'building' | 'success' | 'error';
  step?: string;
  message?: string;
  error?: string;
  progress?: number;
}

// Compose Types
export interface ComposeStack {
  name: string;
  projectDir: string;
  status: 'running' | 'stopped' | 'partial';
  services: ComposeService[];
  createdAt?: Date;
}

export interface ComposeService {
  name: string;
  containerId?: string;
  image: string;
  status: string;
  ports: PortMapping[];
  command?: string;
}

export interface ComposeUpOptions {
  name: string;
  yaml: string;
  detach?: boolean;
  build?: boolean;
  removeOrphans?: boolean;
}

export interface ComposeDownOptions {
  name: string;
  removeVolumes?: boolean;
  removeImages?: boolean;
}

// Tunnel Types
export type TunnelStatus = 'active' | 'inactive' | 'error' | 'creating';

export interface Tunnel {
  id: string;
  name: string;
  accountId: string;
  zoneId?: string;
  status: TunnelStatus;
  createdAt: Date;
  publicUrl?: string;
  ingressRules: IngressRule[];
  connectedServices: string[];
  autoStart?: boolean;
}

export interface IngressRule {
  hostname: string;
  service: string;
  path?: string;
  port: number;
}

export interface TunnelCreateOptions {
  name: string;
  zoneId?: string;
}

export interface TunnelCredentials {
  tunnelId: string;
  accountId: string;
  tunnelSecret: string;
}

// System Types
export interface DockerInfo {
  id: string;
  containers: number;
  containersRunning: number;
  containersStopped: number;
  containersPaused: number;
  images: number;
  driver: string;
  driverStatus: Array<[string, string]>;
  dockerRootDir: string;
  operatingSystem: string;
  architecture: string;
  cpus: number;
  memoryLimit: boolean;
  swapLimit: boolean;
  kernelVersion: string;
  kernelMemory: boolean;
  osType: string;
  os: string;
  name: string;
  serverVersion: string;
}

export interface DockerVersion {
  version: string;
  apiVersion: string;
  gitCommit: string;
  goVersion: string;
  os: string;
  arch: string;
  buildTime: string;
}

export interface DiskUsage {
  layersSize: number;
  images: Array<{
    id: string;
    size: number;
    sharedSize: number;
    virtualSize: number;
  }>;
  containers: Array<{
    id: string;
    sizeRw: number;
    sizeRootFs: number;
  }>;
  volumes: Array<{
    name: string;
    size: number;
  }>;
}

// Audit Log Types
export type AuditAction =
  | 'container.start'
  | 'container.stop'
  | 'container.restart'
  | 'container.kill'
  | 'container.remove'
  | 'container.create'
  | 'image.pull'
  | 'image.remove'
  | 'volume.remove'
  | 'network.remove'
  | 'build.execute'
  | 'compose.up'
  | 'compose.down'
  | 'tunnel.create'
  | 'tunnel.delete'
  | 'tunnel.start'
  | 'tunnel.stop'
  | 'user.create'
  | 'user.update'
  | 'user.delete'
  | 'auth.login'
  | 'auth.logout';

export interface AuditLog {
  id: string;
  timestamp: Date;
  userId: string;
  username: string;
  action: AuditAction;
  resource: string;
  resourceId?: string;
  details?: Record<string, unknown>;
  ip: string;
  userAgent: string;
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// WebSocket Message Types
export type WebSocketMessageType =
  | 'container.logs'
  | 'container.stats'
  | 'container.exec'
  | 'build.progress'
  | 'docker.events';

export interface WebSocketMessage<T = unknown> {
  type: WebSocketMessageType;
  payload: T;
  timestamp: number;
}

// Error Types
export interface ApiError {
  code: string;
  message: string;
  statusCode: number;
  details?: unknown;
}

export const ErrorCodes = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  BAD_REQUEST: 'BAD_REQUEST',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  DOCKER_ERROR: 'DOCKER_ERROR',
  TUNNEL_ERROR: 'TUNNEL_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

// ============================================================================
// SYSTEM SETTINGS TYPES (DP-004)
// ============================================================================

import { z } from 'zod';

/**
 * System configuration settings
 * Represents the global configuration of the DockPilot instance
 */
export interface SystemSettings {
  /** Unique name for this DockPilot instance */
  instanceName: string;
  /** Public URL where the instance is accessible */
  publicUrl: string;
  /** Timezone for the instance (e.g., 'America/New_York') */
  timezone: string;
  /** Public IPv4 address */
  publicIPv4: string;
  /** Public IPv6 address */
  publicIPv6: string;
  /** Whether automatic updates are enabled */
  autoUpdate: boolean;
  /** ISO 8601 timestamp of last update */
  updatedAt: string;
}

/**
 * Input type for creating or updating system settings
 * All fields are optional except updatedAt which is managed by the system
 */
export type SystemSettingsInput = Partial<Omit<SystemSettings, 'updatedAt'>>;

/**
 * API response for system settings operations
 */
export interface SystemSettingsResponse {
  success: boolean;
  data: SystemSettings;
}

// ============================================================================
// NOTIFICATION TYPES (DP-004)
// ============================================================================

/**
 * Supported notification providers
 */
export type NotificationProvider = 'smtp' | 'resend' | 'slack' | 'telegram' | 'discord';

/**
 * Base interface for all notification channels
 */
export interface NotificationChannelBase {
  /** Unique identifier */
  id?: string;
  /** Provider type */
  provider: NotificationProvider;
  /** Display name for the channel */
  name: string;
  /** Whether the channel is enabled */
  enabled: boolean;
  /** Sender name for email providers */
  fromName?: string;
  /** Sender address for email providers */
  fromAddress?: string;
  /** ISO 8601 timestamp of creation */
  createdAt?: string;
  /** ISO 8601 timestamp of last update */
  updatedAt?: string;
}

/**
 * SMTP email configuration
 * Note: Password field is encrypted at rest
 */
export interface SMTPConfig extends NotificationChannelBase {
  provider: 'smtp';
  /** SMTP server hostname */
  host: string;
  /** SMTP server port */
  port: number;
  /** SMTP username */
  username: string;
  /** SMTP password (encrypted) */
  password: string;
  /** Encryption method */
  encryption: 'none' | 'ssl' | 'tls' | 'starttls';
  /** Connection timeout in seconds */
  timeout?: number;
}

/**
 * Resend email service configuration
 * Note: API key is encrypted at rest
 */
export interface ResendConfig extends NotificationChannelBase {
  provider: 'resend';
  /** Resend API key (encrypted) */
  apiKey: string;
}

/**
 * Slack webhook configuration
 * Note: Webhook URL is encrypted at rest
 */
export interface SlackConfig extends NotificationChannelBase {
  provider: 'slack';
  /** Slack incoming webhook URL (encrypted) */
  webhookUrl: string;
}

/**
 * Telegram bot configuration
 * Note: Bot token is encrypted at rest
 */
export interface TelegramConfig extends NotificationChannelBase {
  provider: 'telegram';
  /** Telegram bot token (encrypted) */
  botToken: string;
  /** Telegram chat ID */
  chatId: string;
}

/**
 * Discord webhook configuration
 * Note: Webhook URL is encrypted at rest
 */
export interface DiscordConfig extends NotificationChannelBase {
  provider: 'discord';
  /** Discord webhook URL (encrypted) */
  webhookUrl: string;
}

/**
 * Union type for all notification channel configurations
 */
export type NotificationChannel =
  | SMTPConfig
  | ResendConfig
  | SlackConfig
  | TelegramConfig
  | DiscordConfig;

// ============================================================================
// NOTIFICATION API TYPES (DP-004)
// ============================================================================

/**
 * Payload for saving notification channel configuration
 * Used when creating or updating a channel via API
 * Sensitive fields (passwords, tokens, keys) will be encrypted before storage
 */
export interface SaveNotificationChannelInput {
  provider: NotificationProvider;
  name: string;
  enabled: boolean;
  fromName?: string;
  fromAddress?: string;
  config: {
    // SMTP fields
    host?: string;
    port?: number;
    username?: string;
    password?: string;
    encryption?: 'none' | 'ssl' | 'tls' | 'starttls';
    timeout?: number;
    // Resend fields
    apiKey?: string;
    // Slack/Discord fields
    webhookUrl?: string;
    // Telegram fields
    botToken?: string;
    chatId?: string;
  };
}

/**
 * API response for notification channel queries
 * Sensitive configuration data is masked/omitted for security
 */
export interface NotificationChannelResponse extends NotificationChannelBase {
  /** Whether the channel has been configured with credentials */
  configured: boolean;
  /** Masked configuration data - no sensitive fields exposed */
  config?: {
    /** SMTP server hostname */
    host?: string;
    /** SMTP server port */
    port?: number;
    /** SMTP username (masked) */
    username?: string;
    /** Encryption method */
    encryption?: string;
    /** Connection timeout */
    timeout?: number;
    /** Sender address */
    fromAddress?: string;
    /** Sender name */
    fromName?: string;
  };
}

/**
 * API response for notification configuration list
 */
export interface NotificationConfigResponse {
  success: boolean;
  data: {
    channels: NotificationChannelResponse[];
  };
}

// ============================================================================
// NOTIFICATION TEST TYPES (DP-004)
// ============================================================================

/**
 * Input for sending test notifications
 */
export interface SendTestNotificationInput {
  /** Provider to test */
  provider: NotificationProvider;
  /** Target email address (for email providers) */
  testEmail?: string;
  /** Custom test message (optional) */
  testMessage?: string;
}

/**
 * Response from test notification attempt
 */
export interface SendTestNotificationResponse {
  success: boolean;
  message: string;
  /** Error details if the test failed */
  error?: string;
}

// ============================================================================
// NOTIFICATION EVENT TYPES (DP-004)
// ============================================================================

/**
 * Available notification event types
 * Used to subscribe to specific system events
 */
export type NotificationEventType =
  | 'auth.login.failed'
  | 'auth.login.success'
  | 'system.upgrade.completed'
  | 'system.upgrade.failed'
  | 'repo.deploy.success'
  | 'repo.deploy.failed'
  | 'container.crash';

/**
 * Notification severity levels
 */
export type NotificationSeverity = 'info' | 'warning' | 'critical';

/**
 * Configuration for a notification event subscription
 * Defines which events trigger notifications and through which channels
 */
export interface NotificationEventConfig {
  /** Event type identifier */
  eventType: NotificationEventType;
  /** Whether notifications are enabled for this event */
  enabled: boolean;
  /** List of providers to use for this event */
  channels: NotificationProvider[];
  /** Minimum severity level to trigger notification */
  minSeverity: NotificationSeverity;
}

// ============================================================================
// ZOD VALIDATION SCHEMAS (DP-004)
// ============================================================================

/**
 * Zod schema for validating system settings
 */
export const systemSettingsSchema = z.object({
  instanceName: z.string().min(1).max(100).describe('Unique name for this DockPilot instance'),
  publicUrl: z.string().url().describe('Public URL where the instance is accessible'),
  timezone: z.string().min(1).describe('Timezone for the instance (e.g., America/New_York)'),
  publicIPv4: z.string().ip({ version: 'v4' }).describe('Public IPv4 address'),
  publicIPv6: z.string().ip({ version: 'v6' }).describe('Public IPv6 address'),
  autoUpdate: z.boolean().describe('Whether automatic updates are enabled'),
  updatedAt: z.string().datetime().describe('ISO 8601 timestamp of last update'),
});

/**
 * Type derived from systemSettingsSchema
 */
export type SystemSettingsValidated = z.infer<typeof systemSettingsSchema>;

/**
 * Zod schema for validating save notification channel input
 */
export const saveNotificationChannelSchema = z
  .object({
    provider: z.enum(['smtp', 'resend', 'slack', 'telegram', 'discord']),
    name: z.string().min(1).max(100),
    enabled: z.boolean(),
    fromName: z.string().max(100).optional(),
    fromAddress: z.string().email().optional(),
    config: z.object({
      // SMTP
      host: z.string().optional(),
      port: z.number().int().min(1).max(65535).optional(),
      username: z.string().optional(),
      password: z.string().optional(),
      encryption: z.enum(['none', 'ssl', 'tls', 'starttls']).optional(),
      timeout: z.number().int().min(1).max(300).optional(),
      // Resend
      apiKey: z.string().optional(),
      // Slack/Discord
      webhookUrl: z.string().url().optional(),
      // Telegram
      botToken: z.string().optional(),
      chatId: z.string().optional(),
    }),
  })
  .refine(
    (data: {
      provider: NotificationProvider;
      config: {
        host?: string;
        port?: number;
        username?: string;
        password?: string;
        apiKey?: string;
        webhookUrl?: string;
        botToken?: string;
        chatId?: string;
      };
    }) => {
      // Provider-specific validation
      switch (data.provider) {
        case 'smtp':
          return !!(
            data.config.host &&
            data.config.port &&
            data.config.username &&
            data.config.password
          );
        case 'resend':
          return !!data.config.apiKey;
        case 'slack':
          return !!data.config.webhookUrl;
        case 'telegram':
          return !!(data.config.botToken && data.config.chatId);
        case 'discord':
          return !!data.config.webhookUrl;
        default:
          return false;
      }
    },
    {
      message: 'Missing required fields for the selected provider',
    }
  );

/**
 * Type derived from saveNotificationChannelSchema
 */
export type SaveNotificationChannelInputValidated = z.infer<typeof saveNotificationChannelSchema>;

/**
 * Zod schema for validating test notification input
 */
export const sendTestNotificationSchema = z
  .object({
    provider: z.enum(['smtp', 'resend', 'slack', 'telegram', 'discord']),
    testEmail: z.string().email().optional(),
    testMessage: z.string().max(500).optional(),
  })
  .refine(
    (data: { provider: NotificationProvider; testEmail?: string }) => {
      // Email providers require testEmail
      if (data.provider === 'smtp' || data.provider === 'resend') {
        return !!data.testEmail;
      }
      return true;
    },
    {
      message: 'testEmail is required for email providers (smtp, resend)',
      path: ['testEmail'],
    }
  );

/**
 * Type derived from sendTestNotificationSchema
 */
export type SendTestNotificationInputValidated = z.infer<typeof sendTestNotificationSchema>;

/**
 * Zod schema for validating notification event configuration
 */
export const notificationEventConfigSchema = z.object({
  eventType: z.enum([
    'auth.login.failed',
    'auth.login.success',
    'system.upgrade.completed',
    'system.upgrade.failed',
    'repo.deploy.success',
    'repo.deploy.failed',
    'container.crash',
  ]),
  enabled: z.boolean(),
  channels: z.array(z.enum(['smtp', 'resend', 'slack', 'telegram', 'discord'])).min(1),
  minSeverity: z.enum(['info', 'warning', 'critical']),
});

/**
 * Type derived from notificationEventConfigSchema
 */
export type NotificationEventConfigValidated = z.infer<typeof notificationEventConfigSchema>;
