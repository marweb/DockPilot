import type { UserRole } from '@dockpilot/types';
import type { Config } from './config/index.js';

export interface AuthenticatedUser {
  id: string;
  username: string;
  role: UserRole;
}

declare module 'fastify' {
  interface FastifyInstance {
    config: Config;
  }
  interface FastifyRequest {
    user?: AuthenticatedUser;
  }
}
