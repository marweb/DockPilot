import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import type { User, UserRole } from '@dockpilot/types';
import '../types/fastify.js';
import {
  isSetupComplete,
  completeSetup,
  findUserByUsername,
  findUserById,
  createUser,
  updateUser,
  listUsers,
  deleteUser,
} from '../services/database.js';
import { logAuditEntry } from '../middleware/audit.js';
import { strictRateLimitMiddleware } from '../middleware/rateLimit.js';
import { requireRole } from '../middleware/rbac.js';
import {
  hashPassword,
  verifyPassword,
  validatePasswordStrength,
  generateRandomPassword,
} from '../utils/password.js';
import {
  generateTokenPair,
  verifyRefreshToken,
  rotateRefreshToken,
  JWTErrors,
} from '../utils/jwt.js';

// Validation schemas
const loginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});

const setupSchema = z.object({
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(50, 'Username must be at most 50 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
});

const createUserSchema = z.object({
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(50, 'Username must be at most 50 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: z.enum(['admin', 'operator', 'viewer']),
});

const updateUserSchema = z.object({
  role: z.enum(['admin', 'operator', 'viewer']).optional(),
  password: z.string().min(8, 'Password must be at least 8 characters').optional(),
});

const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

/**
 * Handle authentication errors consistently
 */
function handleAuthError(
  reply: FastifyReply,
  statusCode: number,
  code: string,
  message: string,
  details?: unknown
): void {
  reply.status(statusCode).send({
    success: false,
    error: {
      code,
      message,
      details,
    },
  });
}

/**
 * Authentication routes
 */
export async function authRoutes(fastify: FastifyInstance): Promise<void> {
  // Check setup status
  fastify.get('/auth/setup-status', async (request, reply) => {
    const setupComplete = await isSetupComplete();
    return reply.send({
      success: true,
      data: {
        setupComplete,
      },
    });
  });

  // Initial setup - create admin user
  fastify.post<{ Body: z.infer<typeof setupSchema> }>(
    '/auth/setup',
    {
      schema: {
        body: setupSchema,
      },
    },
    async (request, reply) => {
      try {
        const setupComplete = await isSetupComplete();

        if (setupComplete) {
          return handleAuthError(reply, 400, 'SETUP_COMPLETED', 'Setup already completed');
        }

        const { username, password } = request.body;

        // Validate password strength
        const strengthCheck = validatePasswordStrength(password);
        if (!strengthCheck.isValid) {
          return handleAuthError(
            reply,
            400,
            'WEAK_PASSWORD',
            'Password does not meet security requirements',
            strengthCheck.errors
          );
        }

        // Check if username already exists
        const existingUser = await findUserByUsername(username);
        if (existingUser) {
          return handleAuthError(reply, 409, 'USERNAME_EXISTS', 'Username already exists');
        }

        // Hash password using utility
        const passwordHash = await hashPassword(password);

        // Create admin user
        const user = await createUser({
          username,
          passwordHash,
          role: 'admin',
        });

        await completeSetup();

        // Generate tokens using utility
        const tokens = generateTokenPair(fastify, {
          id: user.id,
          username: user.username,
          role: user.role,
        });

        // Store refresh token
        await updateUser(user.id, { refreshToken: tokens.refreshToken });

        await logAuditEntry({
          userId: user.id,
          username: user.username,
          action: 'auth.setup',
          resource: 'auth',
          details: { setupComplete: true },
          ip: request.ip,
          userAgent: request.headers['user-agent'] || 'unknown',
          success: true,
        });

        return reply.status(201).send({
          success: true,
          data: {
            user: {
              id: user.id,
              username: user.username,
              role: user.role,
              createdAt: user.createdAt,
              updatedAt: user.updatedAt,
            },
            tokens,
          },
        });
      } catch (error) {
        fastify.log.error(error, 'Setup failed');
        return handleAuthError(reply, 500, 'SETUP_ERROR', 'Failed to complete setup');
      }
    }
  );

  // Login with rate limiting
  fastify.post<{ Body: z.infer<typeof loginSchema> }>(
    '/auth/login',
    {
      schema: {
        body: loginSchema,
      },
      preHandler: strictRateLimitMiddleware,
    },
    async (request, reply) => {
      try {
        const { username, password } = request.body;

        const user = await findUserByUsername(username);

        if (!user) {
          await logAuditEntry({
            userId: 'unknown',
            username,
            action: 'auth.login.failed',
            resource: 'auth',
            details: { reason: 'user_not_found' },
            ip: request.ip,
            userAgent: request.headers['user-agent'] || 'unknown',
            success: false,
            errorMessage: 'User not found',
          });

          return handleAuthError(reply, 401, 'INVALID_CREDENTIALS', 'Invalid username or password');
        }

        // Verify password using utility
        const validPassword = await verifyPassword(password, user.passwordHash);

        if (!validPassword) {
          await logAuditEntry({
            userId: user.id,
            username: user.username,
            action: 'auth.login.failed',
            resource: 'auth',
            details: { reason: 'invalid_password' },
            ip: request.ip,
            userAgent: request.headers['user-agent'] || 'unknown',
            success: false,
            errorMessage: 'Invalid password',
          });

          return handleAuthError(reply, 401, 'INVALID_CREDENTIALS', 'Invalid username or password');
        }

        // Generate tokens using utility
        const tokens = generateTokenPair(fastify, {
          id: user.id,
          username: user.username,
          role: user.role,
        });

        // Store refresh token
        await updateUser(user.id, { refreshToken: tokens.refreshToken });

        await logAuditEntry({
          userId: user.id,
          username: user.username,
          action: 'auth.login.success',
          resource: 'auth',
          ip: request.ip,
          userAgent: request.headers['user-agent'] || 'unknown',
          success: true,
        });

        return reply.send({
          success: true,
          data: {
            user: {
              id: user.id,
              username: user.username,
              role: user.role,
              createdAt: user.createdAt,
              updatedAt: user.updatedAt,
            },
            tokens,
          },
        });
      } catch (error) {
        fastify.log.error(error, 'Login failed');
        return handleAuthError(reply, 500, 'LOGIN_ERROR', 'Login failed due to server error');
      }
    }
  );

  // Logout
  fastify.post('/auth/logout', async (request, reply) => {
    try {
      if (request.user) {
        await updateUser(request.user.id, { refreshToken: undefined });

        await logAuditEntry({
          userId: request.user.id,
          username: request.user.username,
          action: 'auth.logout',
          resource: 'auth',
          ip: request.ip,
          userAgent: request.headers['user-agent'] || 'unknown',
          success: true,
        });
      }

      return reply.send({
        success: true,
        message: 'Logged out successfully',
      });
    } catch (error) {
      fastify.log.error(error, 'Logout failed');
      return handleAuthError(reply, 500, 'LOGOUT_ERROR', 'Logout failed');
    }
  });

  // Refresh token with rotation
  fastify.post<{ Body: z.infer<typeof refreshTokenSchema> }>(
    '/auth/refresh',
    {
      schema: {
        body: refreshTokenSchema,
      },
    },
    async (request, reply) => {
      try {
        const { refreshToken } = request.body;

        // Verify refresh token using utility
        const verification = verifyRefreshToken(fastify, refreshToken);

        if (!verification.valid) {
          return handleAuthError(
            reply,
            401,
            verification.error === 'Refresh token has expired' ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN',
            verification.error || 'Invalid refresh token'
          );
        }

        const user = await findUserById(verification.userId!);

        if (!user || user.refreshToken !== refreshToken) {
          // Potential token reuse detected
          if (user) {
            // Invalidate all sessions for this user
            await updateUser(user.id, { refreshToken: undefined });

            await logAuditEntry({
              userId: user.id,
              username: user.username,
              action: 'auth.refresh.reuse_detected',
              resource: 'auth',
              details: { reason: 'token_reuse' },
              ip: request.ip,
              userAgent: request.headers['user-agent'] || 'unknown',
              success: false,
              errorMessage: 'Token reuse detected',
            });
          }

          return handleAuthError(reply, 401, 'TOKEN_REUSE', 'Invalid refresh token');
        }

        // Rotate tokens using utility
        const newTokens = rotateRefreshToken(fastify, refreshToken, {
          id: user.id,
          username: user.username,
          role: user.role,
        });

        if (!newTokens) {
          return handleAuthError(reply, 401, 'ROTATION_FAILED', 'Token rotation failed');
        }

        // Update refresh token
        await updateUser(user.id, { refreshToken: newTokens.refreshToken });

        await logAuditEntry({
          userId: user.id,
          username: user.username,
          action: 'auth.refresh.success',
          resource: 'auth',
          ip: request.ip,
          userAgent: request.headers['user-agent'] || 'unknown',
          success: true,
        });

        return reply.send({
          success: true,
          data: newTokens,
        });
      } catch (error) {
        fastify.log.error(error, 'Token refresh failed');
        return handleAuthError(reply, 500, 'REFRESH_ERROR', 'Token refresh failed');
      }
    }
  );

  // Get current user
  fastify.get('/auth/me', async (request, reply) => {
    try {
      if (!request.user) {
        return handleAuthError(reply, 401, 'UNAUTHORIZED', 'Not authenticated');
      }

      const user = await findUserById(request.user.id);

      if (!user) {
        return handleAuthError(reply, 404, 'USER_NOT_FOUND', 'User not found');
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
    } catch (error) {
      fastify.log.error(error, 'Failed to get current user');
      return handleAuthError(reply, 500, 'FETCH_ERROR', 'Failed to get user information');
    }
  });

  // Change password
  fastify.post<{ Body: z.infer<typeof changePasswordSchema> }>(
    '/auth/change-password',
    {
      schema: {
        body: changePasswordSchema,
      },
    },
    async (request, reply) => {
      try {
        if (!request.user) {
          return handleAuthError(reply, 401, 'UNAUTHORIZED', 'Not authenticated');
        }

        const { currentPassword, newPassword } = request.body;

        const user = await findUserById(request.user.id);

        if (!user) {
          return handleAuthError(reply, 404, 'USER_NOT_FOUND', 'User not found');
        }

        // Verify current password
        const validPassword = await verifyPassword(currentPassword, user.passwordHash);

        if (!validPassword) {
          await logAuditEntry({
            userId: request.user.id,
            username: request.user.username,
            action: 'auth.change-password.failed',
            resource: 'auth',
            details: { reason: 'invalid_current_password' },
            ip: request.ip,
            userAgent: request.headers['user-agent'] || 'unknown',
            success: false,
            errorMessage: 'Current password is incorrect',
          });

          return handleAuthError(reply, 400, 'INVALID_PASSWORD', 'Current password is incorrect');
        }

        // Validate new password strength
        const strengthCheck = validatePasswordStrength(newPassword);
        if (!strengthCheck.isValid) {
          return handleAuthError(
            reply,
            400,
            'WEAK_PASSWORD',
            'New password does not meet security requirements',
            strengthCheck.errors
          );
        }

        // Hash new password using utility
        const passwordHash = await hashPassword(newPassword);

        // Update password and invalidate all sessions
        await updateUser(user.id, { passwordHash, refreshToken: undefined });

        await logAuditEntry({
          userId: request.user.id,
          username: request.user.username,
          action: 'auth.change-password.success',
          resource: 'auth',
          ip: request.ip,
          userAgent: request.headers['user-agent'] || 'unknown',
          success: true,
        });

        return reply.send({
          success: true,
          message: 'Password changed successfully. Please log in again with your new password.',
        });
      } catch (error) {
        fastify.log.error(error, 'Password change failed');
        return handleAuthError(reply, 500, 'PASSWORD_CHANGE_ERROR', 'Failed to change password');
      }
    }
  );

  // List users (admin only) - Using RBAC middleware
  fastify.get(
    '/users',
    {
      preHandler: requireRole(['admin']),
    },
    async (request, reply) => {
      try {
        const users = await listUsers();

        await logAuditEntry({
          userId: request.user!.id,
          username: request.user!.username,
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
      } catch (error) {
        fastify.log.error(error, 'Failed to list users');
        return handleAuthError(reply, 500, 'LIST_ERROR', 'Failed to retrieve users');
      }
    }
  );

  // Create user (admin only) - Using RBAC middleware
  fastify.post<{ Body: z.infer<typeof createUserSchema> }>(
    '/users',
    {
      preHandler: requireRole(['admin']),
      schema: {
        body: createUserSchema,
      },
    },
    async (request, reply) => {
      try {
        const { username, password, role } = request.body;

        // Check if username already exists
        const existingUser = await findUserByUsername(username);
        if (existingUser) {
          return handleAuthError(reply, 409, 'USERNAME_EXISTS', 'Username already exists');
        }

        // Validate password strength
        const strengthCheck = validatePasswordStrength(password);
        if (!strengthCheck.isValid) {
          return handleAuthError(
            reply,
            400,
            'WEAK_PASSWORD',
            'Password does not meet security requirements',
            strengthCheck.errors
          );
        }

        // Hash password using utility
        const passwordHash = await hashPassword(password);

        // Create user
        const user = await createUser({
          username,
          passwordHash,
          role,
        });

        await logAuditEntry({
          userId: request.user!.id,
          username: request.user!.username,
          action: 'users.create',
          resource: 'users',
          resourceId: user.id,
          details: { role, username },
          ip: request.ip,
          userAgent: request.headers['user-agent'] || 'unknown',
          success: true,
        });

        return reply.status(201).send({
          success: true,
          data: {
            id: user.id,
            username: user.username,
            role: user.role,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
          },
        });
      } catch (error) {
        fastify.log.error(error, 'Failed to create user');
        return handleAuthError(reply, 500, 'CREATE_ERROR', 'Failed to create user');
      }
    }
  );

  // Update user (admin only) - Using RBAC middleware
  fastify.patch<{ Params: { id: string }; Body: z.infer<typeof updateUserSchema> }>(
    '/users/:id',
    {
      preHandler: requireRole(['admin']),
      schema: {
        body: updateUserSchema,
      },
    },
    async (request, reply) => {
      try {
        const { id } = request.params;
        const { role, password } = request.body;

        // Prevent self-demotion from admin
        if (id === request.user!.id && role && role !== 'admin') {
          return handleAuthError(
            reply,
            400,
            'SELF_DEMOTION',
            'You cannot demote yourself from admin'
          );
        }

        const user = await findUserById(id);

        if (!user) {
          return handleAuthError(reply, 404, 'USER_NOT_FOUND', 'User not found');
        }

        const updates: Parameters<typeof updateUser>[1] = {};

        if (role) {
          updates.role = role;
        }

        if (password) {
          // Validate password strength
          const strengthCheck = validatePasswordStrength(password);
          if (!strengthCheck.isValid) {
            return handleAuthError(
              reply,
              400,
              'WEAK_PASSWORD',
              'Password does not meet security requirements',
              strengthCheck.errors
            );
          }
          updates.passwordHash = await hashPassword(password);
        }

        const updatedUser = await updateUser(id, updates);

        await logAuditEntry({
          userId: request.user!.id,
          username: request.user!.username,
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
      } catch (error) {
        fastify.log.error(error, 'Failed to update user');
        return handleAuthError(reply, 500, 'UPDATE_ERROR', 'Failed to update user');
      }
    }
  );

  // Delete user (admin only) - Using RBAC middleware
  fastify.delete<{ Params: { id: string } }>(
    '/users/:id',
    {
      preHandler: requireRole(['admin']),
    },
    async (request, reply) => {
      try {
        const { id } = request.params;

        // Prevent deleting yourself
        if (id === request.user!.id) {
          return handleAuthError(reply, 400, 'SELF_DELETION', 'You cannot delete your own account');
        }

        const user = await findUserById(id);
        if (!user) {
          return handleAuthError(reply, 404, 'USER_NOT_FOUND', 'User not found');
        }

        const deleted = await deleteUser(id);

        if (!deleted) {
          return handleAuthError(reply, 500, 'DELETE_ERROR', 'Failed to delete user');
        }

        await logAuditEntry({
          userId: request.user!.id,
          username: request.user!.username,
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
      } catch (error) {
        fastify.log.error(error, 'Failed to delete user');
        return handleAuthError(reply, 500, 'DELETE_ERROR', 'Failed to delete user');
      }
    }
  );
}
