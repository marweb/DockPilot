import { getLogger } from '../utils/logger.js';

const logger = getLogger();

// Custom error classes for Cloudflare-related errors
export class CloudflareError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public details?: unknown
  ) {
    super(message);
    this.name = 'CloudflareError';
  }
}

export class TunnelNotFoundError extends CloudflareError {
  constructor(tunnelId: string) {
    super(`Tunnel not found: ${tunnelId}`, 'TUNNEL_NOT_FOUND', 404);
    this.name = 'TunnelNotFoundError';
  }
}

export class TunnelAlreadyExistsError extends CloudflareError {
  constructor(name: string) {
    super(`Tunnel with name "${name}" already exists`, 'TUNNEL_ALREADY_EXISTS', 409);
    this.name = 'TunnelAlreadyExistsError';
  }
}

export class AuthenticationError extends CloudflareError {
  constructor(message: string = 'Not authenticated with Cloudflare') {
    super(message, 'NOT_AUTHENTICATED', 401);
    this.name = 'AuthenticationError';
  }
}

export class IngressRuleError extends CloudflareError {
  constructor(
    message: string,
    public hostname?: string
  ) {
    super(message, 'INGRESS_RULE_ERROR', 400);
    this.name = 'IngressRuleError';
  }
}

export class ProcessError extends CloudflareError {
  constructor(
    message: string,
    public exitCode?: number
  ) {
    super(message, 'PROCESS_ERROR', 500);
    this.name = 'ProcessError';
  }
}

// Error handler middleware for Fastify
export function errorHandler(error: Error, request: any, reply: any): void {
  logger.error(
    {
      error: error.message,
      stack: error.stack,
      url: request.url,
      method: request.method,
    },
    'Request error'
  );

  // Handle specific error types
  if (error instanceof CloudflareError) {
    reply.status(error.statusCode).send({
      success: false,
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
      },
    });
    return;
  }

  // Handle Zod validation errors
  if (error.name === 'ZodError') {
    reply.status(400).send({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: (error as any).errors,
      },
    });
    return;
  }

  // Handle syntax errors (malformed JSON)
  if (error instanceof SyntaxError) {
    reply.status(400).send({
      success: false,
      error: {
        code: 'SYNTAX_ERROR',
        message: 'Invalid JSON in request body',
      },
    });
    return;
  }

  // Default error response
  const statusCode = (error as any).statusCode || 500;
  reply.status(statusCode).send({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: process.env.NODE_ENV === 'production' ? 'An internal error occurred' : error.message,
      ...(process.env.NODE_ENV !== 'production' && { stack: error.stack }),
    },
  });
}

// Helper function to wrap async route handlers
export function asyncHandler(fn: Function) {
  return async (request: any, reply: any) => {
    try {
      return await fn(request, reply);
    } catch (error) {
      errorHandler(error as Error, request, reply);
    }
  };
}
