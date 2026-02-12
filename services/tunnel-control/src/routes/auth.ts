import type { FastifyInstance } from 'fastify';
import {
  CloudflareAuthSchema,
  CloudflareLoginSchema,
  type CloudflareAuthInput,
  type CloudflareLoginInput,
} from '../schemas/index.js';
import {
  authenticate,
  isAuthenticated,
  getCurrentAccountId,
  clearAuthentication,
  getAccountInfo,
  CloudflareAPIError,
} from '../services/cloudflare-api.js';
import {
  saveCredentials,
  loadCredentials,
  deleteCredentials,
  listStoredAccounts,
} from '../services/credentials.js';
import { loginWithCloudflare, checkAuthStatus, logout } from '../services/cloudflared.js';
import { getLogger } from '../utils/logger.js';

const logger = getLogger();

export async function authRoutes(fastify: FastifyInstance) {
  // Login with API token
  fastify.post<{
    Body: CloudflareAuthInput;
  }>(
    '/tunnels/auth/login',
    {
      schema: {
        body: CloudflareAuthSchema,
      },
    },
    async (request, reply) => {
      try {
        const { apiToken, accountId } = request.body;

        logger.info({ accountId }, 'Attempting Cloudflare authentication');

        // Validate token with Cloudflare API
        await authenticate(apiToken, accountId);

        // Get account info
        const accountInfo = await getAccountInfo(accountId);

        // Save credentials securely
        await saveCredentials(accountId, {
          apiToken,
          accountId,
          email: undefined,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });

        logger.info(
          { accountId, accountName: accountInfo.name },
          'Cloudflare authentication successful'
        );

        return reply.send({
          success: true,
          message: 'Authentication successful',
          data: {
            authenticated: true,
            accountId,
            accountName: accountInfo.name,
          },
        });
      } catch (error) {
        logger.error({ error }, 'Cloudflare authentication failed');

        if (error instanceof CloudflareAPIError) {
          return reply.status(error.statusCode).send({
            success: false,
            error: {
              code: 'AUTH_FAILED',
              message: error.message,
              details: error.code ? { cloudflareCode: error.code } : undefined,
            },
          });
        }

        return reply.status(400).send({
          success: false,
          error: {
            code: 'AUTH_FAILED',
            message: (error as Error).message,
          },
        });
      }
    }
  );

  // OAuth login (via cloudflared)
  fastify.post<{
    Body: CloudflareLoginInput;
  }>(
    '/tunnels/auth/login/oauth',
    {
      schema: {
        body: CloudflareLoginSchema,
      },
    },
    async (_request, reply) => {
      try {
        const result = await loginWithCloudflare();

        logger.info('OAuth login initiated');

        return reply.send({
          success: true,
          message: 'Please open the provided URL in your browser to complete authentication',
          data: {
            loginUrl: result.url,
            method: 'oauth',
          },
        });
      } catch (error) {
        logger.error({ error }, 'OAuth login failed');

        return reply.status(400).send({
          success: false,
          error: {
            code: 'OAUTH_FAILED',
            message: (error as Error).message,
          },
        });
      }
    }
  );

  // Logout
  fastify.post('/tunnels/auth/logout', async (_request, reply) => {
    try {
      const currentAccount = getCurrentAccountId();

      // Stop all tunnels and logout from cloudflared
      await logout();

      // Clear local authentication
      clearAuthentication();

      // Delete stored credentials if exists
      if (currentAccount) {
        await deleteCredentials(currentAccount);
      }

      logger.info('Logout successful');

      return reply.send({
        success: true,
        message: 'Logged out successfully',
      });
    } catch (error) {
      logger.error({ error }, 'Logout failed');

      // Even if logout fails, clear local auth
      clearAuthentication();

      return reply.status(500).send({
        success: false,
        error: {
          code: 'LOGOUT_ERROR',
          message: (error as Error).message,
        },
      });
    }
  });

  // Check auth status
  fastify.get('/tunnels/auth/status', async (_request, reply) => {
    try {
      // Check cloudflared status
      const cloudflaredStatus = await checkAuthStatus();

      // Check if we have stored credentials
      const accounts = await listStoredAccounts();
      const hasCredentials = accounts.length > 0;

      const status = {
        authenticated: isAuthenticated() || cloudflaredStatus.authenticated,
        method: hasCredentials ? 'api_token' : cloudflaredStatus.authenticated ? 'oauth' : null,
        accountId: getCurrentAccountId() || cloudflaredStatus.accountId,
        accountName: cloudflaredStatus.accountId,
        hasStoredCredentials: hasCredentials,
        accounts: accounts,
      };

      return reply.send({
        success: true,
        data: status,
      });
    } catch (error) {
      logger.error({ error }, 'Failed to check auth status');

      return reply.status(500).send({
        success: false,
        error: {
          code: 'STATUS_ERROR',
          message: (error as Error).message,
        },
      });
    }
  });

  // Get account information
  fastify.get('/tunnels/auth/account', async (_request, reply) => {
    try {
      const accountId = getCurrentAccountId();

      if (!accountId) {
        return reply.status(401).send({
          success: false,
          error: {
            code: 'NOT_AUTHENTICATED',
            message: 'Not authenticated with Cloudflare',
          },
        });
      }

      const accountInfo = await getAccountInfo(accountId);

      return reply.send({
        success: true,
        data: {
          id: accountInfo.id,
          name: accountInfo.name,
        },
      });
    } catch (error) {
      logger.error({ error }, 'Failed to get account info');

      if (error instanceof CloudflareAPIError) {
        return reply.status(error.statusCode).send({
          success: false,
          error: {
            code: 'API_ERROR',
            message: error.message,
          },
        });
      }

      return reply.status(500).send({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: (error as Error).message,
        },
      });
    }
  });

  // List stored accounts
  fastify.get('/tunnels/auth/accounts', async (_request, reply) => {
    try {
      const accounts = await listStoredAccounts();
      const accountsData = [];

      for (const accountId of accounts) {
        const creds = await loadCredentials(accountId);
        if (creds) {
          accountsData.push({
            accountId: creds.accountId,
            createdAt: creds.createdAt,
            updatedAt: creds.updatedAt,
          });
        }
      }

      return reply.send({
        success: true,
        data: accountsData,
      });
    } catch (error) {
      logger.error({ error }, 'Failed to list accounts');

      return reply.status(500).send({
        success: false,
        error: {
          code: 'LIST_ERROR',
          message: (error as Error).message,
        },
      });
    }
  });
}
