import { spawn, ChildProcess } from 'child_process';
import { readFile, writeFile, mkdir, rm, readdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import EventEmitter from 'events';
import type { Config } from '../config/index.js';
import type { Tunnel, TunnelStatus, IngressRule } from '@dockpilot/types';
import { getLogger } from '../utils/logger.js';
import {
  createTunnel as createCloudflareTunnel,
  deleteTunnel as deleteCloudflareTunnel,
  getTunnelToken,
  isAuthenticated,
  getCurrentAccountId,
  CloudflareAPIError,
} from './cloudflare-api.js';
import { loadCredentials, getDefaultAccount } from './credentials.js';

const logger = getLogger();

interface TunnelConfig {
  id: string;
  name: string;
  accountId: string;
  zoneId?: string;
  credentialsFile: string;
  ingress: IngressRule[];
  status: TunnelStatus;
  process?: ChildProcess;
  publicUrl?: string;
  logs: string[];
  restartCount: number;
  lastRestartAt?: Date;
  createdAt: Date;
}

interface StoredTunnel {
  id: string;
  name: string;
  accountId: string;
  zoneId?: string;
  credentialsPath: string;
  ingress: IngressRule[];
  createdAt: string;
  cloudflareTunnelId?: string;
}

// Store active tunnels
const tunnels = new Map<string, TunnelConfig>();
const tunnelLogs = new Map<string, string[]>();
const tunnelEmitters = new Map<string, EventEmitter>();

let config: Config;

export function initCloudflared(cfg: Config): void {
  config = cfg;
}

export async function checkCloudflaredInstalled(): Promise<boolean> {
  try {
    const result = await executeCloudflared(['--version']);
    return result.exitCode === 0;
  } catch {
    return false;
  }
}

export async function getCloudflaredVersion(): Promise<string> {
  const result = await executeCloudflared(['--version']);
  if (result.exitCode === 0) {
    const versionMatch = result.stdout.match(/cloudflared version ([\d.]+)/);
    return versionMatch ? versionMatch[1] : 'unknown';
  }
  throw new Error('Failed to get cloudflared version');
}

async function executeCloudflared(
  args: string[],
  cwd?: string
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve) => {
    logger.debug({ args }, 'Executing cloudflared command');

    const proc = spawn(config.cloudflaredPath, args, {
      cwd,
      env: process.env,
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      resolve({
        stdout,
        stderr,
        exitCode: code || 0,
      });
    });
  });
}

async function ensureCredentialsDir(): Promise<void> {
  if (!existsSync(config.credentialsDir)) {
    await mkdir(config.credentialsDir, { recursive: true, mode: 0o700 });
  }
}

export async function listTunnels(): Promise<Tunnel[]> {
  await ensureCredentialsDir();
  await loadStoredTunnels();

  const result: Tunnel[] = [];

  for (const [id, tunnel] of tunnels) {
    result.push({
      id: tunnel.id,
      name: tunnel.name,
      accountId: tunnel.accountId,
      zoneId: tunnel.zoneId,
      status: tunnel.status,
      createdAt: tunnel.createdAt,
      publicUrl: tunnel.publicUrl,
      ingressRules: tunnel.ingress,
      connectedServices: tunnel.ingress.map((i) => i.service),
    });
  }

  return result;
}

export async function getTunnel(id: string): Promise<Tunnel> {
  await loadStoredTunnels();

  const tunnel = tunnels.get(id);
  if (!tunnel) {
    throw new Error('Tunnel not found');
  }

  return {
    id: tunnel.id,
    name: tunnel.name,
    accountId: tunnel.accountId,
    zoneId: tunnel.zoneId,
    status: tunnel.status,
    createdAt: tunnel.createdAt,
    publicUrl: tunnel.publicUrl,
    ingressRules: tunnel.ingress,
    connectedServices: tunnel.ingress.map((i) => i.service),
  };
}

async function loadStoredTunnels(): Promise<void> {
  if (!existsSync(config.credentialsDir)) return;

  const files = await readdir(config.credentialsDir, { withFileTypes: true });

  for (const file of files) {
    if (!file.isDirectory()) continue;
    if (file.name === 'accounts') continue;

    const tunnelDir = path.join(config.credentialsDir, file.name);
    const configFile = path.join(tunnelDir, 'config.json');

    if (!existsSync(configFile)) continue;

    try {
      const content = await readFile(configFile, 'utf-8');
      const stored: StoredTunnel = JSON.parse(content);

      if (!tunnels.has(stored.id)) {
        tunnels.set(stored.id, {
          id: stored.id,
          name: stored.name,
          accountId: stored.accountId,
          zoneId: stored.zoneId,
          credentialsFile: stored.credentialsPath,
          ingress: stored.ingress,
          status: 'inactive',
          logs: [],
          restartCount: 0,
          createdAt: new Date(stored.createdAt),
        });
      }
    } catch (error) {
      logger.warn({ error, tunnelDir }, 'Failed to load stored tunnel config');
    }
  }
}

export async function createTunnel(
  name: string,
  accountId?: string,
  zoneId?: string
): Promise<Tunnel> {
  await ensureCredentialsDir();

  // Check if tunnel with this name already exists
  for (const tunnel of tunnels.values()) {
    if (tunnel.name === name) {
      throw new Error(`Tunnel with name "${name}" already exists`);
    }
  }

  // Get credentials
  let credentials = accountId ? await loadCredentials(accountId) : await getDefaultAccount();

  if (!credentials) {
    throw new Error('No Cloudflare credentials found. Please authenticate first.');
  }

  const useAccountId = accountId || credentials.accountId;

  // Create tunnel using cloudflared CLI
  const tunnelDir = path.join(config.credentialsDir, name);
  await mkdir(tunnelDir, { recursive: true, mode: 0o700 });

  const credentialsFile = path.join(tunnelDir, 'credentials.json');

  try {
    // Execute cloudflared tunnel create
    const result = await executeCloudflared([
      'tunnel',
      '--credentials-file',
      credentialsFile,
      'create',
      name,
    ]);

    if (result.exitCode !== 0) {
      // Check if it's an auth error
      if (result.stderr.includes('not logged in') || result.stderr.includes('authentication')) {
        throw new Error('Not authenticated with Cloudflare. Please login first.');
      }
      throw new Error(`Failed to create tunnel: ${result.stderr || result.stdout}`);
    }

    // Read the generated credentials to get the actual tunnel ID
    let tunnelId: string;
    let cloudflareTunnelId: string;

    try {
      const credsContent = await readFile(credentialsFile, 'utf-8');
      const creds = JSON.parse(credsContent);
      cloudflareTunnelId = creds.TunnelID || creds.tunnelId;
      tunnelId = cloudflareTunnelId;
    } catch {
      // Extract tunnel ID from output as fallback
      const idMatch = result.stdout.match(/Tunnel credentials written to.*?([a-f0-9-]{36})/i);
      tunnelId = idMatch ? idMatch[1] : crypto.randomUUID();
      cloudflareTunnelId = tunnelId;
    }

    // Store tunnel config
    const stored: StoredTunnel = {
      id: tunnelId,
      name,
      accountId: useAccountId,
      zoneId,
      credentialsPath: credentialsFile,
      ingress: [],
      createdAt: new Date().toISOString(),
      cloudflareTunnelId,
    };

    await writeFile(path.join(tunnelDir, 'config.json'), JSON.stringify(stored, null, 2));

    // Add to memory
    const newTunnel: TunnelConfig = {
      id: tunnelId,
      name,
      accountId: useAccountId,
      zoneId,
      credentialsFile,
      ingress: [],
      status: 'inactive',
      logs: [],
      restartCount: 0,
      createdAt: new Date(),
    };

    tunnels.set(tunnelId, newTunnel);
    tunnelLogs.set(tunnelId, []);
    tunnelEmitters.set(tunnelId, new EventEmitter());

    logger.info({ tunnelId, name }, 'Tunnel created successfully');

    return {
      id: tunnelId,
      name,
      accountId: useAccountId,
      zoneId,
      status: 'inactive',
      createdAt: new Date(),
      ingressRules: [],
      connectedServices: [],
    };
  } catch (error) {
    // Cleanup on failure
    if (existsSync(tunnelDir)) {
      await rm(tunnelDir, { recursive: true, force: true });
    }
    throw error;
  }
}

export async function deleteTunnel(id: string): Promise<void> {
  const tunnel = tunnels.get(id);
  if (!tunnel) {
    throw new Error('Tunnel not found');
  }

  logger.info({ tunnelId: id, name: tunnel.name }, 'Deleting tunnel');

  // Stop the tunnel if running
  if (tunnel.status === 'active' && tunnel.process) {
    await stopTunnel(id);
  }

  // Delete from cloudflare
  try {
    await executeCloudflared(['tunnel', 'delete', id]);
  } catch (error) {
    logger.warn(
      { error, tunnelId: id },
      'Failed to delete tunnel from Cloudflare, continuing with local cleanup'
    );
  }

  // Remove local files
  const tunnelDir = path.dirname(tunnel.credentialsFile);
  if (existsSync(tunnelDir)) {
    await rm(tunnelDir, { recursive: true, force: true });
  }

  tunnels.delete(id);
  tunnelLogs.delete(id);
  tunnelEmitters.delete(id);

  logger.info({ tunnelId: id }, 'Tunnel deleted successfully');
}

export async function startTunnel(id: string, restartOnCrash = true): Promise<void> {
  const tunnel = tunnels.get(id);
  if (!tunnel) {
    throw new Error('Tunnel not found');
  }

  if (tunnel.status === 'active') {
    logger.debug({ tunnelId: id }, 'Tunnel already active');
    return;
  }

  if (!existsSync(tunnel.credentialsFile)) {
    throw new Error('Tunnel credentials not found');
  }

  logger.info({ tunnelId: id, name: tunnel.name }, 'Starting tunnel');

  // Create config file for ingress rules
  const tunnelDir = path.dirname(tunnel.credentialsFile);
  const configFile = path.join(tunnelDir, 'config.yml');

  // Generate config YAML
  let configYaml = `tunnel: ${id}\ncredentials-file: ${tunnel.credentialsFile}\n`;

  if (config.metricsPort) {
    configYaml += `metrics: localhost:${config.metricsPort}\n`;
  }

  configYaml += '\ningress:\n';

  if (tunnel.ingress.length > 0) {
    for (const rule of tunnel.ingress) {
      configYaml += `  - hostname: ${rule.hostname}\n`;
      configYaml += `    service: ${rule.service}\n`;
      if (rule.path) {
        configYaml += `    path: ${rule.path}\n`;
      }
    }
  }

  configYaml += '  - service: http_status:404\n';

  await writeFile(configFile, configYaml);

  // Initialize logs array
  if (!tunnelLogs.has(id)) {
    tunnelLogs.set(id, []);
  }
  const logs = tunnelLogs.get(id)!;

  // Start cloudflared
  const args = ['tunnel', '--config', configFile, 'run', id];

  if (config.logLevel === 'debug') {
    args.push('--log-level', 'debug');
  }

  logger.debug({ args }, 'Spawning cloudflared process');

  const proc = spawn(config.cloudflaredPath, args, {
    detached: false,
  });

  tunnel.process = proc;
  tunnel.status = 'active';

  // Handle stdout
  proc.stdout.on('data', (data) => {
    const line = data.toString().trim();
    if (line) {
      logs.push(`[STDOUT] ${new Date().toISOString()} ${line}`);
      // Keep only last 1000 lines
      if (logs.length > 1000) {
        logs.shift();
      }

      // Try to extract public URL
      const urlMatch = line.match(/https:\/\/[^\s]+\.trycloudflare\.com/);
      if (urlMatch && !tunnel.publicUrl) {
        tunnel.publicUrl = urlMatch[0];
        logger.info({ tunnelId: id, publicUrl: urlMatch[0] }, 'Tunnel public URL detected');
      }

      // Emit log event
      const emitter = tunnelEmitters.get(id);
      if (emitter) {
        emitter.emit('log', { type: 'stdout', message: line, timestamp: new Date().toISOString() });
      }
    }
  });

  // Handle stderr
  proc.stderr.on('data', (data) => {
    const line = data.toString().trim();
    if (line) {
      logs.push(`[STDERR] ${new Date().toISOString()} ${line}`);
      if (logs.length > 1000) {
        logs.shift();
      }

      // Check for errors
      if (line.includes('error') || line.includes('ERROR')) {
        logger.error({ tunnelId: id, message: line }, 'Tunnel error');
      }

      // Emit log event
      const emitter = tunnelEmitters.get(id);
      if (emitter) {
        emitter.emit('log', { type: 'stderr', message: line, timestamp: new Date().toISOString() });
      }
    }
  });

  // Handle process exit
  proc.on('exit', (code, signal) => {
    logger.info({ tunnelId: id, exitCode: code, signal }, 'Tunnel process exited');

    tunnel.status = code === 0 ? 'inactive' : 'error';
    tunnel.process = undefined;

    // Auto-restart on crash if enabled
    if (
      restartOnCrash &&
      code !== 0 &&
      signal !== 'SIGTERM' &&
      tunnel.restartCount < config.maxRestarts
    ) {
      tunnel.restartCount++;
      tunnel.lastRestartAt = new Date();

      logger.warn(
        { tunnelId: id, restartCount: tunnel.restartCount, maxRestarts: config.maxRestarts },
        'Tunnel crashed, attempting restart'
      );

      // Wait before restarting
      setTimeout(() => {
        startTunnel(id, restartOnCrash).catch((error) => {
          logger.error({ error, tunnelId: id }, 'Failed to restart tunnel');
        });
      }, config.restartDelay);
    } else if (tunnel.restartCount >= config.maxRestarts) {
      logger.error({ tunnelId: id }, 'Max restarts reached, giving up');
      tunnel.status = 'error';
    }

    // Emit exit event
    const emitter = tunnelEmitters.get(id);
    if (emitter) {
      emitter.emit('exit', { code, signal });
    }
  });

  // Wait a bit to check if process started successfully
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      if (tunnel.status === 'active') {
        resolve();
      } else {
        reject(new Error('Tunnel failed to start within timeout'));
      }
    }, 5000);

    proc.on('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });

    proc.on('exit', (code) => {
      if (code !== 0) {
        clearTimeout(timeout);
        reject(new Error(`Tunnel process exited with code ${code}`));
      }
    });
  });
}

export async function stopTunnel(id: string): Promise<void> {
  const tunnel = tunnels.get(id);
  if (!tunnel) {
    throw new Error('Tunnel not found');
  }

  if (tunnel.status !== 'active' || !tunnel.process) {
    logger.debug({ tunnelId: id }, 'Tunnel not active');
    return;
  }

  logger.info({ tunnelId: id, name: tunnel.name }, 'Stopping tunnel');

  // Reset restart count when manually stopped
  tunnel.restartCount = 0;

  // Send SIGTERM for graceful shutdown
  tunnel.process.kill('SIGTERM');

  // Wait for process to exit
  await new Promise<void>((resolve) => {
    const timeout = setTimeout(() => {
      // Force kill if still running
      if (tunnel.process && !tunnel.process.killed) {
        logger.warn({ tunnelId: id }, 'Force killing tunnel process');
        tunnel.process.kill('SIGKILL');
      }
      resolve();
    }, 10000);

    tunnel.process?.on('exit', () => {
      clearTimeout(timeout);
      resolve();
    });
  });

  tunnel.status = 'inactive';
  tunnel.process = undefined;

  logger.info({ tunnelId: id }, 'Tunnel stopped successfully');
}

export async function getTunnelStatus(
  id: string
): Promise<{ status: TunnelStatus; pid?: number; restartCount: number }> {
  const tunnel = tunnels.get(id);
  if (!tunnel) {
    throw new Error('Tunnel not found');
  }

  return {
    status: tunnel.status,
    pid: tunnel.process?.pid,
    restartCount: tunnel.restartCount,
  };
}

export async function getTunnelLogs(id: string, lines = 100): Promise<string[]> {
  const tunnel = tunnels.get(id);
  if (!tunnel) {
    throw new Error('Tunnel not found');
  }

  const logs = tunnelLogs.get(id) || [];
  return logs.slice(-lines);
}

export async function streamTunnelLogs(
  id: string,
  callback: (log: { type: string; message: string; timestamp: string }) => void
): Promise<() => void> {
  const tunnel = tunnels.get(id);
  if (!tunnel) {
    throw new Error('Tunnel not found');
  }

  let emitter = tunnelEmitters.get(id);
  if (!emitter) {
    emitter = new EventEmitter();
    tunnelEmitters.set(id, emitter);
  }

  const handler = (log: { type: string; message: string; timestamp: string }) => {
    callback(log);
  };

  emitter.on('log', handler);

  // Return cleanup function
  return () => {
    emitter?.off('log', handler);
  };
}

export async function updateIngressRules(id: string, ingress: IngressRule[]): Promise<void> {
  const tunnel = tunnels.get(id);
  if (!tunnel) {
    throw new Error('Tunnel not found');
  }

  logger.info({ tunnelId: id, rulesCount: ingress.length }, 'Updating ingress rules');

  tunnel.ingress = ingress;

  // Update stored config
  const tunnelDir = path.dirname(tunnel.credentialsFile);
  const configFile = path.join(tunnelDir, 'config.json');

  const stored: StoredTunnel = {
    id: tunnel.id,
    name: tunnel.name,
    accountId: tunnel.accountId,
    zoneId: tunnel.zoneId,
    credentialsPath: tunnel.credentialsFile,
    ingress,
    createdAt: tunnel.createdAt.toISOString(),
  };

  await writeFile(configFile, JSON.stringify(stored, null, 2));

  // If tunnel is running, restart it to apply new config
  if (tunnel.status === 'active') {
    logger.info({ tunnelId: id }, 'Restarting tunnel to apply new ingress rules');
    await stopTunnel(id);
    await startTunnel(id);
  }
}

export async function getIngressRules(id: string): Promise<IngressRule[]> {
  const tunnel = tunnels.get(id);
  if (!tunnel) {
    throw new Error('Tunnel not found');
  }

  return tunnel.ingress;
}

export async function deleteIngressRule(id: string, hostname: string): Promise<void> {
  const tunnel = tunnels.get(id);
  if (!tunnel) {
    throw new Error('Tunnel not found');
  }

  const initialLength = tunnel.ingress.length;
  tunnel.ingress = tunnel.ingress.filter((rule) => rule.hostname !== hostname);

  if (tunnel.ingress.length === initialLength) {
    throw new Error(`Ingress rule for hostname "${hostname}" not found`);
  }

  // Update stored config
  const tunnelDir = path.dirname(tunnel.credentialsFile);
  const configFile = path.join(tunnelDir, 'config.json');

  const stored: StoredTunnel = {
    id: tunnel.id,
    name: tunnel.name,
    accountId: tunnel.accountId,
    zoneId: tunnel.zoneId,
    credentialsPath: tunnel.credentialsFile,
    ingress: tunnel.ingress,
    createdAt: tunnel.createdAt.toISOString(),
  };

  await writeFile(configFile, JSON.stringify(stored, null, 2));

  // If tunnel is running, restart it
  if (tunnel.status === 'active') {
    await stopTunnel(id);
    await startTunnel(id);
  }

  logger.info({ tunnelId: id, hostname }, 'Ingress rule deleted');
}

export async function listActiveTunnels(): Promise<string[]> {
  const active: string[] = [];
  for (const [id, tunnel] of tunnels) {
    if (tunnel.status === 'active') {
      active.push(id);
    }
  }
  return active;
}

export async function loginWithCloudflare(): Promise<{ url: string }> {
  // Start cloudflared login process
  const result = await executeCloudflared(['tunnel', 'login']);

  if (result.exitCode !== 0) {
    throw new Error(`Login failed: ${result.stderr || result.stdout}`);
  }

  // Extract URL from output
  const urlMatch = result.stdout.match(/(https:\/\/dash\.cloudflare\.com\/[^\s]+)/);
  if (urlMatch) {
    return { url: urlMatch[1] };
  }

  throw new Error('Failed to get login URL from cloudflared output');
}

export async function checkAuthStatus(): Promise<{
  authenticated: boolean;
  accountId?: string;
  accountName?: string;
}> {
  try {
    const result = await executeCloudflared(['tunnel', 'list']);
    if (result.exitCode === 0) {
      // Try to extract account info from output
      const accountMatch = result.stdout.match(/Account\s+([a-f0-9-]+)/i);
      return {
        authenticated: true,
        accountId: accountMatch ? accountMatch[1] : undefined,
      };
    }
    return { authenticated: false };
  } catch (error) {
    return { authenticated: false };
  }
}

export async function logout(): Promise<void> {
  // Stop all active tunnels first
  const active = await listActiveTunnels();
  for (const id of active) {
    try {
      await stopTunnel(id);
    } catch (error) {
      logger.warn({ error, tunnelId: id }, 'Failed to stop tunnel during logout');
    }
  }

  // Execute cloudflared logout
  await executeCloudflared(['tunnel', 'logout']);

  logger.info('Cloudflare logout completed');
}

export async function getTunnelMetrics(id: string): Promise<Record<string, unknown> | null> {
  const tunnel = tunnels.get(id);
  if (!tunnel || tunnel.status !== 'active') {
    return null;
  }

  if (!config.metricsPort) {
    return null;
  }

  try {
    const response = await fetch(`http://localhost:${config.metricsPort}/metrics`);
    if (response.ok) {
      const metrics = await response.text();
      return parseMetrics(metrics);
    }
  } catch (error) {
    logger.debug({ error, tunnelId: id }, 'Failed to fetch tunnel metrics');
  }

  return null;
}

function parseMetrics(metricsText: string): Record<string, unknown> {
  const metrics: Record<string, unknown> = {};

  for (const line of metricsText.split('\n')) {
    if (line.startsWith('#') || !line.trim()) continue;

    const match = line.match(/^(\w+).*\s([\d.]+)$/);
    if (match) {
      metrics[match[1]] = parseFloat(match[2]);
    }
  }

  return metrics;
}

// Cleanup on process exit
process.on('SIGINT', async () => {
  logger.info('Received SIGINT, stopping all tunnels...');
  for (const [id, tunnel] of tunnels) {
    if (tunnel.status === 'active') {
      await stopTunnel(id);
    }
  }
});

process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM, stopping all tunnels...');
  for (const [id, tunnel] of tunnels) {
    if (tunnel.status === 'active') {
      await stopTunnel(id);
    }
  }
});
