import pino from 'pino';
import type { Config } from '../config/index.js';

let logger: pino.Logger | null = null;
let config: Config | null = null;

export function initLogger(cfg: Config): void {
  config = cfg;

  const transport =
    process.env.NODE_ENV !== 'production'
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'HH:MM:ss',
            ignore: 'pid,hostname',
          },
        }
      : undefined;

  const options: pino.LoggerOptions = {
    level: cfg.logLevel,
    transport,
  };

  // Add file transport if configured
  if (cfg.logFile) {
    options.transport = {
      targets: [
        ...(transport ? [transport] : []),
        {
          target: 'pino/file',
          options: {
            destination: cfg.logFile,
            mkdir: true,
          },
          level: cfg.logLevel,
        },
      ],
    };
  }

  logger = pino(options);
}

export function getLogger(): pino.Logger {
  if (!logger) {
    // Return a default logger if not initialized
    return pino({
      level: 'info',
      transport:
        process.env.NODE_ENV !== 'production'
          ? {
              target: 'pino-pretty',
              options: {
                colorize: true,
                translateTime: 'HH:MM:ss',
                ignore: 'pid,hostname',
              },
            }
          : undefined,
    });
  }
  return logger;
}

export function createChildLogger(bindings: Record<string, unknown>): pino.Logger {
  return getLogger().child(bindings);
}
