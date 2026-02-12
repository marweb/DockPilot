import type { FastifyRequest, FastifyReply } from 'fastify';
import type { UserRole } from '@dockpilot/types';
import '../types/fastify.js';

export type Resource =
  | 'containers'
  | 'images'
  | 'volumes'
  | 'networks'
  | 'builds'
  | 'compose'
  | 'tunnels'
  | 'users'
  | 'settings'
  | 'system'
  | 'audit'
  | 'auth';

export type Action =
  | 'list'
  | 'get'
  | 'create'
  | 'update'
  | 'delete'
  | 'start'
  | 'stop'
  | 'restart'
  | 'kill'
  | 'logs'
  | 'exec'
  | 'stats'
  | 'pull'
  | 'history'
  | 'prune'
  | 'up'
  | 'down'
  | 'connect'
  | 'disconnect'
  | 'validate'
  | 'tag'
  | 'change-role'
  | 'reset-password'
  | '*';

export type Permission = `${Resource}:${Action}`;

interface RolePermissions {
  [role: string]: Permission[];
}

const rolePermissions: RolePermissions = {
  admin: [
    'containers:*',
    'images:*',
    'volumes:*',
    'networks:*',
    'builds:*',
    'compose:*',
    'tunnels:*',
    'users:*',
    'settings:*',
    'system:*',
    'audit:*',
    'auth:*',
  ],
  operator: [
    'containers:list',
    'containers:get',
    'containers:start',
    'containers:stop',
    'containers:restart',
    'containers:logs',
    'containers:exec',
    'containers:stats',
    'images:list',
    'images:get',
    'images:pull',
    'images:history',
    'volumes:list',
    'volumes:get',
    'networks:list',
    'networks:get',
    'builds:create',
    'builds:get',
    'compose:list',
    'compose:get',
    'compose:up',
    'compose:down',
    'compose:logs',
    'tunnels:list',
    'tunnels:get',
    'tunnels:start',
    'tunnels:stop',
    'system:*',
    'auth:change-password',
  ],
  viewer: [
    'containers:list',
    'containers:get',
    'containers:logs',
    'containers:stats',
    'images:list',
    'images:get',
    'images:history',
    'volumes:list',
    'volumes:get',
    'networks:list',
    'networks:get',
    'builds:get',
    'compose:list',
    'compose:get',
    'compose:logs',
    'tunnels:list',
    'tunnels:get',
    'system:*',
    'auth:change-password',
  ],
};

/**
 * Check if a role has a specific permission
 */
export function checkPermission(role: UserRole, resource: Resource, action: Action): boolean {
  const permissions = rolePermissions[role];

  if (!permissions) {
    return false;
  }

  // Check for wildcard permission on resource
  if (permissions.includes(`${resource}:*` as Permission)) {
    return true;
  }

  // Check for global wildcard (admin)
  if (permissions.includes('*:*')) {
    return true;
  }

  // Check for specific permission
  return permissions.includes(`${resource}:${action}` as Permission);
}

/**
 * Check if a role has permission for a specific resource:action string
 */
export function checkPermissionString(role: UserRole, permissionString: string): boolean {
  const [resource, action] = permissionString.split(':') as [Resource, Action];
  return checkPermission(role, resource, action);
}

/**
 * Middleware factory to require specific roles
 */
export function requireRole(allowedRoles: UserRole[]) {
  return async function (request: FastifyRequest, reply: FastifyReply): Promise<void> {
    if (!request.user) {
      reply.status(401).send({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Not authenticated',
        },
      });
      return;
    }

    if (!allowedRoles.includes(request.user.role)) {
      reply.status(403).send({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: `Access denied. Required roles: ${allowedRoles.join(', ')}`,
        },
      });
      return;
    }
  };
}

/**
 * Middleware factory to require a specific permission
 */
export function requirePermission(resource: Resource, action: Action) {
  return async function (request: FastifyRequest, reply: FastifyReply): Promise<void> {
    if (!request.user) {
      reply.status(401).send({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Not authenticated',
        },
      });
      return;
    }

    if (!checkPermission(request.user.role, resource, action)) {
      reply.status(403).send({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: `Insufficient permissions. Required: ${resource}:${action}`,
        },
      });
      return;
    }
  };
}

/**
 * Middleware to require admin role
 */
export async function requireAdmin(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  return requireRole(['admin'])(request, reply);
}

/**
 * Get all permissions for a role
 */
export function getRolePermissions(role: UserRole): Permission[] {
  return rolePermissions[role] || [];
}

/**
 * Check if a role exists
 */
export function isValidRole(role: string): role is UserRole {
  return ['admin', 'operator', 'viewer'].includes(role);
}

/**
 * Get available roles
 */
export function getAvailableRoles(): UserRole[] {
  return ['admin', 'operator', 'viewer'];
}
