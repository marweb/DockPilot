import type { FastifyRequest } from 'fastify';
import type { UserRole } from '@dockpilot/types';
import type { Config } from '../config/index.js';

export interface AuthenticatedUser {
  id: string;
  username: string;
  role: UserRole;
}

declare module 'fastify' {
  interface FastifyInstance {
    config: Config;
  }
}

/** Helper to get typed user from request (JWT plugin types request.user as payload) */
export function getUser(req: FastifyRequest): AuthenticatedUser | undefined {
  const u = (req as { user?: unknown }).user;
  return u && typeof u === 'object' && 'id' in u ? (u as AuthenticatedUser) : undefined;
}
