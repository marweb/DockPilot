import { z } from 'zod';

const configSchema = z.object({
  port: z.number().default(3001),
  host: z.string().default('0.0.0.0'),
  dockerHost: z.string().default('unix:///var/run/docker.sock'),
  logLevel: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
});

export type Config = z.infer<typeof configSchema>;

export function loadConfig(): Config {
  return configSchema.parse({
    port: process.env.PORT ? parseInt(process.env.PORT, 10) : undefined,
    host: process.env.HOST,
    dockerHost: process.env.DOCKER_HOST,
    logLevel: process.env.LOG_LEVEL,
  });
}
