import { describe, it, expect } from 'vitest';
import {
  checkPermission,
  checkPermissionString,
  requireRole,
  requirePermission,
  requireAdmin,
  getRolePermissions,
  isValidRole,
  getAvailableRoles,
  type Resource,
  type Action,
} from '../../../services/api-gateway/src/middleware/rbac.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import type { UserRole } from '@dockpilot/types';

describe('RBAC System', () => {
  describe('checkPermission', () => {
    it('should allow admin to perform any action', () => {
      const resources: Resource[] = [
        'containers',
        'images',
        'volumes',
        'networks',
        'users',
        'settings',
      ];
      const actions: Action[] = ['list', 'get', 'create', 'update', 'delete', 'start', 'stop'];

      for (const resource of resources) {
        for (const action of actions) {
          expect(checkPermission('admin', resource, action)).toBe(true);
        }
      }
    });

    it('should allow admin wildcard permissions', () => {
      expect(checkPermission('admin', 'containers', '*')).toBe(true);
      expect(checkPermission('admin', 'any-resource' as Resource, 'any-action' as Action)).toBe(
        true
      );
    });

    it('should allow operator specific permissions', () => {
      // Allowed permissions
      expect(checkPermission('operator', 'containers', 'list')).toBe(true);
      expect(checkPermission('operator', 'containers', 'get')).toBe(true);
      expect(checkPermission('operator', 'containers', 'start')).toBe(true);
      expect(checkPermission('operator', 'containers', 'stop')).toBe(true);
      expect(checkPermission('operator', 'containers', 'restart')).toBe(true);
      expect(checkPermission('operator', 'containers', 'logs')).toBe(true);
      expect(checkPermission('operator', 'containers', 'exec')).toBe(true);
      expect(checkPermission('operator', 'images', 'list')).toBe(true);
      expect(checkPermission('operator', 'images', 'pull')).toBe(true);
      expect(checkPermission('operator', 'tunnels', 'start')).toBe(true);
      expect(checkPermission('operator', 'tunnels', 'stop')).toBe(true);
    });

    it('should deny operator restricted permissions', () => {
      // Denied permissions
      expect(checkPermission('operator', 'containers', 'create')).toBe(false);
      expect(checkPermission('operator', 'containers', 'delete')).toBe(false);
      expect(checkPermission('operator', 'images', 'delete')).toBe(false);
      expect(checkPermission('operator', 'users', 'list')).toBe(false);
      expect(checkPermission('operator', 'users', 'create')).toBe(false);
      expect(checkPermission('operator', 'settings', 'update')).toBe(false);
    });

    it('should allow viewer read-only permissions', () => {
      // Allowed permissions
      expect(checkPermission('viewer', 'containers', 'list')).toBe(true);
      expect(checkPermission('viewer', 'containers', 'get')).toBe(true);
      expect(checkPermission('viewer', 'containers', 'logs')).toBe(true);
      expect(checkPermission('viewer', 'containers', 'stats')).toBe(true);
      expect(checkPermission('viewer', 'images', 'list')).toBe(true);
      expect(checkPermission('viewer', 'images', 'get')).toBe(true);
      expect(checkPermission('viewer', 'volumes', 'list')).toBe(true);
    });

    it('should deny viewer modification permissions', () => {
      // Denied permissions
      expect(checkPermission('viewer', 'containers', 'start')).toBe(false);
      expect(checkPermission('viewer', 'containers', 'stop')).toBe(false);
      expect(checkPermission('viewer', 'containers', 'create')).toBe(false);
      expect(checkPermission('viewer', 'containers', 'delete')).toBe(false);
      expect(checkPermission('viewer', 'images', 'pull')).toBe(false);
      expect(checkPermission('viewer', 'images', 'delete')).toBe(false);
      expect(checkPermission('viewer', 'tunnels', 'start')).toBe(false);
      expect(checkPermission('viewer', 'tunnels', 'stop')).toBe(false);
    });

    it('should deny unknown roles all permissions', () => {
      expect(checkPermission('unknown-role' as UserRole, 'containers', 'list')).toBe(false);
    });
  });

  describe('checkPermissionString', () => {
    it('should check permission from string format', () => {
      expect(checkPermissionString('admin', 'containers:list')).toBe(true);
      expect(checkPermissionString('operator', 'containers:start')).toBe(true);
      expect(checkPermissionString('viewer', 'containers:list')).toBe(true);
      expect(checkPermissionString('viewer', 'containers:start')).toBe(false);
    });
  });

  describe('requireRole middleware', () => {
    it('should allow access for allowed roles', async () => {
      const middleware = requireRole(['admin', 'operator']);
      const request = {
        user: { id: '1', username: 'test', role: 'admin' as UserRole },
      } as FastifyRequest;
      const reply = {
        status: () => ({ send: () => {} }),
      } as unknown as FastifyReply;

      const result = await middleware(request, reply);
      expect(result).toBeUndefined();
    });

    it('should deny access for disallowed roles', async () => {
      const middleware = requireRole(['admin']);
      const request = {
        user: { id: '1', username: 'test', role: 'viewer' as UserRole },
      } as FastifyRequest;
      let sentStatus = 0;
      let sentBody: unknown;
      const reply = {
        status: (code: number) => {
          sentStatus = code;
          return {
            send: (body: unknown) => {
              sentBody = body;
            },
          };
        },
      } as unknown as FastifyReply;

      await middleware(request, reply);
      expect(sentStatus).toBe(403);
      expect((sentBody as { error: { code: string } }).error.code).toBe('FORBIDDEN');
    });

    it('should deny access when not authenticated', async () => {
      const middleware = requireRole(['admin']);
      const request = {} as FastifyRequest;
      let sentStatus = 0;
      let sentBody: unknown;
      const reply = {
        status: (code: number) => {
          sentStatus = code;
          return {
            send: (body: unknown) => {
              sentBody = body;
            },
          };
        },
      } as unknown as FastifyReply;

      await middleware(request, reply);
      expect(sentStatus).toBe(401);
      expect((sentBody as { error: { code: string } }).error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('requirePermission middleware', () => {
    it('should allow access with correct permission', async () => {
      const middleware = requirePermission('containers', 'list');
      const request = {
        user: { id: '1', username: 'test', role: 'viewer' as UserRole },
      } as FastifyRequest;
      const reply = {} as FastifyReply;

      const result = await middleware(request, reply);
      expect(result).toBeUndefined();
    });

    it('should deny access without permission', async () => {
      const middleware = requirePermission('containers', 'delete');
      const request = {
        user: { id: '1', username: 'test', role: 'viewer' as UserRole },
      } as FastifyRequest;
      let sentStatus = 0;
      let sentBody: unknown;
      const reply = {
        status: (code: number) => {
          sentStatus = code;
          return {
            send: (body: unknown) => {
              sentBody = body;
            },
          };
        },
      } as unknown as FastifyReply;

      await middleware(request, reply);
      expect(sentStatus).toBe(403);
      expect((sentBody as { error: { code: string } }).error.code).toBe('FORBIDDEN');
    });

    it('should allow operator to modify containers', async () => {
      const middleware = requirePermission('containers', 'start');
      const request = {
        user: { id: '1', username: 'test', role: 'operator' as UserRole },
      } as FastifyRequest;
      const reply = {} as FastifyReply;

      const result = await middleware(request, reply);
      expect(result).toBeUndefined();
    });

    it('should deny operator from deleting containers', async () => {
      const middleware = requirePermission('containers', 'delete');
      const request = {
        user: { id: '1', username: 'test', role: 'operator' as UserRole },
      } as FastifyRequest;
      let sentStatus = 0;
      const reply = {
        status: (code: number) => {
          sentStatus = code;
          return { send: () => {} };
        },
      } as unknown as FastifyReply;

      await middleware(request, reply);
      expect(sentStatus).toBe(403);
    });
  });

  describe('requireAdmin middleware', () => {
    it('should allow admin access', async () => {
      const request = {
        user: { id: '1', username: 'test', role: 'admin' as UserRole },
      } as FastifyRequest;
      const reply = {} as FastifyReply;

      const result = await requireAdmin(request, reply);
      expect(result).toBeUndefined();
    });

    it('should deny non-admin access', async () => {
      const request = {
        user: { id: '1', username: 'test', role: 'operator' as UserRole },
      } as FastifyRequest;
      let sentStatus = 0;
      const reply = {
        status: (code: number) => {
          sentStatus = code;
          return { send: () => {} };
        },
      } as unknown as FastifyReply;

      await requireAdmin(request, reply);
      expect(sentStatus).toBe(403);
    });
  });

  describe('getRolePermissions', () => {
    it('should return all permissions for admin', () => {
      const permissions = getRolePermissions('admin');
      expect(permissions).toContain('containers:*');
      expect(permissions).toContain('images:*');
      expect(permissions).toContain('users:*');
      expect(permissions.length).toBeGreaterThan(10);
    });

    it('should return viewer permissions', () => {
      const permissions = getRolePermissions('viewer');
      expect(permissions).toContain('containers:list');
      expect(permissions).toContain('containers:get');
      expect(permissions).not.toContain('containers:delete');
    });

    it('should return empty array for unknown role', () => {
      const permissions = getRolePermissions('unknown' as UserRole);
      expect(permissions).toEqual([]);
    });
  });

  describe('isValidRole', () => {
    it('should validate known roles', () => {
      expect(isValidRole('admin')).toBe(true);
      expect(isValidRole('operator')).toBe(true);
      expect(isValidRole('viewer')).toBe(true);
    });

    it('should reject invalid roles', () => {
      expect(isValidRole('superadmin')).toBe(false);
      expect(isValidRole('user')).toBe(false);
      expect(isValidRole('')).toBe(false);
    });
  });

  describe('getAvailableRoles', () => {
    it('should return all available roles', () => {
      const roles = getAvailableRoles();
      expect(roles).toContain('admin');
      expect(roles).toContain('operator');
      expect(roles).toContain('viewer');
      expect(roles).toHaveLength(3);
    });
  });
});
