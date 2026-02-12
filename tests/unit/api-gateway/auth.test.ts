import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import Fastify from 'fastify';
import jwt from '@fastify/jwt';
import { authRoutes } from '../../../services/api-gateway/src/routes/auth.js';
import * as database from '../../../services/api-gateway/src/services/database.js';
import * as argon2 from 'argon2';
import { mockAdminUser, mockUsers, mockTokens } from '../../fixtures/data.js';

// Mock the database module
vi.mock('../../../services/api-gateway/src/services/database.js', () => ({
  isSetupComplete: vi.fn(),
  completeSetup: vi.fn(),
  findUserByUsername: vi.fn(),
  findUserById: vi.fn(),
  createUser: vi.fn(),
  updateUser: vi.fn(),
  listUsers: vi.fn(),
  deleteUser: vi.fn(),
  addAuditLog: vi.fn(),
}));

// Mock argon2
vi.mock('argon2', () => ({
  verify: vi.fn(),
  hash: vi.fn(),
}));

describe('Auth Routes', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = Fastify();
    await app.register(jwt, { secret: 'test-secret' });
    app.decorate('config', {
      jwtExpiresIn: '15m',
      refreshTokenExpiresIn: '7d',
    });
    await app.register(authRoutes, { prefix: '/api' });
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('GET /api/auth/setup-status', () => {
    it('should return setup status as incomplete', async () => {
      vi.mocked(database.isSetupComplete).mockResolvedValue(false);

      const response = await app.inject({
        method: 'GET',
        url: '/api/auth/setup-status',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.data.setupComplete).toBe(false);
    });

    it('should return setup status as complete', async () => {
      vi.mocked(database.isSetupComplete).mockResolvedValue(true);

      const response = await app.inject({
        method: 'GET',
        url: '/api/auth/setup-status',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.data.setupComplete).toBe(true);
    });
  });

  describe('POST /api/auth/setup', () => {
    it('should complete initial setup successfully', async () => {
      vi.mocked(database.isSetupComplete).mockResolvedValue(false);
      vi.mocked(database.findUserByUsername).mockResolvedValue(null);
      vi.mocked(argon2.hash).mockResolvedValue('hashed-password' as never);
      vi.mocked(database.createUser).mockResolvedValue(mockAdminUser);
      vi.mocked(database.completeSetup).mockResolvedValue(undefined);
      vi.mocked(database.updateUser).mockResolvedValue(mockAdminUser);

      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/setup',
        payload: {
          username: 'admin',
          password: 'SecurePass123!',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.data.user.username).toBe('admin');
      expect(body.data.user.role).toBe('admin');
      expect(body.data.tokens).toHaveProperty('accessToken');
      expect(body.data.tokens).toHaveProperty('refreshToken');
    });

    it('should reject setup when already completed', async () => {
      vi.mocked(database.isSetupComplete).mockResolvedValue(true);

      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/setup',
        payload: {
          username: 'admin',
          password: 'SecurePass123!',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(false);
      expect(body.error).toBe('Setup already completed');
    });

    it('should reject setup with invalid username', async () => {
      vi.mocked(database.isSetupComplete).mockResolvedValue(false);

      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/setup',
        payload: {
          username: 'ab',
          password: 'SecurePass123!',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should reject setup with weak password', async () => {
      vi.mocked(database.isSetupComplete).mockResolvedValue(false);

      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/setup',
        payload: {
          username: 'admin',
          password: '123',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should reject setup with duplicate username', async () => {
      vi.mocked(database.isSetupComplete).mockResolvedValue(false);
      vi.mocked(database.findUserByUsername).mockResolvedValue(mockAdminUser);

      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/setup',
        payload: {
          username: 'admin',
          password: 'SecurePass123!',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.payload);
      expect(body.error).toBe('Username already exists');
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login successfully with valid credentials', async () => {
      vi.mocked(database.findUserByUsername).mockResolvedValue(mockAdminUser);
      vi.mocked(argon2.verify).mockResolvedValue(true as never);
      vi.mocked(database.updateUser).mockResolvedValue(mockAdminUser);
      vi.mocked(database.addAuditLog).mockResolvedValue();

      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          username: 'admin',
          password: 'correct-password',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.data.user.username).toBe('admin');
      expect(body.data.tokens).toHaveProperty('accessToken');
      expect(body.data.tokens).toHaveProperty('refreshToken');
    });

    it('should reject login with invalid username', async () => {
      vi.mocked(database.findUserByUsername).mockResolvedValue(null);
      vi.mocked(database.addAuditLog).mockResolvedValue();

      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          username: 'nonexistent',
          password: 'some-password',
        },
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(false);
      expect(body.error).toBe('Invalid credentials');
    });

    it('should reject login with invalid password', async () => {
      vi.mocked(database.findUserByUsername).mockResolvedValue(mockAdminUser);
      vi.mocked(argon2.verify).mockResolvedValue(false as never);
      vi.mocked(database.addAuditLog).mockResolvedValue();

      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          username: 'admin',
          password: 'wrong-password',
        },
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.payload);
      expect(body.error).toBe('Invalid credentials');
    });

    it('should reject login with missing username', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          password: 'some-password',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should reject login with missing password', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          username: 'admin',
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should logout successfully', async () => {
      vi.mocked(database.updateUser).mockResolvedValue(mockAdminUser);
      vi.mocked(database.addAuditLog).mockResolvedValue();

      // Create a request with user context
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/logout',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.message).toBe('Logged out successfully');
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('should refresh token successfully', async () => {
      const refreshToken = app.jwt.sign(
        { id: mockAdminUser.id, type: 'refresh' },
        { expiresIn: '7d' }
      );

      vi.mocked(database.findUserById).mockResolvedValue({
        ...mockAdminUser,
        refreshToken,
      });
      vi.mocked(database.updateUser).mockResolvedValue(mockAdminUser);

      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/refresh',
        payload: { refreshToken },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.data).toHaveProperty('accessToken');
      expect(body.data).toHaveProperty('refreshToken');
    });

    it('should reject refresh with missing token', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/refresh',
        payload: {},
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.payload);
      expect(body.error).toBe('Refresh token required');
    });

    it('should reject refresh with invalid token type', async () => {
      const invalidToken = app.jwt.sign(
        { id: mockAdminUser.id, type: 'access' },
        { expiresIn: '7d' }
      );

      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/refresh',
        payload: { refreshToken: invalidToken },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.payload);
      expect(body.error).toBe('Invalid token type');
    });

    it('should reject refresh with invalid token', async () => {
      const validToken = app.jwt.sign(
        { id: mockAdminUser.id, type: 'refresh' },
        { expiresIn: '7d' }
      );

      vi.mocked(database.findUserById).mockResolvedValue(null);

      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/refresh',
        payload: { refreshToken: validToken },
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.payload);
      expect(body.error).toBe('Invalid refresh token');
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return current user info', async () => {
      vi.mocked(database.findUserById).mockResolvedValue(mockAdminUser);

      // Create a request with authenticated user
      const token = app.jwt.sign({
        id: mockAdminUser.id,
        username: mockAdminUser.username,
        role: mockAdminUser.role,
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.data.username).toBe('admin');
    });

    it('should return 401 when not authenticated', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.payload);
      expect(body.error).toBe('Not authenticated');
    });
  });

  describe('POST /api/auth/change-password', () => {
    it('should change password successfully', async () => {
      vi.mocked(database.findUserById).mockResolvedValue(mockAdminUser);
      vi.mocked(argon2.verify).mockResolvedValue(true as never);
      vi.mocked(argon2.hash).mockResolvedValue('new-hashed-password' as never);
      vi.mocked(database.updateUser).mockResolvedValue(mockAdminUser);
      vi.mocked(database.addAuditLog).mockResolvedValue();

      const token = app.jwt.sign({
        id: mockAdminUser.id,
        username: mockAdminUser.username,
        role: mockAdminUser.role,
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/change-password',
        headers: {
          authorization: `Bearer ${token}`,
        },
        payload: {
          currentPassword: 'old-password',
          newPassword: 'NewSecurePass123!',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.message).toBe('Password changed successfully');
    });

    it('should reject change password with incorrect current password', async () => {
      vi.mocked(database.findUserById).mockResolvedValue(mockAdminUser);
      vi.mocked(argon2.verify).mockResolvedValue(false as never);

      const token = app.jwt.sign({
        id: mockAdminUser.id,
        username: mockAdminUser.username,
        role: mockAdminUser.role,
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/change-password',
        headers: {
          authorization: `Bearer ${token}`,
        },
        payload: {
          currentPassword: 'wrong-password',
          newPassword: 'NewSecurePass123!',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.payload);
      expect(body.error).toBe('Current password is incorrect');
    });

    it('should reject change password with weak new password', async () => {
      const token = app.jwt.sign({
        id: mockAdminUser.id,
        username: mockAdminUser.username,
        role: mockAdminUser.role,
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/change-password',
        headers: {
          authorization: `Bearer ${token}`,
        },
        payload: {
          currentPassword: 'old-password',
          newPassword: '123',
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });
});
