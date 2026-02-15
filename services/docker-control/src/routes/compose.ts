import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { spawn } from 'child_process';
import { createHash } from 'crypto';
import { mkdir, writeFile, rm, readdir, readFile, stat, appendFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { getDocker } from '../services/docker.js';
import type { ComposeStack, ComposeService } from '@dockpilot/types';

// Schemas
const composeUpBody = z.object({
  name: z.string(),
  yaml: z.string(),
  env: z.record(z.string()).optional(),
  preflightFingerprint: z.string().optional(),
  detach: z.boolean().default(true),
  build: z.boolean().default(false),
  removeOrphans: z.boolean().default(false),
});

const composeDownBody = z.object({
  name: z.string(),
  removeVolumes: z.boolean().default(false),
  removeImages: z.boolean().default(false),
});

const validateComposeBody = z.object({
  yaml: z.string(),
});

const validateNameBody = z.object({
  name: z.string(),
});

const preflightBody = z.object({
  name: z.string(),
  yaml: z.string(),
  env: z.record(z.string()).optional(),
  mode: z.enum(['create', 'update']).default('create'),
});

const envUpdateBody = z.object({
  env: z.record(z.string()),
  replace: z.boolean().default(true),
});

// Directory to store compose files
const COMPOSE_DIR = process.env.COMPOSE_DIR || '/data/compose';
const COMPOSE_NAME_REGEX = /^[a-z0-9][a-z0-9_-]{1,62}$/;

function normalizeStackName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 63);
}

function validateStackName(name: string) {
  const normalizedName = normalizeStackName(name);
  const errors: string[] = [];

  if (!normalizedName) {
    errors.push('Stack name is required');
  }

  if (!COMPOSE_NAME_REGEX.test(normalizedName)) {
    errors.push('Stack name must match ^[a-z0-9][a-z0-9_-]{1,62}$');
  }

  return {
    valid: errors.length === 0,
    normalizedName,
    errors,
  };
}

function ensureSafeStackPath(name: string): string {
  const stackPath = path.resolve(path.join(COMPOSE_DIR, name));
  const composeRoot = path.resolve(COMPOSE_DIR);
  if (!(stackPath === composeRoot || stackPath.startsWith(`${composeRoot}${path.sep}`))) {
    throw new Error('Invalid stack path');
  }
  return stackPath;
}

function envObjectToFileContent(env: Record<string, string>): string {
  const entries = Object.entries(env).sort(([a], [b]) => a.localeCompare(b));
  return `${entries.map(([key, value]) => `${key}=${value.replace(/\n/g, '\\n')}`).join('\n')}\n`;
}

function envFileContentToObject(content: string): Record<string, string> {
  const env: Record<string, string> = {};
  const lines = content.split('\n');

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const separatorIndex = line.indexOf('=');
    if (separatorIndex === -1) continue;
    const key = line.slice(0, separatorIndex).trim();
    const value = line
      .slice(separatorIndex + 1)
      .trim()
      .replace(/\\n/g, '\n');
    if (key) {
      env[key] = value;
    }
  }

  return env;
}

function parseHostPortsFromCompose(yaml: string): number[] {
  const ports = new Set<number>();
  const shortPortRegex = /-\s*["']?(\d{1,5})\s*:\s*\d{1,5}(?:\/[a-z]+)?["']?/gi;
  const longPortRegex = /published\s*:\s*["']?(\d{1,5})["']?/gi;

  let shortMatch = shortPortRegex.exec(yaml);
  while (shortMatch) {
    const port = Number.parseInt(shortMatch[1], 10);
    if (port > 0 && port <= 65535) {
      ports.add(port);
    }
    shortMatch = shortPortRegex.exec(yaml);
  }

  let longMatch = longPortRegex.exec(yaml);
  while (longMatch) {
    const port = Number.parseInt(longMatch[1], 10);
    if (port > 0 && port <= 65535) {
      ports.add(port);
    }
    longMatch = longPortRegex.exec(yaml);
  }

  return [...ports];
}

function parseContainerNamesFromCompose(yaml: string): string[] {
  const names = new Set<string>();
  const regex = /container_name\s*:\s*["']?([^\s"']+)["']?/gi;

  let match = regex.exec(yaml);
  while (match) {
    names.add(match[1]);
    match = regex.exec(yaml);
  }

  return [...names];
}

function detectUnresolvedVariables(yaml: string, env: Record<string, string>): string[] {
  const unresolved = new Set<string>();
  const regex = /\$\{([A-Z0-9_]+)(?::[-?][^}]*)?\}/gi;
  let match = regex.exec(yaml);
  while (match) {
    if (!(match[1] in env)) {
      unresolved.add(match[1]);
    }
    match = regex.exec(yaml);
  }
  return [...unresolved];
}

function getStackFiles(stackPath: string) {
  return {
    composeFile: path.join(stackPath, 'docker-compose.yml'),
    envFile: path.join(stackPath, '.env'),
    historyFile: path.join(stackPath, 'history.jsonl'),
  };
}

function fingerprintInput(name: string, yaml: string, env: Record<string, string>): string {
  const hash = createHash('sha256');
  hash.update(name);
  hash.update('\n---yaml---\n');
  hash.update(yaml);
  hash.update('\n---env---\n');
  hash.update(envObjectToFileContent(env));
  return `sha256:${hash.digest('hex')}`;
}

async function appendHistoryEntry(
  stackPath: string,
  entry: {
    deploymentId: string;
    action: 'up' | 'down' | 'delete';
    status: 'success' | 'error';
    fingerprint?: string;
    output?: string;
    error?: string;
  }
) {
  const { historyFile } = getStackFiles(stackPath);
  const payload = {
    ...entry,
    requestedAt: new Date().toISOString(),
  };
  await appendFile(historyFile, `${JSON.stringify(payload)}\n`, 'utf-8');
}

async function readStackEnv(stackPath: string): Promise<Record<string, string>> {
  const { envFile } = getStackFiles(stackPath);
  if (!existsSync(envFile)) return {};
  const content = await readFile(envFile, 'utf-8');
  return envFileContentToObject(content);
}

async function writeStackEnv(stackPath: string, env: Record<string, string>) {
  const { envFile } = getStackFiles(stackPath);
  await writeFile(envFile, envObjectToFileContent(env), 'utf-8');
}

async function preflightCompose(
  stackName: string,
  yaml: string,
  env: Record<string, string>,
  mode: 'create' | 'update'
) {
  const validation = validateStackName(stackName);
  const errors = [...validation.errors];
  const warnings: string[] = [];
  const tempDir = path.join(COMPOSE_DIR, `.temp-preflight-${Date.now()}`);

  if (!validation.valid) {
    return {
      valid: false,
      normalizedName: validation.normalizedName,
      errors,
      warnings,
      checks: {
        syntax: 'fail',
        interpolation: 'unknown',
        conflicts: {
          ports: [] as number[],
          containerNames: [] as string[],
          projectName: [] as string[],
        },
      },
      fingerprint: fingerprintInput(validation.normalizedName || stackName, yaml, env),
    };
  }

  const normalizedName = validation.normalizedName;
  const stackPath = ensureSafeStackPath(normalizedName);

  if (mode === 'create' && existsSync(stackPath)) {
    errors.push(`Stack '${normalizedName}' already exists`);
  }

  const unresolvedEnv = detectUnresolvedVariables(yaml, env);
  if (unresolvedEnv.length > 0) {
    warnings.push(`Unresolved variables in compose: ${unresolvedEnv.join(', ')}`);
  }

  await mkdir(tempDir, { recursive: true });
  const tempCompose = path.join(tempDir, 'docker-compose.yml');
  const tempEnv = path.join(tempDir, '.env');

  try {
    await writeFile(tempCompose, yaml, 'utf-8');
    if (Object.keys(env).length > 0) {
      await writeFile(tempEnv, envObjectToFileContent(env), 'utf-8');
    }

    const configResult = await executeCompose(['config', '--quiet'], tempDir);
    if (configResult.exitCode !== 0) {
      errors.push(configResult.stderr || 'Invalid compose file');
    }
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }

  const requestedPorts = parseHostPortsFromCompose(yaml);
  const requestedContainerNames = parseContainerNamesFromCompose(yaml);

  const docker = getDocker();
  const containers = await docker.listContainers({ all: true });

  const usedPorts = new Set<number>();
  const usedContainerNames = new Set<string>();
  for (const container of containers) {
    for (const port of container.Ports || []) {
      if (port.PublicPort) usedPorts.add(port.PublicPort);
    }
    for (const name of container.Names || []) {
      usedContainerNames.add(name.replace(/^\//, ''));
    }
  }

  const portConflicts = requestedPorts.filter((port) => usedPorts.has(port));
  const containerNameConflicts = requestedContainerNames.filter((name) =>
    usedContainerNames.has(name)
  );
  if (portConflicts.length > 0) {
    errors.push(`Host ports already in use: ${portConflicts.join(', ')}`);
  }
  if (containerNameConflicts.length > 0) {
    errors.push(`Container names already in use: ${containerNameConflicts.join(', ')}`);
  }

  const fingerprint = fingerprintInput(normalizedName, yaml, env);

  return {
    valid: errors.length === 0,
    normalizedName,
    errors,
    warnings,
    checks: {
      syntax: errors.length === 0 ? 'pass' : 'fail',
      interpolation: unresolvedEnv.length === 0 ? 'pass' : 'warn',
      conflicts: {
        ports: portConflicts,
        containerNames: containerNameConflicts,
        projectName: existsSync(stackPath) ? [normalizedName] : [],
      },
    },
    fingerprint,
  };
}

async function ensureComposeDir() {
  if (!existsSync(COMPOSE_DIR)) {
    await mkdir(COMPOSE_DIR, { recursive: true });
  }
}

async function executeCompose(
  args: string[],
  cwd: string
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve) => {
    const proc = spawn('docker', ['compose', ...args], {
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

export async function composeRoutes(fastify: FastifyInstance) {
  fastify.post<{ Body: z.infer<typeof validateNameBody> }>(
    '/compose/name/validate',
    {
      schema: { body: validateNameBody },
    },
    async (request, reply) => {
      const validation = validateStackName(request.body.name);
      return reply.send({
        success: true,
        data: {
          valid: validation.valid,
          normalizedName: validation.normalizedName,
          errors: validation.errors,
        },
      });
    }
  );

  fastify.post<{ Body: z.infer<typeof preflightBody> }>(
    '/compose/preflight',
    {
      schema: { body: preflightBody },
    },
    async (request, reply) => {
      await ensureComposeDir();
      const data = await preflightCompose(
        request.body.name,
        request.body.yaml,
        request.body.env || {},
        request.body.mode
      );

      return reply.send({
        success: true,
        data,
      });
    }
  );

  // List compose stacks
  fastify.get('/compose/stacks', async (_request, reply) => {
    await ensureComposeDir();

    const stacks: ComposeStack[] = [];

    if (!existsSync(COMPOSE_DIR)) {
      return reply.send({ success: true, data: stacks });
    }

    const dirs = await readdir(COMPOSE_DIR, { withFileTypes: true });

    for (const dir of dirs) {
      if (!dir.isDirectory()) continue;

      const stackPath = path.join(COMPOSE_DIR, dir.name);
      const composeFile = path.join(stackPath, 'docker-compose.yml');

      if (!existsSync(composeFile)) continue;

      try {
        // Get status of the stack
        const result = await executeCompose(['ps', '--format', 'json'], stackPath);

        let services: ComposeService[] = [];
        let status: 'running' | 'stopped' | 'partial' = 'stopped';

        if (result.exitCode === 0 && result.stdout) {
          try {
            // Parse the JSON output (can be multiple JSON objects)
            const lines = result.stdout.trim().split('\n').filter(Boolean);
            const containers = lines.map((line) => JSON.parse(line));

            services = containers.map(
              (c: {
                Name?: string;
                ID?: string;
                Image?: string;
                State?: string;
                Ports?: string;
              }) => ({
                name: c.Name || '',
                containerId: c.ID,
                image: c.Image || '',
                status: c.State || '',
                ports: [],
              })
            );

            const runningCount = containers.filter(
              (c: { State?: string }) => c.State === 'running'
            ).length;
            if (runningCount === containers.length && containers.length > 0) {
              status = 'running';
            } else if (runningCount > 0) {
              status = 'partial';
            }
          } catch {
            // If parsing fails, try alternative format
            status = 'stopped';
          }
        }

        stacks.push({
          name: dir.name,
          projectDir: stackPath,
          status,
          services,
          createdAt: (await stat(composeFile)).mtime,
        });
      } catch (error) {
        // Skip stacks that can't be read
        continue;
      }
    }

    return reply.send({ success: true, data: stacks });
  });

  // Validate compose file
  fastify.post<{ Body: z.infer<typeof validateComposeBody> }>(
    '/compose/validate',
    {
      schema: {
        body: validateComposeBody,
      },
    },
    async (request, reply) => {
      const { yaml } = request.body;

      // Create a temporary directory for validation
      const tempDir = path.join(COMPOSE_DIR, '.temp-validate');
      await ensureComposeDir();
      await mkdir(tempDir, { recursive: true });

      try {
        await writeFile(path.join(tempDir, 'docker-compose.yml'), yaml);
        const result = await executeCompose(['config', '--quiet'], tempDir);

        if (result.exitCode !== 0) {
          return reply.send({
            success: false,
            error: result.stderr || 'Invalid compose file',
          });
        }

        return reply.send({ success: true, message: 'Compose file is valid' });
      } finally {
        await rm(tempDir, { recursive: true, force: true });
      }
    }
  );

  // Compose up
  fastify.post<{ Body: z.infer<typeof composeUpBody> }>(
    '/compose/up',
    {
      schema: {
        body: composeUpBody,
      },
    },
    async (request, reply) => {
      const { name, yaml, detach, build, removeOrphans } = request.body;
      const env = request.body.env || {};
      const preflightFingerprint = request.body.preflightFingerprint;

      const validation = validateStackName(name);
      if (!validation.valid) {
        return reply.status(400).send({
          success: false,
          error: validation.errors.join(', '),
        });
      }

      const normalizedName = validation.normalizedName;
      const preflight = await preflightCompose(normalizedName, yaml, env, 'update');
      if (!preflight.valid) {
        return reply.status(400).send({
          success: false,
          error: preflight.errors.join('; '),
          data: preflight,
        });
      }

      if (preflightFingerprint && preflightFingerprint !== preflight.fingerprint) {
        return reply.status(409).send({
          success: false,
          error: 'Configuration changed since preflight validation. Please validate again.',
          data: {
            expectedFingerprint: preflightFingerprint,
            currentFingerprint: preflight.fingerprint,
          },
        });
      }

      await ensureComposeDir();
      const stackPath = ensureSafeStackPath(normalizedName);
      const { composeFile } = getStackFiles(stackPath);

      // Create stack directory
      if (!existsSync(stackPath)) {
        await mkdir(stackPath, { recursive: true });
      }

      // Write compose file
      await writeFile(composeFile, yaml, 'utf-8');
      await writeStackEnv(stackPath, env);

      // Execute compose up
      const args = ['up'];
      if (detach) args.push('-d');
      if (build) args.push('--build');
      if (removeOrphans) args.push('--remove-orphans');

      const result = await executeCompose(args, stackPath);
      const deploymentId = crypto.randomUUID();

      if (result.exitCode !== 0) {
        await appendHistoryEntry(stackPath, {
          deploymentId,
          action: 'up',
          status: 'error',
          fingerprint: preflight.fingerprint,
          error: result.stderr,
          output: result.stdout,
        });
        return reply.status(400).send({
          success: false,
          error: result.stderr || 'Failed to start stack',
        });
      }

      await appendHistoryEntry(stackPath, {
        deploymentId,
        action: 'up',
        status: 'success',
        fingerprint: preflight.fingerprint,
        output: result.stdout,
      });

      return reply.send({
        success: true,
        message: `Stack ${normalizedName} started successfully`,
        output: result.stdout,
        data: {
          deploymentId,
          fingerprint: preflight.fingerprint,
        },
      });
    }
  );

  // Compose down
  fastify.post<{ Body: z.infer<typeof composeDownBody> }>(
    '/compose/down',
    {
      schema: {
        body: composeDownBody,
      },
    },
    async (request, reply) => {
      const { name, removeVolumes, removeImages } = request.body;

      const validation = validateStackName(name);
      if (!validation.valid) {
        return reply.status(400).send({
          success: false,
          error: validation.errors.join(', '),
        });
      }

      const stackPath = ensureSafeStackPath(validation.normalizedName);

      if (!existsSync(stackPath)) {
        return reply.status(404).send({ error: 'Stack not found' });
      }

      const args = ['down'];
      if (removeVolumes) args.push('-v');
      if (removeImages) args.push('--rmi', 'all');

      const result = await executeCompose(args, stackPath);
      const deploymentId = crypto.randomUUID();

      if (result.exitCode !== 0) {
        await appendHistoryEntry(stackPath, {
          deploymentId,
          action: 'down',
          status: 'error',
          error: result.stderr,
          output: result.stdout,
        });
        return reply.status(400).send({
          success: false,
          error: result.stderr || 'Failed to stop stack',
        });
      }

      await appendHistoryEntry(stackPath, {
        deploymentId,
        action: 'down',
        status: 'success',
        output: result.stdout,
      });

      return reply.send({
        success: true,
        message: `Stack ${validation.normalizedName} stopped successfully`,
        output: result.stdout,
      });
    }
  );

  fastify.get<{ Params: { name: string } }>('/compose/:name/env', async (request, reply) => {
    const validation = validateStackName(request.params.name);
    if (!validation.valid) {
      return reply.status(400).send({ success: false, error: validation.errors.join(', ') });
    }

    const stackPath = ensureSafeStackPath(validation.normalizedName);
    if (!existsSync(stackPath)) {
      return reply.status(404).send({ success: false, error: 'Stack not found' });
    }

    const env = await readStackEnv(stackPath);
    return reply.send({ success: true, data: env });
  });

  fastify.put<{ Params: { name: string }; Body: z.infer<typeof envUpdateBody> }>(
    '/compose/:name/env',
    {
      schema: { body: envUpdateBody },
    },
    async (request, reply) => {
      const validation = validateStackName(request.params.name);
      if (!validation.valid) {
        return reply.status(400).send({ success: false, error: validation.errors.join(', ') });
      }

      const stackPath = ensureSafeStackPath(validation.normalizedName);
      if (!existsSync(stackPath)) {
        return reply.status(404).send({ success: false, error: 'Stack not found' });
      }

      const current = await readStackEnv(stackPath);
      const next = request.body.replace ? request.body.env : { ...current, ...request.body.env };
      await writeStackEnv(stackPath, next);

      return reply.send({ success: true, message: 'Environment variables updated', data: next });
    }
  );

  fastify.get<{ Params: { name: string } }>('/compose/:name/history', async (request, reply) => {
    const validation = validateStackName(request.params.name);
    if (!validation.valid) {
      return reply.status(400).send({ success: false, error: validation.errors.join(', ') });
    }

    const stackPath = ensureSafeStackPath(validation.normalizedName);
    if (!existsSync(stackPath)) {
      return reply.status(404).send({ success: false, error: 'Stack not found' });
    }

    const { historyFile } = getStackFiles(stackPath);
    if (!existsSync(historyFile)) {
      return reply.send({ success: true, data: [] });
    }

    const content = await readFile(historyFile, 'utf-8');
    const rows = content
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.parse(line) as Record<string, unknown>;
        } catch {
          return undefined;
        }
      })
      .filter((entry): entry is Record<string, unknown> => Boolean(entry))
      .reverse();

    return reply.send({ success: true, data: rows });
  });

  // Get stack logs
  fastify.get<{ Params: { name: string }; Querystring: { tail?: number; follow?: boolean } }>(
    '/compose/:name/logs',
    async (request, reply) => {
      const { name } = request.params;
      const { tail = 100 } = request.query;

      const stackPath = path.join(COMPOSE_DIR, name);

      if (!existsSync(stackPath)) {
        return reply.status(404).send({ error: 'Stack not found' });
      }

      const result = await executeCompose(['logs', '--tail', String(tail)], stackPath);

      return reply.send({
        success: true,
        data: result.stdout || result.stderr,
      });
    }
  );

  // Delete stack
  fastify.delete<{ Params: { name: string } }>('/compose/:name', async (request, reply) => {
    const { name } = request.params;
    const validation = validateStackName(name);

    if (!validation.valid) {
      return reply.status(400).send({ success: false, error: validation.errors.join(', ') });
    }

    const stackPath = ensureSafeStackPath(validation.normalizedName);

    if (!existsSync(stackPath)) {
      return reply.status(404).send({ error: 'Stack not found' });
    }

    // First, bring down the stack
    await executeCompose(['down', '-v'], stackPath);

    await appendHistoryEntry(stackPath, {
      deploymentId: crypto.randomUUID(),
      action: 'delete',
      status: 'success',
    });

    // Then remove the directory
    await rm(stackPath, { recursive: true, force: true });

    return reply.send({
      success: true,
      message: `Stack ${validation.normalizedName} deleted`,
    });
  });
}
