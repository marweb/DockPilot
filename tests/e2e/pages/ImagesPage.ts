import { Page, Locator, expect } from '@playwright/test';

export class ImagesPage {
  readonly page: Page;
  readonly imagesList: Locator;
  readonly pullImageButton: Locator;
  readonly searchInput: Locator;
  readonly searchButton: Locator;
  readonly imageTable: Locator;
  readonly imageRows: Locator;
  readonly deleteButton: Locator;
  readonly confirmDeleteButton: Locator;
  readonly imageDetailsModal: Locator;
  readonly pruneButton: Locator;
  readonly tagButton: Locator;
  readonly historyButton: Locator;
  readonly pullModal: Locator;
  readonly pullInput: Locator;
  readonly pullConfirmButton: Locator;
  readonly loadingSpinner: Locator;
  readonly successToast: Locator;
  readonly errorToast: Locator;

  constructor(page: Page) {
    this.page = page;
    this.imagesList = page.locator('[data-testid="images-list"]');
    this.pullImageButton = page.locator('[data-testid="pull-image-button"]');
    this.searchInput = page.locator('[data-testid="image-search-input"]');
    this.searchButton = page.locator('[data-testid="image-search-button"]');
    this.imageTable = page.locator('[data-testid="images-table"]');
    this.imageRows = page.locator('[data-testid="image-row"]');
    this.deleteButton = page.locator('[data-testid="delete-image-button"]');
    this.confirmDeleteButton = page.locator('[data-testid="confirm-delete-button"]');
    this.imageDetailsModal = page.locator('[data-testid="image-details-modal"]');
    this.pruneButton = page.locator('[data-testid="prune-images-button"]');
    this.tagButton = page.locator('[data-testid="tag-image-button"]');
    this.historyButton = page.locator('[data-testid="image-history-button"]');
    this.pullModal = page.locator('[data-testid="pull-image-modal"]');
    this.pullInput = page.locator('[data-testid="pull-image-input"]');
    this.pullConfirmButton = page.locator('[data-testid="pull-confirm-button"]');
    this.loadingSpinner = page.locator('[data-testid="loading-spinner"]');
    this.successToast = page.locator('[data-testid="success-toast"]');
    this.errorToast = page.locator('[data-testid="error-toast"]');
  }

  async goto(): Promise<void> {
    await this.page.goto('/images');
    await this.waitForPageLoad();
  }

  async waitForPageLoad(): Promise<void> {
    await expect(this.imagesList).toBeVisible({ timeout: 10000 });
  }

  async getImageCount(): Promise<number> {
    await this.page.waitForSelector('[data-testid="image-row"]', { timeout: 5000 });
    return this.imageRows.count();
  }

  async pullImage(imageName: string, timeout = 60000): Promise<void> {
    await this.pullImageButton.click();
    await expect(this.pullModal).toBeVisible();
    await this.pullInput.fill(imageName);
    await this.pullConfirmButton.click();

    await expect(this.loadingSpinner).toBeVisible({ timeout: 5000 });
    await expect(this.loadingSpinner).toBeHidden({ timeout });
    await expect(this.successToast).toBeVisible({ timeout: 10000 });
  }

  async searchImage(query: string): Promise<void> {
    await this.searchInput.fill(query);
    await this.searchButton.click();
    await this.page.waitForTimeout(500);
  }

  async deleteImage(imageName: string): Promise<void> {
    const row = this.imageRows.filter({ hasText: imageName });
    await row.locator('[data-testid="delete-image-button"]').click();
    await expect(this.confirmDeleteButton).toBeVisible();
    await this.confirmDeleteButton.click();
    await expect(this.successToast).toBeVisible({ timeout: 10000 });
  }

  async viewImageDetails(imageName: string): Promise<void> {
    const row = this.imageRows.filter({ hasText: imageName });
    await row.locator('[data-testid="view-details-button"]').click();
    await expect(this.imageDetailsModal).toBeVisible();
  }

  async getImageDetails(): Promise<{
    tags: string[];
    size: string;
    layers: number;
    created: string;
  }> {
    await expect(this.imageDetailsModal).toBeVisible();

    const tags = await this.page.locator('[data-testid="image-tags"]').allTextContents();
    const size = (await this.page.locator('[data-testid="image-size"]').textContent()) || '';
    const layersText =
      (await this.page.locator('[data-testid="image-layers"]').textContent()) || '0';
    const created = (await this.page.locator('[data-testid="image-created"]').textContent()) || '';

    return {
      tags,
      size,
      layers: parseInt(layersText, 10) || 0,
      created,
    };
  }

  async closeImageDetails(): Promise<void> {
    await this.page.locator('[data-testid="close-modal-button"]').click();
    await expect(this.imageDetailsModal).toBeHidden();
  }

  async viewImageHistory(imageName: string): Promise<void> {
    const row = this.imageRows.filter({ hasText: imageName });
    await row.locator('[data-testid="image-history-button"]').click();
    await expect(this.page.locator('[data-testid="image-history-modal"]')).toBeVisible();
  }

  async getImageHistory(): Promise<
    Array<{
      layer: string;
      size: string;
      created: string;
      command: string;
    }>
  > {
    const historyRows = this.page.locator('[data-testid="history-row"]');
    const count = await historyRows.count();
    const history = [];

    for (let i = 0; i < count; i++) {
      const row = historyRows.nth(i);
      history.push({
        layer: (await row.locator('[data-testid="history-layer"]').textContent()) || '',
        size: (await row.locator('[data-testid="history-size"]').textContent()) || '',
        created: (await row.locator('[data-testid="history-created"]').textContent()) || '',
        command: (await row.locator('[data-testid="history-command"]').textContent()) || '',
      });
    }

    return history;
  }

  async pruneImages(): Promise<number> {
    await this.pruneButton.click();
    await expect(this.page.locator('[data-testid="prune-confirm-modal"]')).toBeVisible();
    await this.page.locator('[data-testid="confirm-prune-button"]').click();

    await expect(this.successToast).toBeVisible({ timeout: 10000 });
    const message = (await this.successToast.textContent()) || '';
    const match = message.match(/(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  }

  async tagImage(sourceImage: string, newTag: string): Promise<void> {
    const row = this.imageRows.filter({ hasText: sourceImage });
    await row.locator('[data-testid="tag-image-button"]').click();

    await expect(this.page.locator('[data-testid="tag-modal"]')).toBeVisible();
    await this.page.locator('[data-testid="tag-input"]').fill(newTag);
    await this.page.locator('[data-testid="confirm-tag-button"]').click();

    await expect(this.successToast).toBeVisible({ timeout: 10000 });
  }

  async imageExists(imageName: string): Promise<boolean> {
    await this.page.waitForTimeout(500);
    const row = this.imageRows.filter({ hasText: imageName });
    return row.count() > 0;
  }

  async getImageSize(imageName: string): Promise<string> {
    const row = this.imageRows.filter({ hasText: imageName });
    return row.locator('[data-testid="image-size-cell"]').textContent() || '';
  }

  async waitForImagePull(imageName: string, timeout = 60000): Promise<void> {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      await this.page.reload();
      await this.waitForPageLoad();
      if (await this.imageExists(imageName)) {
        return;
      }
      await this.page.waitForTimeout(2000);
    }
    throw new Error(`Image ${imageName} not found after ${timeout}ms`);
  }
}
