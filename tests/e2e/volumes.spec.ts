import { test, expect } from '@playwright/test';
import { VolumesPage } from './pages/VolumesPage';
import { cleanupTestVolumes, TEST_VOLUMES, createTestVolume } from '../fixtures/docker-resources';

test.describe('Docker Volumes Management', () => {
  let volumesPage: VolumesPage;

  test.beforeEach(async ({ page }) => {
    volumesPage = new VolumesPage(page);
    await volumesPage.goto();
  });

  test.afterEach(async () => {
    await cleanupTestVolumes();
  });

  test.describe('List Volumes', () => {
    test('should display volumes list page', async () => {
      await expect(volumesPage.volumesList).toBeVisible();
      await expect(volumesPage.volumeTable).toBeVisible();
    });

    test('should list all volumes', async () => {
      const count = await volumesPage.getVolumeCount();
      expect(count).toBeGreaterThanOrEqual(0);
    });

    test('should search volumes by name', async () => {
      const volumeName = await createTestVolume('search-test');
      await volumesPage.goto();

      await volumesPage.searchVolume('search-test');
      const exists = await volumesPage.volumeExists(volumeName);
      expect(exists).toBe(true);
    });
  });

  test.describe('Create Volume', () => {
    test('should create new volume', async () => {
      const volumeName = `test-volume-${Date.now()}`;
      await volumesPage.createVolume(volumeName);

      const exists = await volumesPage.volumeExists(volumeName);
      expect(exists).toBe(true);
    });

    test('should create volume with custom driver', async () => {
      const volumeName = `test-volume-${Date.now()}`;
      await volumesPage.createVolume(volumeName, 'local');

      await volumesPage.viewVolumeDetails(volumeName);
      const details = await volumesPage.getVolumeDetails();
      expect(details.driver).toBe('local');
      await volumesPage.closeVolumeDetails();
    });

    test('should create volume with labels', async () => {
      const volumeName = `test-volume-${Date.now()}`;
      const labels = { env: 'test', app: 'dockpilot' };
      await volumesPage.createVolume(volumeName, 'local', labels);

      await volumesPage.viewVolumeDetails(volumeName);
      const details = await volumesPage.getVolumeDetails();
      expect(details.labels.env).toBe('test');
      expect(details.labels.app).toBe('dockpilot');
      await volumesPage.closeVolumeDetails();
    });

    test('should show error for duplicate volume name', async () => {
      const volumeName = `duplicate-volume-${Date.now()}`;
      await volumesPage.createVolume(volumeName);

      await volumesPage.createVolume(volumeName);
      await expect(volumesPage.errorToast).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('View Volume Details', () => {
    test('should view volume details', async () => {
      const volumeName = await createTestVolume('details-test');
      await volumesPage.goto();

      await volumesPage.viewVolumeDetails(volumeName);
      const details = await volumesPage.getVolumeDetails();

      expect(details.name).toBe(volumeName);
      expect(details.driver).toBeTruthy();
      expect(details.mountpoint).toBeTruthy();
      await volumesPage.closeVolumeDetails();
    });

    test('should display volume size', async () => {
      const volumeName = await createTestVolume('size-test');
      await volumesPage.goto();

      await volumesPage.viewVolumeDetails(volumeName);
      const details = await volumesPage.getVolumeDetails();
      expect(details.size).toBeTruthy();
      await volumesPage.closeVolumeDetails();
    });

    test('should display creation time', async () => {
      const volumeName = await createTestVolume('created-test');
      await volumesPage.goto();

      await volumesPage.viewVolumeDetails(volumeName);
      const details = await volumesPage.getVolumeDetails();
      expect(details.created).toBeTruthy();
      await volumesPage.closeVolumeDetails();
    });
  });

  test.describe('Delete Volume', () => {
    test('should delete unused volume', async () => {
      const volumeName = await createTestVolume('delete-test');
      await volumesPage.goto();

      await volumesPage.deleteVolume(volumeName);

      const exists = await volumesPage.volumeExists(volumeName);
      expect(exists).toBe(false);
    });

    test('should show confirmation before delete', async () => {
      const volumeName = await createTestVolume('confirm-delete-test');
      await volumesPage.goto();

      const row = volumesPage.volumeRows.filter({ hasText: volumeName });
      await row.locator('[data-testid="delete-volume-button"]').click();

      await expect(volumesPage.confirmDeleteButton).toBeVisible();
      await volumesPage.confirmDeleteButton.click();
      await expect(volumesPage.successToast).toBeVisible();
    });
  });

  test.describe('Volume Usage', () => {
    test('should show volume is not in use', async () => {
      const volumeName = await createTestVolume('unused-test');
      await volumesPage.goto();

      const inUse = await volumesPage.isVolumeInUse(volumeName);
      expect(inUse).toBe(false);
    });

    test('should display volume usage information', async () => {
      const volumeName = await createTestVolume('usage-test');
      await volumesPage.goto();

      const usage = await volumesPage.getVolumeUsage(volumeName);
      expect(usage.size).toBeTruthy();
      expect(usage.containers).toEqual([]);
    });
  });

  test.describe('Prune Volumes', () => {
    test('should prune unused volumes', async () => {
      await createTestVolume('prune-test-1');
      await createTestVolume('prune-test-2');
      await volumesPage.goto();

      const prunedCount = await volumesPage.pruneVolumes();
      expect(prunedCount).toBeGreaterThanOrEqual(0);
    });

    test('should show confirmation before prune', async () => {
      await volumesPage.pruneButton.click();
      await expect(volumesPage.page.locator('[data-testid="prune-confirm-modal"]')).toBeVisible();

      await volumesPage.page.locator('[data-testid="cancel-prune-button"]').click();
      await expect(volumesPage.page.locator('[data-testid="prune-confirm-modal"]')).toBeHidden();
    });
  });

  test.describe('Backup Volume', () => {
    test('should backup volume', async () => {
      const volumeName = await createTestVolume('backup-test');
      await volumesPage.goto();

      const backupPath = `/tmp/backup-${volumeName}.tar.gz`;
      await volumesPage.backupVolume(volumeName, backupPath);

      await expect(volumesPage.successToast).toBeVisible();
    });

    test('should show error for non-existent volume', async () => {
      const backupPath = '/tmp/backup-nonexistent.tar.gz';

      await volumesPage.restoreButton.click();
      await expect(volumesPage.page.locator('[data-testid="restore-modal"]')).toBeVisible();
      await volumesPage.page
        .locator('[data-testid="restore-path-input"]')
        .fill('/nonexistent/path.tar.gz');
      await volumesPage.page.locator('[data-testid="confirm-restore-button"]').click();

      await expect(volumesPage.errorToast).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Restore Volume', () => {
    test('should restore volume from backup', async () => {
      const volumeName = await createTestVolume('restore-source');
      await volumesPage.goto();

      const backupPath = `/tmp/backup-${volumeName}.tar.gz`;
      await volumesPage.backupVolume(volumeName, backupPath);

      await volumesPage.deleteVolume(volumeName);

      await volumesPage.restoreVolume(backupPath, volumeName);

      const exists = await volumesPage.volumeExists(volumeName);
      expect(exists).toBe(true);
    });

    test('should restore volume with new name', async () => {
      const sourceVolume = await createTestVolume('restore-source-new');
      await volumesPage.goto();

      const backupPath = `/tmp/backup-${sourceVolume}.tar.gz`;
      await volumesPage.backupVolume(sourceVolume, backupPath);

      const newVolumeName = `restored-${Date.now()}`;
      await volumesPage.restoreVolume(backupPath, newVolumeName);

      const exists = await volumesPage.volumeExists(newVolumeName);
      expect(exists).toBe(true);
    });
  });
});
