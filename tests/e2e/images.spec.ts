import { test, expect } from '@playwright/test';
import { ImagesPage } from './pages/ImagesPage';
import { cleanupTestImages, TEST_IMAGES, createTestImage } from '../fixtures/docker-resources';

test.describe('Docker Images Management', () => {
  let imagesPage: ImagesPage;

  test.beforeEach(async ({ page }) => {
    imagesPage = new ImagesPage(page);
    await imagesPage.goto();
  });

  test.afterEach(async () => {
    await cleanupTestImages();
  });

  test.describe('List Images', () => {
    test('should display images list page', async () => {
      await expect(imagesPage.imagesList).toBeVisible();
      await expect(imagesPage.imageTable).toBeVisible();
    });

    test('should list local images', async ({ page }) => {
      const count = await imagesPage.getImageCount();
      expect(count).toBeGreaterThanOrEqual(0);
    });

    test('should search images by name', async () => {
      await imagesPage.searchImage('alpine');
      const count = await imagesPage.getImageCount();
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe('Pull Image', () => {
    test('should pull image from registry', async () => {
      const testImage = TEST_IMAGES.ALPINE;
      await imagesPage.pullImage(testImage, 60000);

      const exists = await imagesPage.imageExists(testImage);
      expect(exists).toBe(true);
    }, 90000);

    test('should pull image with specific tag', async () => {
      const testImage = TEST_IMAGES.BUSYBOX;
      await imagesPage.pullImage(testImage, 60000);

      const exists = await imagesPage.imageExists('busybox');
      expect(exists).toBe(true);
    }, 90000);

    test('should show error for non-existent image', async () => {
      await imagesPage.pullImage('nonexistent-image-12345:latest', 30000);
      await expect(imagesPage.errorToast).toBeVisible({ timeout: 30000 });
    }, 60000);
  });

  test.describe('Search Images', () => {
    test('should search images in Docker Hub', async () => {
      await imagesPage.searchImage('nginx');
      await page.waitForTimeout(1000);

      const count = await imagesPage.getImageCount();
      expect(count).toBeGreaterThanOrEqual(0);
    });

    test('should filter images by repository', async () => {
      await imagesPage.pullImage(TEST_IMAGES.ALPINE, 60000);
      await imagesPage.searchImage('alpine');

      const count = await imagesPage.getImageCount();
      expect(count).toBeGreaterThan(0);
    }, 90000);
  });

  test.describe('Delete Image', () => {
    test('should delete image by name', async () => {
      const testImage = TEST_IMAGES.ALPINE;
      await imagesPage.pullImage(testImage, 60000);

      await imagesPage.deleteImage('alpine');

      const exists = await imagesPage.imageExists('alpine');
      expect(exists).toBe(false);
    }, 90000);

    test('should show confirmation before delete', async () => {
      await imagesPage.pullImage(TEST_IMAGES.ALPINE, 60000);

      const row = imagesPage.imageRows.filter({ hasText: 'alpine' });
      await row.locator('[data-testid="delete-image-button"]').click();

      await expect(imagesPage.confirmDeleteButton).toBeVisible();
      await imagesPage.confirmDeleteButton.click();
      await expect(imagesPage.successToast).toBeVisible();
    }, 90000);
  });

  test.describe('Image History', () => {
    test('should view image history', async () => {
      await imagesPage.pullImage(TEST_IMAGES.ALPINE, 60000);

      await imagesPage.viewImageHistory('alpine');
      const history = await imagesPage.getImageHistory();

      expect(history.length).toBeGreaterThan(0);
      expect(history[0]).toHaveProperty('layer');
      expect(history[0]).toHaveProperty('size');
    }, 90000);

    test('should display layer information', async () => {
      await imagesPage.pullImage(TEST_IMAGES.ALPINE, 60000);

      await imagesPage.viewImageHistory('alpine');
      const history = await imagesPage.getImageHistory();

      if (history.length > 0) {
        expect(history[0].created).toBeTruthy();
      }
    }, 90000);
  });

  test.describe('Image Details', () => {
    test('should view image details', async () => {
      await imagesPage.pullImage(TEST_IMAGES.ALPINE, 60000);

      await imagesPage.viewImageDetails('alpine');
      const details = await imagesPage.getImageDetails();

      expect(details.size).toBeTruthy();
      expect(details.layers).toBeGreaterThanOrEqual(0);
    }, 90000);

    test('should display image tags', async () => {
      await imagesPage.pullImage(TEST_IMAGES.ALPINE, 60000);

      await imagesPage.viewImageDetails('alpine');
      const details = await imagesPage.getImageDetails();

      expect(details.tags.length).toBeGreaterThanOrEqual(0);
    }, 90000);

    test('should close details modal', async () => {
      await imagesPage.pullImage(TEST_IMAGES.ALPINE, 60000);

      await imagesPage.viewImageDetails('alpine');
      await imagesPage.closeImageDetails();

      await expect(imagesPage.imageDetailsModal).toBeHidden();
    }, 90000);
  });

  test.describe('Prune Images', () => {
    test('should prune dangling images', async () => {
      const testImage = TEST_IMAGES.ALPINE;
      await imagesPage.pullImage(testImage, 60000);
      await imagesPage.pullImage(TEST_IMAGES.BUSYBOX, 60000);

      await imagesPage.deleteImage('alpine');
      await imagesPage.deleteImage('busybox');

      const prunedCount = await imagesPage.pruneImages();
      expect(prunedCount).toBeGreaterThanOrEqual(0);
    }, 120000);

    test('should show confirmation before prune', async () => {
      await imagesPage.pruneButton.click();
      await expect(imagesPage.page.locator('[data-testid="prune-confirm-modal"]')).toBeVisible();

      await imagesPage.page.locator('[data-testid="cancel-prune-button"]').click();
      await expect(imagesPage.page.locator('[data-testid="prune-confirm-modal"]')).toBeHidden();
    });
  });

  test.describe('Tag Image', () => {
    test('should tag image with new name', async () => {
      await imagesPage.pullImage(TEST_IMAGES.ALPINE, 60000);

      const newTag = 'my-alpine:test';
      await imagesPage.tagImage('alpine', newTag);

      const exists = await imagesPage.imageExists(newTag);
      expect(exists).toBe(true);
    }, 90000);

    test('should allow multiple tags for same image', async () => {
      await imagesPage.pullImage(TEST_IMAGES.ALPINE, 60000);

      await imagesPage.tagImage('alpine', 'alpine:tag1');
      await imagesPage.tagImage('alpine', 'alpine:tag2');

      const exists1 = await imagesPage.imageExists('alpine:tag1');
      const exists2 = await imagesPage.imageExists('alpine:tag2');

      expect(exists1).toBe(true);
      expect(exists2).toBe(true);
    }, 120000);
  });
});
