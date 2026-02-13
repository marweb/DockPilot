import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { spawn } from 'child_process';
import { mkdir, writeFile, rm, readdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import type { ComposeStack, ComposeService } from '@dockpilot/types';

// Schemas
const composeUpBody = z.object({
  name: z.string(),
  yaml: z.string(),
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

// Directory to store compose files
const COMPOSE_DIR = process.env.COMPOSE_DIR || '/data/compose';

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
            
            services = containers.map((c: { Name?: string; ID?: string; Image?: string; State?: string; Ports?: string }) => ({
              name: c.Name || '',
              containerId: c.ID,
              image: c.Image || '',
              status: c.State || '',
              ports: [],
            }));

            const runningCount = containers.filter((c: { State?: string }) => c.State === 'running').length;
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

      await ensureComposeDir();
      const stackPath = path.join(COMPOSE_DIR, name);

      // Create stack directory
      if (!existsSync(stackPath)) {
        await mkdir(stackPath, { recursive: true });
      }

      // Write compose file
      await writeFile(path.join(stackPath, 'docker-compose.yml'), yaml);

      // Execute compose up
      const args = ['up'];
      if (detach) args.push('-d');
      if (build) args.push('--build');
      if (removeOrphans) args.push('--remove-orphans');

      const result = await executeCompose(args, stackPath);

      if (result.exitCode !== 0) {
        return reply.status(400).send({
          success: false,
          error: result.stderr || 'Failed to start stack',
        });
      }

      return reply.send({
        success: true,
        message: `Stack ${name} started successfully`,
        output: result.stdout,
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

      const stackPath = path.join(COMPOSE_DIR, name);

      if (!existsSync(stackPath)) {
        return reply.status(404).send({ error: 'Stack not found' });
      }

      const args = ['down'];
      if (removeVolumes) args.push('-v');
      if (removeImages) args.push('--rmi', 'all');

      const result = await executeCompose(args, stackPath);

      if (result.exitCode !== 0) {
        return reply.status(400).send({
          success: false,
          error: result.stderr || 'Failed to stop stack',
        });
      }

      return reply.send({
        success: true,
        message: `Stack ${name} stopped successfully`,
        output: result.stdout,
      });
    }
  );

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

    const stackPath = path.join(COMPOSE_DIR, name);

    if (!existsSync(stackPath)) {
      return reply.status(404).send({ error: 'Stack not found' });
    }

    // First, bring down the stack
    await executeCompose(['down', '-v'], stackPath);

    // Then remove the directory
    await rm(stackPath, { recursive: true, force: true });

    return reply.send({
      success: true,
      message: `Stack ${name} deleted`,
    });
  });
}
