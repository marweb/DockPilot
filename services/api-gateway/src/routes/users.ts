import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getUser } from '../types/fastify.js';
import { z } from 'zod';
import type { UserRole } from '@dockpilot/types';
import '../types/fastify.js';
import {
  listUsers,
  findUserById,
  findUserByUsername,
  createUser,
  updateUser,
  deleteUser,
} from '../services/database.js';
import { logAuditEntry } from '../middleware/audit.js';
import {
  hashPassword,
  generateRandomPassword,
  validatePasswordStrength,
} from '../utils/password.js';
import { requireRole } from '../middleware/rbac.js';
import { generateTokenPair } from '../utils/jwt.js';

// Validation schemas
const createUserSchema = z.object({
  username: z
    .string()
    .min(3)
    .max(50)
    .regex(/^[a-zA-Z0-9_]+$/, {
      message: 'Username can only contain letters, numbers, and underscores',
    }),
  password: z.string().min(8).optional(),
  role: z.enum(['admin', 'operator', 'viewer']),
});

const updateUserSchema = z.object({
  username: z
    .string()
    .min(3)
    .max(50)
    .regex(/^[a-zA-Z0-9_]+$/)
    .optional(),
  role: z.enum(['admin', 'operator', 'viewer']).optional(),
  password: z.string().min(8).optional(),
  isActive: z.boolean().optional(),
});

const changeRoleSchema = z.object({
  role: z.enum(['admin', 'operator', 'viewer']),
});

const resetPasswordSchema = z.object({
  temporaryPassword: z.string().min(8).optional(),
  requireChange: z.boolean().default(true),
});

const userIdParamSchema = z.object({
  id: z.string().uuid(),
});

/**
 * User routes
 */
export async function userRoutes(fastify: FastifyInstance): Promise<void> {
  // GET /api/users - List all users (admin only)
  fastify.get(
    '/',
    {
      preHandler: requireRole(['admin']),
    },
    async (request, reply) => {
      const users = await listUsers();

      await logAuditEntry({
        userId: getUser(request)!.id,
        username: getUser(request)!.username,
        action: 'users.list',
        resource: 'users',
        details: { count: users.length },
        ip: request.ip,
        userAgent: request.headers['user-agent'] || 'unknown',
        success: true,
      });

      return reply.send({
        success: true,
        data: users,
      });
    }
  );

  // POST /api/users - Create new user (admin only)
  fastify.post<{
    Body: z.infer<typeof createUserSchema>;
  }>(
    '/',
    {
      preHandler: requireRole(['admin']),
      schema: {
        body: createUserSchema,
      },
    },
    async (request, reply) => {
      const { username, password, role } = request.body;

      // Check if username already exists
      const existingUser = await findUserByUsername(username);
      if (existingUser) {
        return reply.status(409).send({
          success: false,
          error: {
            code: 'USERNAME_EXISTS',
            message: 'Username already exists',
          },
        });
      }

      // Generate or hash password
      let passwordHash: string;
      let temporaryPassword: string | undefined;

      if (password) {
        const validation = validatePasswordStrength(password);
        if (!validation.isValid) {
          return reply.status(400).send({
            success: false,
            error: {
              code: 'WEAK_PASSWORD',
              message: 'Password does not meet security requirements',
              details: validation.errors,
            },
          });
        }
        passwordHash = await hashPassword(password);
      } else {
        temporaryPassword = generateRandomPassword(16);
        passwordHash = await hashPassword(temporaryPassword);
      }

      // Create user
      const user = await createUser({
        username,
        passwordHash,
        role,
      });

      await logAuditEntry({
        userId: getUser(request)!.id,
        username: getUser(request)!.username,
        action: 'users.create',
        resource: 'users',
        resourceId: user.id,
        details: { role, username },
        ip: request.ip,
        userAgent: request.headers['user-agent'] || 'unknown',
        success: true,
      });

      const response: Record<string, unknown> = {
        id: user.id,
        username: user.username,
        role: user.role,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      };

      // Include temporary password if generated
      if (temporaryPassword) {
        response.temporaryPassword = temporaryPassword;
        response.message =
          'User created with temporary password. Please share this password securely with the user.';
      }

      return reply.status(201).send({
        success: true,
        data: response,
      });
    }
  );

  // GET /api/users/:id - Get user by ID
  fastify.get<{
    Params: z.infer<typeof userIdParamSchema>;
  }>('/:id', async (request, reply) => {
    const { id } = request.params;

    // Users can only view their own profile unless they're admin
    if (getUser(request)!.role !== 'admin' && getUser(request)!.id !== id) {
      return reply.status(403).send({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You can only view your own profile',
        },
      });
    }

    const user = await findUserById(id);

    if (!user) {
      return reply.status(404).send({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found',
        },
      });
    }

    return reply.send({
      success: true,
      data: {
        id: user.id,
        username: user.username,
        role: user.role,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    });
  });

  // PUT /api/users/:id - Update user (admin only)
  fastify.put<{
    Params: z.infer<typeof userIdParamSchema>;
    Body: z.infer<typeof updateUserSchema>;
  }>(
    '/:id',
    {
      preHandler: requireRole(['admin']),
      schema: {
        body: updateUserSchema,
        params: userIdParamSchema,
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const { username, role, password } = request.body;

      // Prevent self-demotion from admin
      if (id === getUser(request)!.id && role && role !== 'admin') {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'SELF_DEMOTION',
            message: 'You cannot demote yourself from admin',
          },
        });
      }

      const user = await findUserById(id);
      if (!user) {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'USER_NOT_FOUND',
            message: 'User not found',
          },
        });
      }

      // Check username uniqueness if changing
      if (username && username !== user.username) {
        const existingUser = await findUserByUsername(username);
        if (existingUser) {
          return reply.status(409).send({
            success: false,
            error: {
              code: 'USERNAME_EXISTS',
              message: 'Username already exists',
            },
          });
        }
      }

      const updates: Parameters<typeof updateUser>[1] = {};

      if (username) updates.username = username;
      if (role) updates.role = role;
      if (password) {
        const validation = validatePasswordStrength(password);
        if (!validation.isValid) {
          return reply.status(400).send({
            success: false,
            error: {
              code: 'WEAK_PASSWORD',
              message: 'Password does not meet security requirements',
              details: validation.errors,
            },
          });
        }
        updates.passwordHash = await hashPassword(password);
        updates.refreshToken = undefined; // Invalidate existing sessions
      }

      const updatedUser = await updateUser(id, updates);

      await logAuditEntry({
        userId: getUser(request)!.id,
        username: getUser(request)!.username,
        action: 'users.update',
        resource: 'users',
        resourceId: id,
        details: { updates: Object.keys(updates) },
        ip: request.ip,
        userAgent: request.headers['user-agent'] || 'unknown',
        success: true,
      });

      return reply.send({
        success: true,
        data: {
          id: updatedUser!.id,
          username: updatedUser!.username,
          role: updatedUser!.role,
          createdAt: updatedUser!.createdAt,
          updatedAt: updatedUser!.updatedAt,
        },
      });
    }
  );

  // DELETE /api/users/:id - Delete user (admin only)
  fastify.delete<{
    Params: z.infer<typeof userIdParamSchema>;
  }>(
    '/:id',
    {
      preHandler: requireRole(['admin']),
      schema: {
        params: userIdParamSchema,
      },
    },
    async (request, reply) => {
      const { id } = request.params;

      // Prevent self-deletion
      if (id === getUser(request)!.id) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'SELF_DELETION',
            message: 'You cannot delete your own account',
          },
        });
      }

      const user = await findUserById(id);
      if (!user) {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'USER_NOT_FOUND',
            message: 'User not found',
          },
        });
      }

      const deleted = await deleteUser(id);

      if (!deleted) {
        return reply.status(500).send({
          success: false,
          error: {
            code: 'DELETE_FAILED',
            message: 'Failed to delete user',
          },
        });
      }

      await logAuditEntry({
        userId: getUser(request)!.id,
        username: getUser(request)!.username,
        action: 'users.delete',
        resource: 'users',
        resourceId: id,
        details: { deletedUsername: user.username },
        ip: request.ip,
        userAgent: request.headers['user-agent'] || 'unknown',
        success: true,
      });

      return reply.send({
        success: true,
        message: 'User deleted successfully',
      });
    }
  );

  // POST /api/users/:id/change-role - Change user role (admin only)
  fastify.post<{
    Params: z.infer<typeof userIdParamSchema>;
    Body: z.infer<typeof changeRoleSchema>;
  }>(
    '/:id/change-role',
    {
      preHandler: requireRole(['admin']),
      schema: {
        body: changeRoleSchema,
        params: userIdParamSchema,
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const { role } = request.body;

      // Prevent self-demotion
      if (id === getUser(request)!.id && role !== 'admin') {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'SELF_DEMOTION',
            message: 'You cannot change your own role from admin',
          },
        });
      }

      const user = await findUserById(id);
      if (!user) {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'USER_NOT_FOUND',
            message: 'User not found',
          },
        });
      }

      const previousRole = user.role;
      const updatedUser = await updateUser(id, { role });

      await logAuditEntry({
        userId: getUser(request)!.id,
        username: getUser(request)!.username,
        action: 'users.change-role',
        resource: 'users',
        resourceId: id,
        details: { previousRole, newRole: role },
        ip: request.ip,
        userAgent: request.headers['user-agent'] || 'unknown',
        success: true,
      });

      return reply.send({
        success: true,
        data: {
          id: updatedUser!.id,
          username: updatedUser!.username,
          role: updatedUser!.role,
          previousRole,
          updatedAt: updatedUser!.updatedAt,
        },
      });
    }
  );

  // POST /api/users/:id/reset-password - Reset user password (admin only)
  fastify.post<{
    Params: z.infer<typeof userIdParamSchema>;
    Body: z.infer<typeof resetPasswordSchema>;
  }>(
    '/:id/reset-password',
    {
      preHandler: requireRole(['admin']),
      schema: {
        body: resetPasswordSchema,
        params: userIdParamSchema,
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const { temporaryPassword, requireChange } = request.body;

      const user = await findUserById(id);
      if (!user) {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'USER_NOT_FOUND',
            message: 'User not found',
          },
        });
      }

      // Generate or use provided temporary password
      const newPassword = temporaryPassword || generateRandomPassword(16);
      const passwordHash = await hashPassword(newPassword);

      // Update user with new password and invalidate sessions
      await updateUser(id, {
        passwordHash,
        refreshToken: undefined,
      });

      await logAuditEntry({
        userId: getUser(request)!.id,
        username: getUser(request)!.username,
        action: 'users.reset-password',
        resource: 'users',
        resourceId: id,
        details: { requireChange },
        ip: request.ip,
        userAgent: request.headers['user-agent'] || 'unknown',
        success: true,
      });

      return reply.send({
        success: true,
        message: 'Password reset successfully',
        data: {
          temporaryPassword: newPassword,
          requireChangeOnNextLogin: requireChange,
          note: 'Please share this temporary password securely with the user. All existing sessions have been invalidated.',
        },
      });
    }
  );
}
