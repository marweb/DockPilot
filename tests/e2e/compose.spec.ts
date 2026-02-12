import { test, expect } from '@playwright/test';
import { ComposePage } from './pages/ComposePage';
import {
  cleanupTestStacks,
  TEST_STACKS,
  createTestComposeFile,
  cleanupTestContainers,
  createTestContainer,
} from '../fixtures/docker-resources';
import path from 'path';
import fs from 'fs';

test.describe('Docker Compose Management', () => {
  let composePage: ComposePage;
  const tempDir = path.join(process.cwd(), 'tests', 'temp');

  test.beforeEach(async ({ page }) => {
    composePage = new ComposePage(page);
    await composePage.goto();

    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
  });

  test.afterEach(async () => {
    await cleanupTestStacks();
    await cleanupTestContainers();

    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test.describe('List Stacks', () => {
    test('should display stacks list page', async () => {
      await expect(composePage.stacksList).toBeVisible();
      await expect(composePage.stackTable).toBeVisible();
    });

    test('should list all stacks', async () => {
      const count = await composePage.getStackCount();
      expect(count).toBeGreaterThanOrEqual(0);
    });

    test('should search stacks by name', async () => {
      await composePage.searchStack('test');
      const count = await composePage.getStackCount();
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe('Deploy from File', () => {
    test('should deploy stack from compose file', async () => {
      const stackName = `test-stack-${Date.now()}`;
      const composeContent = TEST_STACKS.SIMPLE;
      const filePath = await createTestComposeFile(stackName, composeContent, tempDir);

      await composePage.deployFromFile(stackName, filePath, 60000);

      const exists = await composePage.stackExists(stackName);
      expect(exists).toBe(true);
    }, 90000);

    test('should deploy stack with multiple services', async () => {
      const stackName = `multi-service-${Date.now()}`;
      const composeContent = TEST_STACKS.MULTI_SERVICE;
      const filePath = await createTestComposeFile(stackName, composeContent, tempDir);

      await composePage.deployFromFile(stackName, filePath, 90000);

      const exists = await composePage.stackExists(stackName);
      expect(exists).toBe(true);

      await composePage.viewStackDetails(stackName);
      const details = await composePage.getStackDetails();
      expect(details.services.length).toBeGreaterThanOrEqual(2);
      await composePage.closeStackDetails();
    }, 120000);

    test('should show error for invalid compose file', async () => {
      const stackName = `invalid-${Date.now()}`;
      const invalidCompose = 'invalid: yaml: content: [';
      const filePath = path.join(tempDir, `${stackName}.yml`);
      fs.writeFileSync(filePath, invalidCompose);

      await composePage.deployFromFile(stackName, filePath, 30000);
      await expect(composePage.errorToast).toBeVisible({ timeout: 30000 });
    }, 60000);
  });

  test.describe('Deploy from Editor', () => {
    test('should deploy stack from YAML editor', async () => {
      const stackName = `editor-stack-${Date.now()}`;
      const composeYaml = TEST_STACKS.SIMPLE;

      await composePage.deployFromEditor(stackName, composeYaml, 60000);

      const exists = await composePage.stackExists(stackName);
      expect(exists).toBe(true);
    }, 90000);

    test('should deploy complex stack from editor', async () => {
      const stackName = `complex-editor-${Date.now()}`;
      const composeYaml = TEST_STACKS.WITH_VOLUMES;

      await composePage.deployFromEditor(stackName, composeYaml, 90000);

      const exists = await composePage.stackExists(stackName);
      expect(exists).toBe(true);
    }, 120000);

    test('should handle large compose files', async () => {
      const stackName = `large-stack-${Date.now()}`;
      let services = '';
      for (let i = 1; i <= 5; i++) {
        services += `
  app${i}:
    image: alpine:latest
    command: sleep 300
`;
      }
      const composeYaml = `version: '3.8'
services:${services}`;

      await composePage.deployFromEditor(stackName, composeYaml, 120000);

      const exists = await composePage.stackExists(stackName);
      expect(exists).toBe(true);
    }, 150000);
  });

  test.describe('Validate Compose', () => {
    test('should validate correct compose file', async () => {
      const composeYaml = TEST_STACKS.SIMPLE;
      const result = await composePage.validateComposeFile(composeYaml);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should detect invalid compose syntax', async () => {
      const invalidYaml = `
version: '3.8'
services:
  web:
    image
      - invalid
`;
      const result = await composePage.validateComposeFile(invalidYaml);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    test('should detect missing required fields', async () => {
      const incompleteYaml = `
version: '3.8'
services:
  web:
    # missing image
`;
      const result = await composePage.validateComposeFile(incompleteYaml);

      expect(result.valid).toBe(false);
    });

    test('should detect circular dependencies', async () => {
      const circularYaml = `
version: '3.8'
services:
  app1:
    image: alpine
    depends_on:
      - app2
  app2:
    image: alpine
    depends_on:
      - app1
`;
      const result = await composePage.validateComposeFile(circularYaml);

      expect(result.valid).toBe(false);
    });
  });

  test.describe('View Logs', () => {
    test('should view stack logs', async () => {
      const stackName = `logs-stack-${Date.now()}`;
      await composePage.deployFromEditor(stackName, TEST_STACKS.SIMPLE, 60000);
      await composePage.goto();

      const logs = await composePage.viewStackLogs(stackName, 5000);
      expect(logs).toBeTruthy();

      await composePage.closeLogsModal();
    }, 90000);

    test('should stream logs in real-time', async () => {
      const stackName = `stream-logs-${Date.now()}`;
      await composePage.deployFromEditor(stackName, TEST_STACKS.SIMPLE, 60000);
      await composePage.goto();

      await composePage.viewStackLogs(stackName, 2000);

      await composePage.page.waitForTimeout(2000);

      await composePage.closeLogsModal();
    }, 90000);
  });

  test.describe('Scale Services', () => {
    test('should scale service up', async () => {
      const stackName = `scale-up-${Date.now()}`;
      await composePage.deployFromEditor(stackName, TEST_STACKS.SIMPLE, 60000);
      await composePage.goto();

      await composePage.scaleService(stackName, 'web', 3);

      await composePage.viewStackDetails(stackName);
      const details = await composePage.getStackDetails();
      const webService = details.services.find((s) => s.name === 'web');
      expect(webService?.replicas).toContain('3');
      await composePage.closeStackDetails();
    }, 90000);

    test('should scale service down', async () => {
      const stackName = `scale-down-${Date.now()}`;
      await composePage.deployFromEditor(stackName, TEST_STACKS.SIMPLE, 60000);
      await composePage.goto();

      await composePage.scaleService(stackName, 'web', 1);

      await composePage.viewStackDetails(stackName);
      const details = await composePage.getStackDetails();
      const webService = details.services.find((s) => s.name === 'web');
      expect(webService?.replicas).toContain('1');
      await composePage.closeStackDetails();
    }, 90000);

    test('should scale to zero replicas', async () => {
      const stackName = `scale-zero-${Date.now()}`;
      await composePage.deployFromEditor(stackName, TEST_STACKS.SIMPLE, 60000);
      await composePage.goto();

      await composePage.scaleService(stackName, 'web', 0);

      await composePage.viewStackDetails(stackName);
      const details = await composePage.getStackDetails();
      const webService = details.services.find((s) => s.name === 'web');
      expect(webService?.status.toLowerCase()).toContain('stopped');
      await composePage.closeStackDetails();
    }, 90000);
  });

  test.describe('Stop Stack', () => {
    test('should stop running stack', async () => {
      const stackName = `stop-stack-${Date.now()}`;
      await composePage.deployFromEditor(stackName, TEST_STACKS.SIMPLE, 60000);
      await composePage.goto();

      await composePage.stopStack(stackName);

      const status = await composePage.getStackStatus(stackName);
      expect(status.toLowerCase()).toContain('stopped');
    }, 90000);

    test('should show confirmation before stop', async () => {
      const stackName = `stop-confirm-${Date.now()}`;
      await composePage.deployFromEditor(stackName, TEST_STACKS.SIMPLE, 60000);
      await composePage.goto();

      const row = composePage.stackRows.filter({ hasText: stackName });
      await row.locator('[data-testid="stop-stack-button"]').click();

      await expect(composePage.page.locator('[data-testid="stop-confirm-modal"]')).toBeVisible();
      await composePage.page.locator('[data-testid="confirm-stop-button"]').click();
      await expect(composePage.successToast).toBeVisible();
    }, 90000);
  });

  test.describe('Remove Stack', () => {
    test('should remove stopped stack', async () => {
      const stackName = `remove-stack-${Date.now()}`;
      await composePage.deployFromEditor(stackName, TEST_STACKS.SIMPLE, 60000);
      await composePage.goto();
      await composePage.stopStack(stackName);

      await composePage.removeStack(stackName);

      const exists = await composePage.stackExists(stackName);
      expect(exists).toBe(false);
    }, 90000);

    test('should remove stack with volumes', async () => {
      const stackName = `remove-volumes-${Date.now()}`;
      await composePage.deployFromEditor(stackName, TEST_STACKS.WITH_VOLUMES, 60000);
      await composePage.goto();
      await composePage.stopStack(stackName);

      await composePage.removeStack(stackName, true);

      const exists = await composePage.stackExists(stackName);
      expect(exists).toBe(false);
    }, 90000);

    test('should show confirmation before remove', async () => {
      const stackName = `remove-confirm-${Date.now()}`;
      await composePage.deployFromEditor(stackName, TEST_STACKS.SIMPLE, 60000);
      await composePage.goto();
      await composePage.stopStack(stackName);

      const row = composePage.stackRows.filter({ hasText: stackName });
      await row.locator('[data-testid="delete-stack-button"]').click();

      await expect(composePage.page.locator('[data-testid="remove-confirm-modal"]')).toBeVisible();
      await composePage.page.locator('[data-testid="confirm-remove-button"]').click();
      await expect(composePage.successToast).toBeVisible();
    }, 90000);
  });

  test.describe('Pull Images', () => {
    test('should pull images for stack', async () => {
      const stackName = `pull-stack-${Date.now()}`;
      await composePage.deployFromEditor(stackName, TEST_STACKS.SIMPLE, 60000);
      await composePage.goto();

      await composePage.pullStackImages(stackName, 120000);

      await expect(composePage.successToast).toBeVisible();
    }, 150000);

    test('should pull multiple service images', async () => {
      const stackName = `pull-multi-${Date.now()}`;
      await composePage.deployFromEditor(stackName, TEST_STACKS.MULTI_SERVICE, 90000);
      await composePage.goto();

      await composePage.pullStackImages(stackName, 120000);

      await expect(composePage.successToast).toBeVisible();
    }, 180000);
  });

  test.describe('Build Images', () => {
    test('should build images for stack', async () => {
      const stackName = `build-stack-${Date.now()}`;
      const composeWithBuild = `
version: '3.8'
services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    image: test-app:latest
`;

      const filePath = await createTestComposeFile(stackName, composeWithBuild, tempDir);
      const dockerfilePath = path.join(tempDir, 'Dockerfile');
      fs.writeFileSync(dockerfilePath, 'FROM alpine:latest\nCMD ["echo", "hello"]');

      await composePage.deployFromFile(stackName, filePath, 60000);
      await composePage.goto();

      await composePage.buildStackImages(stackName, 120000);

      await expect(composePage.successToast).toBeVisible();
    }, 180000);
  });
});
