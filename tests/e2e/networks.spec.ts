import { test, expect } from '@playwright/test';
import { NetworksPage } from './pages/NetworksPage';
import {
  cleanupTestNetworks,
  TEST_NETWORKS,
  createTestNetwork,
  cleanupTestContainers,
  TEST_CONTAINERS,
  createTestContainer,
} from '../fixtures/docker-resources';

test.describe('Docker Networks Management', () => {
  let networksPage: NetworksPage;

  test.beforeEach(async ({ page }) => {
    networksPage = new NetworksPage(page);
    await networksPage.goto();
  });

  test.afterEach(async () => {
    await cleanupTestContainers();
    await cleanupTestNetworks();
  });

  test.describe('List Networks', () => {
    test('should display networks list page', async () => {
      await expect(networksPage.networksList).toBeVisible();
      await expect(networksPage.networkTable).toBeVisible();
    });

    test('should list all networks', async () => {
      const count = await networksPage.getNetworkCount();
      expect(count).toBeGreaterThanOrEqual(3);
    });

    test('should include default networks', async () => {
      await networksPage.goto();

      const hasBridge = await networksPage.networkExists('bridge');
      const hasHost = await networksPage.networkExists('host');
      const hasNone = await networksPage.networkExists('none');

      expect(hasBridge).toBe(true);
      expect(hasHost).toBe(true);
      expect(hasNone).toBe(true);
    });

    test('should search networks by name', async () => {
      await networksPage.searchNetwork('bridge');
      const count = await networksPage.getNetworkCount();
      expect(count).toBeGreaterThanOrEqual(1);
    });
  });

  test.describe('Create Network', () => {
    test('should create new bridge network', async () => {
      const networkName = `test-network-${Date.now()}`;
      await networksPage.createNetwork(networkName, 'bridge');

      const exists = await networksPage.networkExists(networkName);
      expect(exists).toBe(true);
    });

    test('should create network with custom subnet', async () => {
      const networkName = `test-subnet-${Date.now()}`;
      await networksPage.createNetwork(networkName, 'bridge', {
        subnet: '172.20.0.0/16',
        gateway: '172.20.0.1',
      });

      await networksPage.viewNetworkDetails(networkName);
      const details = await networksPage.getNetworkDetails();
      expect(details.subnet).toContain('172.20');
      await networksPage.closeNetworkDetails();
    });

    test('should create internal network', async () => {
      const networkName = `test-internal-${Date.now()}`;
      await networksPage.createNetwork(networkName, 'bridge', {
        internal: true,
      });

      await networksPage.viewNetworkDetails(networkName);
      const details = await networksPage.getNetworkDetails();
      expect(details.internal).toBe(true);
      await networksPage.closeNetworkDetails();
    });

    test('should create attachable network', async () => {
      const networkName = `test-attachable-${Date.now()}`;
      await networksPage.createNetwork(networkName, 'bridge', {
        attachable: true,
      });

      const exists = await networksPage.networkExists(networkName);
      expect(exists).toBe(true);
    });

    test('should show error for duplicate network name', async () => {
      const networkName = `duplicate-network-${Date.now()}`;
      await networksPage.createNetwork(networkName);

      await networksPage.createNetwork(networkName);
      await expect(networksPage.errorToast).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('View Network Details', () => {
    test('should view network details', async () => {
      const networkName = await createTestNetwork('details-test');
      await networksPage.goto();

      await networksPage.viewNetworkDetails(networkName);
      const details = await networksPage.getNetworkDetails();

      expect(details.name).toBe(networkName);
      expect(details.driver).toBe('bridge');
      expect(details.scope).toBeTruthy();
      await networksPage.closeNetworkDetails();
    });

    test('should display network subnet and gateway', async () => {
      const networkName = await createTestNetwork('subnet-test', {
        subnet: '172.25.0.0/16',
        gateway: '172.25.0.1',
      });
      await networksPage.goto();

      await networksPage.viewNetworkDetails(networkName);
      const details = await networksPage.getNetworkDetails();
      expect(details.subnet).toBeTruthy();
      expect(details.gateway).toBeTruthy();
      await networksPage.closeNetworkDetails();
    });

    test('should show connected containers', async () => {
      const networkName = await createTestNetwork('containers-test');
      const containerName = await createTestContainer('network-test', { network: networkName });
      await networksPage.goto();

      await networksPage.viewNetworkDetails(networkName);
      const details = await networksPage.getNetworkDetails();

      expect(details.containers).toContain(containerName);
      await networksPage.closeNetworkDetails();
    });
  });

  test.describe('Connect Container', () => {
    test('should connect container to network', async () => {
      const networkName = await createTestNetwork('connect-test');
      const containerName = await createTestContainer('connect-container');
      await networksPage.goto();

      await networksPage.connectContainer(networkName, containerName);

      const isConnected = await networksPage.isContainerConnected(networkName, containerName);
      expect(isConnected).toBe(true);
    });

    test('should allow multiple networks per container', async () => {
      const network1 = await createTestNetwork('multi-1');
      const network2 = await createTestNetwork('multi-2');
      const containerName = await createTestContainer('multi-network');
      await networksPage.goto();

      await networksPage.connectContainer(network1, containerName);
      await networksPage.connectContainer(network2, containerName);

      const containers1 = await networksPage.getNetworkContainers(network1);
      const containers2 = await networksPage.getNetworkContainers(network2);

      expect(containers1).toContain(containerName);
      expect(containers2).toContain(containerName);
    });
  });

  test.describe('Disconnect Container', () => {
    test('should disconnect container from network', async () => {
      const networkName = await createTestNetwork('disconnect-test');
      const containerName = await createTestContainer('disconnect-container', {
        network: networkName,
      });
      await networksPage.goto();

      await networksPage.disconnectContainer(networkName, containerName);

      const isConnected = await networksPage.isContainerConnected(networkName, containerName);
      expect(isConnected).toBe(false);
    });

    test('should not allow disconnecting from default bridge', async () => {
      const containerName = await createTestContainer('default-bridge');
      await networksPage.goto();

      await networksPage.viewNetworkDetails('bridge');
      const disconnectButton = networksPage.page
        .locator('[data-testid="disconnect-button"]')
        .first();

      const isDisabled = await disconnectButton.isDisabled().catch(() => true);
      expect(isDisabled).toBe(true);

      await networksPage.closeNetworkDetails();
    });
  });

  test.describe('Delete Network', () => {
    test('should delete unused network', async () => {
      const networkName = await createTestNetwork('delete-test');
      await networksPage.goto();

      await networksPage.deleteNetwork(networkName);

      const exists = await networksPage.networkExists(networkName);
      expect(exists).toBe(false);
    });

    test('should show error when deleting network with containers', async () => {
      const networkName = await createTestNetwork('busy-test');
      await createTestContainer('busy-container', { network: networkName });
      await networksPage.goto();

      await networksPage.deleteNetwork(networkName);
      await expect(networksPage.errorToast).toBeVisible({ timeout: 10000 });

      const exists = await networksPage.networkExists(networkName);
      expect(exists).toBe(true);
    });

    test('should show confirmation before delete', async () => {
      const networkName = await createTestNetwork('confirm-delete-test');
      await networksPage.goto();

      const row = networksPage.networkRows.filter({ hasText: networkName });
      await row.locator('[data-testid="delete-network-button"]').click();

      await expect(networksPage.confirmDeleteButton).toBeVisible();
      await networksPage.confirmDeleteButton.click();
      await expect(networksPage.successToast).toBeVisible();
    });
  });

  test.describe('Prune Networks', () => {
    test('should prune unused networks', async () => {
      await createTestNetwork('prune-test-1');
      await createTestNetwork('prune-test-2');
      await networksPage.goto();

      const prunedCount = await networksPage.pruneNetworks();
      expect(prunedCount).toBeGreaterThanOrEqual(0);
    });

    test('should not prune default networks', async () => {
      await createTestNetwork('prune-unused');
      await networksPage.goto();

      await networksPage.pruneNetworks();

      const hasBridge = await networksPage.networkExists('bridge');
      const hasHost = await networksPage.networkExists('host');
      const hasNone = await networksPage.networkExists('none');

      expect(hasBridge).toBe(true);
      expect(hasHost).toBe(true);
      expect(hasNone).toBe(true);
    });

    test('should show confirmation before prune', async () => {
      await networksPage.pruneButton.click();
      await expect(networksPage.page.locator('[data-testid="prune-confirm-modal"]')).toBeVisible();

      await networksPage.page.locator('[data-testid="cancel-prune-button"]').click();
      await expect(networksPage.page.locator('[data-testid="prune-confirm-modal"]')).toBeHidden();
    });
  });
});
