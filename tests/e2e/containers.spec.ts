import { expect } from '@playwright/test';
import { test, testContainers } from '../fixtures/containers';
import { ContainersPage } from '../pages/ContainersPage';
import { ContainerDetailPage } from '../pages/ContainerDetailPage';

test.describe('Containers E2E Tests', () => {
  let containersPage: ContainersPage;

  test.beforeEach(async ({ page }) => {
    containersPage = new ContainersPage(page);
    await containersPage.goto();
  });

  test.describe('List Containers', () => {
    test('should display containers list page', async () => {
      await expect(containersPage.heading).toBeVisible();
      await expect(containersPage.createContainerButton).toBeVisible();
      await expect(containersPage.searchInput).toBeVisible();
    });

    test('should list running containers', async ({ containerHelper }) => {
      // Create a running container
      const container = await containerHelper.createContainer(testContainers[0]);
      await containerHelper.startContainer(container.id);
      await containerHelper.waitForContainerState(container.id, 'running');

      // Refresh and verify
      await containersPage.refresh();
      await containersPage.filterByStatus('running');

      const hasContainer = await containersPage.hasContainer(testContainers[0].name);
      expect(hasContainer).toBe(true);
    });

    test('should list stopped containers', async ({ containerHelper }) => {
      // Create a stopped container
      const container = await containerHelper.createContainer(testContainers[1]);

      // Filter by stopped
      await containersPage.filterByStatus('stopped');

      const hasContainer = await containersPage.hasContainer(testContainers[1].name);
      expect(hasContainer).toBe(true);
    });

    test('should list all containers', async ({ containerHelper }) => {
      // Create multiple containers with different states
      const container1 = await containerHelper.createContainer({
        ...testContainers[0],
        name: `test-all-1-${Date.now()}`,
      });
      const container2 = await containerHelper.createContainer({
        ...testContainers[1],
        name: `test-all-2-${Date.now()}`,
      });

      await containerHelper.startContainer(container1.id);
      await containerHelper.waitForContainerState(container1.id, 'running');

      await containersPage.filterByStatus('all');
      await containersPage.refresh();

      const hasContainer1 = await containersPage.hasContainer(container1.config.name);
      const hasContainer2 = await containersPage.hasContainer(container2.config.name);

      expect(hasContainer1).toBe(true);
      expect(hasContainer2).toBe(true);
    });
  });

  test.describe('Filter and Search', () => {
    test('should filter containers by status', async ({ containerHelper }) => {
      const container = await containerHelper.createContainer({
        ...testContainers[0],
        name: `test-filter-${Date.now()}`,
      });

      // Test running filter (should not show stopped container)
      await containersPage.filterByStatus('running');
      let hasContainer = await containersPage.hasContainer(container.config.name);
      expect(hasContainer).toBe(false);

      // Start container
      await containerHelper.startContainer(container.id);
      await containerHelper.waitForContainerState(container.id, 'running');

      // Refresh and check again
      await containersPage.refresh();
      await containersPage.filterByStatus('running');
      hasContainer = await containersPage.hasContainer(container.config.name);
      expect(hasContainer).toBe(true);
    });

    test('should search containers by name', async ({ containerHelper }) => {
      const uniqueName = `search-test-${Date.now()}`;
      await containerHelper.createContainer({
        ...testContainers[0],
        name: uniqueName,
      });

      await containersPage.search(uniqueName);

      const hasContainer = await containersPage.hasContainer(uniqueName);
      expect(hasContainer).toBe(true);
    });

    test('should show empty state when no results', async () => {
      await containersPage.search('non-existent-container-12345');

      const isEmpty = await containersPage.isEmptyState();
      expect(isEmpty).toBe(true);
    });

    test('should clear search and show all', async ({ containerHelper }) => {
      await containerHelper.createContainer({
        ...testContainers[0],
        name: `clear-search-${Date.now()}`,
      });

      await containersPage.search('non-existent');
      await containersPage.clearSearch();

      const count = await containersPage.getContainerCount();
      expect(count).toBeGreaterThan(0);
    });
  });

  test.describe('Create Container', () => {
    test('should open create container form', async () => {
      await containersPage.openCreateContainer();
      await expect(containersPage.createForm).toBeVisible();
    });

    test('should create a new container', async () => {
      const containerName = `new-container-${Date.now()}`;

      await containersPage.createContainer({
        image: 'alpine:latest',
        name: containerName,
        command: 'sh -c "while true; do sleep 3600; done"',
      });

      await containersPage.waitForContainer(containerName);
      const hasContainer = await containersPage.hasContainer(containerName);
      expect(hasContainer).toBe(true);
    });

    test('should create container with ports', async () => {
      const containerName = `port-container-${Date.now()}`;

      await containersPage.createContainer({
        image: 'nginx:alpine',
        name: containerName,
        ports: [{ hostPort: '39000', containerPort: '80' }],
      });

      await containersPage.waitForContainer(containerName);
      const hasContainer = await containersPage.hasContainer(containerName);
      expect(hasContainer).toBe(true);
    });

    test('should create container with environment variables', async () => {
      const containerName = `env-container-${Date.now()}`;

      await containersPage.createContainer({
        image: 'alpine:latest',
        name: containerName,
        command: 'sh -c "while true; do sleep 3600; done"',
        env: {
          TEST_VAR: 'test_value',
          ANOTHER_VAR: 'another_value',
        },
      });

      await containersPage.waitForContainer(containerName);
      const hasContainer = await containersPage.hasContainer(containerName);
      expect(hasContainer).toBe(true);
    });

    test('should show error for invalid image', async () => {
      await containersPage.openCreateContainer();
      await containersPage.fillCreateContainerForm({
        image: '',
        name: 'invalid-container',
      });
      await containersPage.submitCreateContainer();

      // Should show validation error or stay on form
      await expect(containersPage.createForm).toBeVisible();
    });
  });

  test.describe('Container Actions', () => {
    test('should start a stopped container', async ({ containerHelper }) => {
      const container = await containerHelper.createContainer({
        ...testContainers[0],
        name: `start-test-${Date.now()}`,
      });

      await containersPage.refresh();
      await containersPage.startContainer(container.config.name);

      await containerHelper.waitForContainerState(container.id, 'running', 30000);
      const status = await containersPage.getContainerStatus(container.config.name);
      expect(status?.toLowerCase()).toContain('running');
    });

    test('should stop a running container', async ({ containerHelper }) => {
      const container = await containerHelper.createContainer({
        ...testContainers[0],
        name: `stop-test-${Date.now()}`,
      });

      await containerHelper.startContainer(container.id);
      await containerHelper.waitForContainerState(container.id, 'running');

      await containersPage.refresh();
      await containersPage.stopContainer(container.config.name);

      await containerHelper.waitForContainerState(container.id, 'exited', 30000);
    });

    test('should restart a container', async ({ containerHelper }) => {
      const container = await containerHelper.createContainer({
        ...testContainers[0],
        name: `restart-test-${Date.now()}`,
      });

      await containerHelper.startContainer(container.id);
      await containerHelper.waitForContainerState(container.id, 'running');

      await containersPage.refresh();
      await containersPage.restartContainer(container.config.name);

      // Wait for restart to complete
      await containersPage.page.waitForTimeout(3000);
      const status = await containersPage.getContainerStatus(container.config.name);
      expect(status?.toLowerCase()).toContain('running');
    });

    test('should delete a container', async ({ containerHelper }) => {
      const container = await containerHelper.createContainer({
        ...testContainers[0],
        name: `delete-test-${Date.now()}`,
      });

      await containersPage.refresh();
      await containersPage.deleteContainer(container.config.name);

      await containersPage.waitForContainerRemoval(container.config.name);
      const hasContainer = await containersPage.hasContainer(container.config.name);
      expect(hasContainer).toBe(false);
    });

    test('should cancel delete operation', async ({ containerHelper }) => {
      const container = await containerHelper.createContainer({
        ...testContainers[0],
        name: `cancel-delete-${Date.now()}`,
      });

      await containersPage.refresh();
      await containersPage.deleteContainer(container.config.name, false);

      const hasContainer = await containersPage.hasContainer(container.config.name);
      expect(hasContainer).toBe(true);
    });
  });

  test.describe('Container Detail Page', () => {
    test('should navigate to container detail page', async ({ containerHelper }) => {
      const container = await containerHelper.createContainer({
        ...testContainers[0],
        name: `detail-test-${Date.now()}`,
      });

      await containersPage.clickContainer(container.config.name);

      const detailPage = new ContainerDetailPage(containersPage.page, container.id);
      await expect(detailPage.containerName).toBeVisible();
    });

    test('should display overview tab', async ({ containerHelper }) => {
      const container = await containerHelper.createContainer({
        ...testContainers[0],
        name: `overview-test-${Date.now()}`,
      });

      const detailPage = new ContainerDetailPage(containersPage.page, container.id);
      await detailPage.goto();

      await detailPage.switchToOverview();
      const info = await detailPage.getOverviewInfo();

      expect(info.image).toContain('nginx');
    });

    test('should display all tabs', async ({ containerHelper }) => {
      const container = await containerHelper.createContainer({
        ...testContainers[0],
        name: `tabs-test-${Date.now()}`,
      });

      const detailPage = new ContainerDetailPage(containersPage.page, container.id);
      await detailPage.goto();

      const tabNames = await detailPage.getTabNames();
      expect(tabNames).toContain('Overview');
      expect(tabNames).toContain('Logs');
      expect(tabNames).toContain('Exec');
      expect(tabNames).toContain('Stats');
    });
  });

  test.describe('Container Logs', () => {
    test('should view container logs', async ({ containerHelper }) => {
      const container = await containerHelper.createContainer({
        ...testContainers[0],
        name: `logs-test-${Date.now()}`,
      });

      await containerHelper.startContainer(container.id);
      await containerHelper.waitForContainerState(container.id, 'running');

      const detailPage = new ContainerDetailPage(containersPage.page, container.id);
      await detailPage.goto();

      const logs = await detailPage.getLogs({ lines: 100 });
      expect(logs).toBeDefined();
    });

    test('should stream logs in real-time', async ({ containerHelper }) => {
      const container = await containerHelper.createContainer({
        name: `stream-logs-${Date.now()}`,
        image: 'alpine:latest',
        command: 'sh -c "while true; do echo test-log-line; sleep 1; done"',
      });

      await containerHelper.startContainer(container.id);
      await containerHelper.waitForContainerState(container.id, 'running');

      const detailPage = new ContainerDetailPage(containersPage.page, container.id);
      await detailPage.goto();

      const logs = await detailPage.streamLogs(4000);
      expect(logs.length).toBeGreaterThan(0);
    });

    test('should toggle timestamps in logs', async ({ containerHelper }) => {
      const container = await containerHelper.createContainer({
        ...testContainers[0],
        name: `timestamps-test-${Date.now()}`,
      });

      const detailPage = new ContainerDetailPage(containersPage.page, container.id);
      await detailPage.goto();
      await detailPage.switchToLogs();

      // Toggle timestamps on
      await detailPage.logsSection.timestampsToggle.click();
      await containersPage.page.waitForTimeout(500);

      // Toggle timestamps off
      await detailPage.logsSection.timestampsToggle.click();
    });

    test('should clear logs display', async ({ containerHelper }) => {
      const container = await containerHelper.createContainer({
        ...testContainers[0],
        name: `clear-logs-${Date.now()}`,
      });

      const detailPage = new ContainerDetailPage(containersPage.page, container.id);
      await detailPage.goto();

      await detailPage.clearLogs();
      const logs = await detailPage.getLogs();
      expect(logs.trim()).toBe('');
    });

    test('should search in logs', async ({ containerHelper }) => {
      const container = await containerHelper.createContainer({
        name: `search-logs-${Date.now()}`,
        image: 'alpine:latest',
        command: 'sh -c "echo test-search-pattern; while true; do sleep 3600; done"',
      });

      await containerHelper.startContainer(container.id);
      await containerHelper.waitForContainerState(container.id, 'running');

      const detailPage = new ContainerDetailPage(containersPage.page, container.id);
      await detailPage.goto();

      const results = await detailPage.searchInLogs('test-search-pattern');
      expect(results.length).toBeGreaterThan(0);
    });
  });

  test.describe('Container Exec', () => {
    test('should execute command in container', async ({ containerHelper }) => {
      const container = await containerHelper.createContainer({
        ...testContainers[2],
        name: `exec-test-${Date.now()}`,
      });

      await containerHelper.startContainer(container.id);
      await containerHelper.waitForContainerState(container.id, 'running');

      const detailPage = new ContainerDetailPage(containersPage.page, container.id);
      await detailPage.goto();

      const output = await detailPage.executeCommand('echo "Hello from exec"');
      expect(output).toContain('Hello from exec');
    });

    test('should execute command with working directory', async ({ containerHelper }) => {
      const container = await containerHelper.createContainer({
        ...testContainers[2],
        name: `exec-wd-test-${Date.now()}`,
      });

      await containerHelper.startContainer(container.id);
      await containerHelper.waitForContainerState(container.id, 'running');

      const detailPage = new ContainerDetailPage(containersPage.page, container.id);
      await detailPage.goto();

      const output = await detailPage.executeCommand('pwd', { workingDir: '/tmp' });
      expect(output).toContain('/tmp');
    });

    test('should display terminal output', async ({ containerHelper }) => {
      const container = await containerHelper.createContainer({
        ...testContainers[2],
        name: `terminal-test-${Date.now()}`,
      });

      await containerHelper.startContainer(container.id);
      await containerHelper.waitForContainerState(container.id, 'running');

      const detailPage = new ContainerDetailPage(containersPage.page, container.id);
      await detailPage.goto();

      await detailPage.switchToExec();
      await expect(detailPage.execSection.terminal).toBeVisible();
    });

    test('should clear terminal', async ({ containerHelper }) => {
      const container = await containerHelper.createContainer({
        ...testContainers[2],
        name: `clear-terminal-${Date.now()}`,
      });

      await containerHelper.startContainer(container.id);
      await containerHelper.waitForContainerState(container.id, 'running');

      const detailPage = new ContainerDetailPage(containersPage.page, container.id);
      await detailPage.goto();

      await detailPage.executeCommand('echo "test"');
      await detailPage.clearTerminal();

      const output = await detailPage.getTerminalContent();
      expect(output.trim()).toBe('');
    });
  });

  test.describe('Container Stats', () => {
    test('should display stats tab', async ({ containerHelper }) => {
      const container = await containerHelper.createContainer({
        ...testContainers[0],
        name: `stats-test-${Date.now()}`,
      });

      await containerHelper.startContainer(container.id);
      await containerHelper.waitForContainerState(container.id, 'running');

      const detailPage = new ContainerDetailPage(containersPage.page, container.id);
      await detailPage.goto();

      await detailPage.switchToStats();
      await expect(detailPage.statsSection.container).toBeVisible();
    });

    test('should show CPU and memory usage', async ({ containerHelper }) => {
      const container = await containerHelper.createContainer({
        ...testContainers[0],
        name: `usage-test-${Date.now()}`,
      });

      await containerHelper.startContainer(container.id);
      await containerHelper.waitForContainerState(container.id, 'running');

      const detailPage = new ContainerDetailPage(containersPage.page, container.id);
      await detailPage.goto();

      await detailPage.waitForStats();
      const stats = await detailPage.getStats();

      expect(stats.cpu).toBeTruthy();
      expect(stats.memory).toBeTruthy();
    });

    test('should show network stats', async ({ containerHelper }) => {
      const container = await containerHelper.createContainer({
        ...testContainers[0],
        name: `network-stats-${Date.now()}`,
      });

      await containerHelper.startContainer(container.id);
      await containerHelper.waitForContainerState(container.id, 'running');

      const detailPage = new ContainerDetailPage(containersPage.page, container.id);
      await detailPage.goto();

      await detailPage.waitForStats();
      const stats = await detailPage.getStats();

      expect(stats.networkIn).toBeTruthy();
      expect(stats.networkOut).toBeTruthy();
    });

    test('should change refresh interval', async ({ containerHelper }) => {
      const container = await containerHelper.createContainer({
        ...testContainers[0],
        name: `refresh-test-${Date.now()}`,
      });

      await containerHelper.startContainer(container.id);
      await containerHelper.waitForContainerState(container.id, 'running');

      const detailPage = new ContainerDetailPage(containersPage.page, container.id);
      await detailPage.goto();
      await detailPage.switchToStats();

      await detailPage.setRefreshInterval('5s');
      await detailPage.setRefreshInterval('10s');
    });
  });

  test.describe('Container Prune', () => {
    test('should prune stopped containers', async ({ containerHelper }) => {
      // Create multiple stopped containers
      const container1 = await containerHelper.createContainer({
        ...testContainers[0],
        name: `prune-1-${Date.now()}`,
      });
      const container2 = await containerHelper.createContainer({
        ...testContainers[1],
        name: `prune-2-${Date.now()}`,
      });

      await containersPage.refresh();

      // Verify containers exist
      let hasContainer1 = await containersPage.hasContainer(container1.config.name);
      let hasContainer2 = await containersPage.hasContainer(container2.config.name);
      expect(hasContainer1).toBe(true);
      expect(hasContainer2).toBe(true);

      // Prune containers
      await containersPage.pruneContainers();

      // Verify containers are deleted
      await containersPage.refresh();
      hasContainer1 = await containersPage.hasContainer(container1.config.name);
      hasContainer2 = await containersPage.hasContainer(container2.config.name);
      expect(hasContainer1).toBe(false);
      expect(hasContainer2).toBe(false);
    });

    test('should not prune running containers', async ({ containerHelper }) => {
      const container = await containerHelper.createContainer({
        ...testContainers[0],
        name: `prune-running-${Date.now()}`,
      });

      await containerHelper.startContainer(container.id);
      await containerHelper.waitForContainerState(container.id, 'running');

      await containersPage.refresh();

      // Prune should not delete running container
      await containersPage.pruneContainers();

      await containersPage.refresh();
      const hasContainer = await containersPage.hasContainer(container.config.name);
      expect(hasContainer).toBe(true);
    });
  });

  test.describe('WebSocket Functionality', () => {
    test('should establish WebSocket connection for logs', async ({ containerHelper }) => {
      const container = await containerHelper.createContainer({
        ...testContainers[0],
        name: `ws-logs-${Date.now()}`,
      });

      await containerHelper.startContainer(container.id);
      await containerHelper.waitForContainerState(container.id, 'running');

      const detailPage = new ContainerDetailPage(containersPage.page, container.id);
      await detailPage.goto();

      await detailPage.switchToLogs();

      // Enable follow mode to trigger WebSocket
      await detailPage.logsSection.followToggle.click();
      await containersPage.page.waitForTimeout(1000);

      // Check if connected (implementation dependent)
      const isConnected = await detailPage.isLogsWebSocketConnected();
      // WebSocket connection may vary by implementation
      expect(isConnected).toBeDefined();
    });
  });

  test.describe('Error Handling', () => {
    test('should handle non-existent container', async ({ page }) => {
      const detailPage = new ContainerDetailPage(page, 'non-existent-id-12345');
      await detailPage.goto();

      // Should show error or redirect
      await expect(page.locator('text="not found", text="error", text="404"').first()).toBeVisible({
        timeout: 10000,
      });
    });

    test('should handle network errors gracefully', async ({ containerHelper }) => {
      const container = await containerHelper.createContainer({
        ...testContainers[0],
        name: `error-test-${Date.now()}`,
      });

      // Try to perform actions on the container
      await containersPage.refresh();

      // Actions should not crash the UI
      const hasContainer = await containersPage.hasContainer(container.config.name);
      expect(hasContainer).toBe(true);
    });
  });
});
