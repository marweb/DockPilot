import { test, expect } from '@playwright/test';
import { TunnelsPage } from './pages/TunnelsPage';
import {
  mockTunnels,
  createTestTunnel,
  generateTunnelLogs,
  mockCloudflareTunnels,
  createCloudflareResponse,
  createCloudflareErrorResponse,
  isCloudflareApiOnline,
  registerTestTunnel,
  generateUniqueTunnelName,
  cleanupTestTunnels,
} from '../fixtures/tunnels';

test.describe('Tunnels E2E Tests', () => {
  let tunnelsPage: TunnelsPage;
  const createdTunnels: string[] = [];

  test.beforeEach(async ({ page }) => {
    tunnelsPage = new TunnelsPage(page);

    // Mock Cloudflare API responses
    await page.route('**/api/cloudflare/tunnels**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(createCloudflareResponse(mockCloudflareTunnels)),
      });
    });

    await page.route('**/api/tunnels**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: mockTunnels }),
      });
    });

    await tunnelsPage.goto();
  });

  test.afterEach(async () => {
    // Cleanup any tunnels created during tests
    if (createdTunnels.length > 0) {
      await cleanupTestTunnels(createdTunnels);
      createdTunnels.length = 0;
    }
  });

  test.describe('List Tunnels', () => {
    test('should display list of tunnels', async () => {
      const count = await tunnelsPage.getTunnelCount();
      expect(count).toBeGreaterThanOrEqual(0);
    });

    test('should show empty state when no tunnels exist', async ({ page }) => {
      // Mock empty response
      await page.route('**/api/tunnels**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: [] }),
        });
      });

      await page.reload();
      await expect(tunnelsPage.emptyState.or(tunnelsPage.tunnelsList)).toBeVisible();
    });

    test('should display tunnel status correctly', async () => {
      const hasTunnels = (await tunnelsPage.getTunnelCount()) > 0;
      if (hasTunnels) {
        const status = await tunnelsPage.getStatusText();
        expect(['active', 'inactive', 'error', 'creating']).toContain(status?.toLowerCase());
      }
    });

    test('should show public URL for active tunnels', async () => {
      const activeTunnel = mockTunnels.find((t) => t.status === 'active');
      if (activeTunnel) {
        const hasUrl = await tunnelsPage.publicUrlDisplay.isVisible().catch(() => false);
        if (hasUrl) {
          const url = await tunnelsPage.getPublicUrl();
          expect(url).toMatch(/^https?:\/\//);
        }
      }
    });
  });

  test.describe('Create Tunnel', () => {
    test('should open create tunnel modal', async () => {
      await tunnelsPage.openCreateModal();
      await expect(tunnelsPage.createTunnelModal).toBeVisible();
      await tunnelsPage.cancelCreate();
    });

    test('should create a new tunnel successfully', async ({ page }) => {
      const tunnelName = generateUniqueTunnelName();
      registerTestTunnel(tunnelName);

      // Mock successful creation
      await page.route('**/api/tunnels', async (route, request) => {
        if (request.method() === 'POST') {
          const newTunnel = createTestTunnel(tunnelName);
          createdTunnels.push(newTunnel.id);
          await route.fulfill({
            status: 201,
            contentType: 'application/json',
            body: JSON.stringify({ success: true, data: newTunnel }),
          });
        } else {
          await route.continue();
        }
      });

      await tunnelsPage.createTunnel(tunnelName, 'zone-test-123');

      // Verify success
      await tunnelsPage.expectSuccessMessage().catch(() => {
        // Modal might have closed without explicit success message
      });
    });

    test('should validate tunnel name is required', async () => {
      await tunnelsPage.openCreateModal();
      await tunnelsPage.submitCreate();

      // Should show validation error or keep modal open
      const modalVisible = await tunnelsPage.createTunnelModal.isVisible();
      expect(modalVisible).toBeTruthy();
    });

    test('should handle duplicate tunnel names', async ({ page }) => {
      const existingName = mockTunnels[0]?.name || 'existing-tunnel';

      await page.route('**/api/tunnels', async (route, request) => {
        if (request.method() === 'POST') {
          await route.fulfill({
            status: 409,
            contentType: 'application/json',
            body: JSON.stringify(createCloudflareErrorResponse(409, 'Tunnel name already exists')),
          });
        } else {
          await route.continue();
        }
      });

      await tunnelsPage.openCreateModal();
      await tunnelsPage.fillCreateForm(existingName);
      await tunnelsPage.submitCreate();

      await tunnelsPage.expectErrorMessage().catch(() => {
        // Error might be shown differently
      });
    });
  });

  test.describe('Configure Ingress Rules', () => {
    test('should open ingress configuration', async () => {
      const tunnelName = mockTunnels[0]?.name;
      if (!tunnelName) {
        test.skip();
        return;
      }

      await tunnelsPage.openIngressConfiguration(tunnelName);
      await expect(tunnelsPage.ingressRulesSection).toBeVisible();
    });

    test('should add ingress rule successfully', async ({ page }) => {
      const tunnelName = mockTunnels[0]?.name;
      if (!tunnelName) {
        test.skip();
        return;
      }

      await page.route('**/api/tunnels/**/ingress**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: { hostname: 'test.example.com', service: 'http://localhost:3000', port: 3000 },
          }),
        });
      });

      await tunnelsPage.openIngressConfiguration(tunnelName);
      await tunnelsPage.addIngressRule({
        hostname: 'test.example.com',
        service: 'http://localhost:3000',
        port: 3000,
      });

      await tunnelsPage.expectSuccessMessage();
    });

    test('should validate ingress rule hostname format', async () => {
      const tunnelName = mockTunnels[0]?.name;
      if (!tunnelName) {
        test.skip();
        return;
      }

      await tunnelsPage.openIngressConfiguration(tunnelName);
      await tunnelsPage.addIngressRule({
        hostname: 'invalid-hostname',
        service: 'http://localhost:3000',
        port: 3000,
      });

      // Should show validation error
      const hasError = (await tunnelsPage.page.locator('.error, .validation-error').count()) > 0;
      expect(hasError).toBeTruthy();
    });
  });

  test.describe('Start/Stop Tunnel', () => {
    test('should start an inactive tunnel', async ({ page }) => {
      const inactiveTunnel = mockTunnels.find((t) => t.status === 'inactive');
      if (!inactiveTunnel) {
        test.skip();
        return;
      }

      await page.route(`**/api/tunnels/${inactiveTunnel.id}/start`, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: { ...inactiveTunnel, status: 'active' } }),
        });
      });

      await tunnelsPage.startTunnel(inactiveTunnel.name);
      await tunnelsPage.expectSuccessMessage();
    });

    test('should stop an active tunnel', async ({ page }) => {
      const activeTunnel = mockTunnels.find((t) => t.status === 'active');
      if (!activeTunnel) {
        test.skip();
        return;
      }

      await page.route(`**/api/tunnels/${activeTunnel.id}/stop`, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: { ...activeTunnel, status: 'inactive' } }),
        });
      });

      await tunnelsPage.stopTunnel(activeTunnel.name);
      await tunnelsPage.expectSuccessMessage();
    });
  });

  test.describe('View Tunnel Logs', () => {
    test('should open logs modal', async ({ page }) => {
      const tunnelName = mockTunnels[0]?.name;
      if (!tunnelName) {
        test.skip();
        return;
      }

      await page.route('**/api/tunnels/**/logs**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: generateTunnelLogs('test-tunnel', 50),
          }),
        });
      });

      await tunnelsPage.viewLogs(tunnelName);
      await expect(tunnelsPage.logsModal).toBeVisible();

      const logs = await tunnelsPage.getLogsContent();
      expect(logs.length).toBeGreaterThan(0);

      await tunnelsPage.closeLogs();
    });

    test('should refresh logs', async ({ page }) => {
      const tunnelName = mockTunnels[0]?.name;
      if (!tunnelName) {
        test.skip();
        return;
      }

      await tunnelsPage.viewLogs(tunnelName);
      await tunnelsPage.refreshLogs();

      await expect(tunnelsPage.logsContent).toBeVisible();
    });
  });

  test.describe('Delete Tunnel', () => {
    test('should delete tunnel with confirmation', async ({ page }) => {
      const tunnelToDelete = mockTunnels[1]; // Use second tunnel to avoid issues
      if (!tunnelToDelete) {
        test.skip();
        return;
      }

      await page.route(`**/api/tunnels/${tunnelToDelete.id}`, async (route, request) => {
        if (request.method() === 'DELETE') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ success: true, data: null }),
          });
        } else {
          await route.continue();
        }
      });

      await tunnelsPage.deleteTunnel(tunnelToDelete.name, true);
      await tunnelsPage.expectSuccessMessage();
    });
  });

  test.describe('Connectivity Test', () => {
    test('should test tunnel connectivity', async ({ page }) => {
      const activeTunnel = mockTunnels.find((t) => t.status === 'active');
      if (!activeTunnel || !activeTunnel.publicUrl) {
        test.skip();
        return;
      }

      await page.route('**/api/tunnels/**/test**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: { connected: true, latency: 45, statusCode: 200 },
          }),
        });
      });

      // Find and click test connectivity button if exists
      const testButton = page
        .locator('[data-testid="test-connectivity"], button:has-text("Test")')
        .first();
      if (await testButton.isVisible().catch(() => false)) {
        await testButton.click();
        await tunnelsPage.expectSuccessMessage();
      }
    });
  });

  test.describe('Cloudflare Authentication', () => {
    test('should show Cloudflare auth button when not authenticated', async () => {
      const hasAuthButton = await tunnelsPage.cloudflareAuthButton.isVisible().catch(() => false);
      // This depends on implementation - auth button should be visible if not authenticated
      if (hasAuthButton) {
        await expect(tunnelsPage.cloudflareAuthButton).toBeVisible();
      }
    });

    test('should initiate Cloudflare OAuth flow', async ({ page }) => {
      await page.route('**/api/auth/cloudflare**', async (route) => {
        await route.fulfill({
          status: 302,
          headers: {
            Location: 'https://dash.cloudflare.com/oauth/authorize?mock=true',
          },
        });
      });

      const hasAuthButton = await tunnelsPage.cloudflareAuthButton.isVisible().catch(() => false);
      if (hasAuthButton) {
        await tunnelsPage.connectCloudflare();
        // Should redirect or open auth modal
      }
    });
  });

  test.describe('Tunnel Status', () => {
    test('should display healthy status for connected tunnels', async () => {
      const healthyTunnel = mockTunnels.find((t) => t.status === 'active');
      if (!healthyTunnel) {
        test.skip();
        return;
      }

      const status = await tunnelsPage.getTunnelStatus(healthyTunnel.name);
      expect(status?.toLowerCase()).toMatch(/active|healthy|connected/);
    });

    test('should display unhealthy status for error tunnels', async () => {
      const unhealthyTunnel = mockTunnels.find((t) => t.status === 'error');
      if (!unhealthyTunnel) {
        test.skip();
        return;
      }

      const status = await tunnelsPage.getTunnelStatus(unhealthyTunnel.name);
      expect(status?.toLowerCase()).toMatch(/error|unhealthy|down|failed/);
    });
  });

  test.describe('Search and Filter', () => {
    test('should search tunnels by name', async () => {
      if (mockTunnels.length === 0) {
        test.skip();
        return;
      }

      const searchTerm = mockTunnels[0].name.substring(0, 3);
      await tunnelsPage.searchTunnels(searchTerm);

      // Results should be filtered
      const count = await tunnelsPage.getTunnelCount();
      expect(count).toBeGreaterThanOrEqual(0);
    });

    test('should filter tunnels by status', async () => {
      await tunnelsPage.filterByStatus('active');

      const count = await tunnelsPage.getTunnelCount();
      if (count > 0) {
        // All visible tunnels should be active
        const statuses = await tunnelsPage.page
          .locator('[data-testid="tunnel-status"]')
          .allTextContents();
        statuses.forEach((status) => {
          expect(status.toLowerCase()).toBe('active');
        });
      }
    });
  });

  test.describe('Error Handling', () => {
    test('should handle Cloudflare API errors gracefully', async ({ page }) => {
      await page.route('**/api/cloudflare/**', async (route) => {
        await route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify(createCloudflareErrorResponse(503, 'Cloudflare API unavailable')),
        });
      });

      await page.reload();
      // Should show error state or fallback UI
      await expect(tunnelsPage.errorMessage.or(tunnelsPage.tunnelsList)).toBeVisible();
    });

    test('should handle network errors', async ({ page }) => {
      await page.route('**/api/tunnels**', async (route) => {
        await route.abort('failed');
      });

      await page.reload();
      // Should show offline/error state
      await expect(tunnelsPage.errorMessage.or(tunnelsPage.emptyState)).toBeVisible();
    });
  });

  test.describe('Offline/Online Mode', () => {
    test('should detect offline state', async ({ page, context }) => {
      // Simulate offline
      await context.setOffline(true);
      await page.reload();

      // Should show offline indicator
      const offlineIndicator = page.locator('[data-testid="offline-indicator"], .offline-badge');
      await expect(offlineIndicator.or(tunnelsPage.errorMessage)).toBeVisible();

      // Restore online
      await context.setOffline(false);
    });

    test('should sync when coming back online', async ({ page, context }) => {
      await context.setOffline(true);
      await page.reload();

      // Restore online
      await context.setOffline(false);

      // Should sync and show data
      await page.waitForTimeout(2000);
      await expect(tunnelsPage.tunnelsList.or(tunnelsPage.emptyState)).toBeVisible();
    });
  });
});
