import { Page, Locator, expect } from '@playwright/test';

export class VolumesPage {
  readonly page: Page;
  readonly volumesList: Locator;
  readonly createVolumeButton: Locator;
  readonly searchInput: Locator;
  readonly volumeTable: Locator;
  readonly volumeRows: Locator;
  readonly deleteButton: Locator;
  readonly confirmDeleteButton: Locator;
  readonly volumeDetailsModal: Locator;
  readonly pruneButton: Locator;
  readonly backupButton: Locator;
  readonly restoreButton: Locator;
  readonly createModal: Locator;
  readonly volumeNameInput: Locator;
  readonly volumeDriverSelect: Locator;
  readonly volumeLabelsInput: Locator;
  readonly createConfirmButton: Locator;
  readonly loadingSpinner: Locator;
  readonly successToast: Locator;
  readonly errorToast: Locator;

  constructor(page: Page) {
    this.page = page;
    this.volumesList = page.locator('[data-testid="volumes-list"]');
    this.createVolumeButton = page.locator('[data-testid="create-volume-button"]');
    this.searchInput = page.locator('[data-testid="volume-search-input"]');
    this.volumeTable = page.locator('[data-testid="volumes-table"]');
    this.volumeRows = page.locator('[data-testid="volume-row"]');
    this.deleteButton = page.locator('[data-testid="delete-volume-button"]');
    this.confirmDeleteButton = page.locator('[data-testid="confirm-delete-button"]');
    this.volumeDetailsModal = page.locator('[data-testid="volume-details-modal"]');
    this.pruneButton = page.locator('[data-testid="prune-volumes-button"]');
    this.backupButton = page.locator('[data-testid="backup-volume-button"]');
    this.restoreButton = page.locator('[data-testid="restore-volume-button"]');
    this.createModal = page.locator('[data-testid="create-volume-modal"]');
    this.volumeNameInput = page.locator('[data-testid="volume-name-input"]');
    this.volumeDriverSelect = page.locator('[data-testid="volume-driver-select"]');
    this.volumeLabelsInput = page.locator('[data-testid="volume-labels-input"]');
    this.createConfirmButton = page.locator('[data-testid="create-confirm-button"]');
    this.loadingSpinner = page.locator('[data-testid="loading-spinner"]');
    this.successToast = page.locator('[data-testid="success-toast"]');
    this.errorToast = page.locator('[data-testid="error-toast"]');
  }

  async goto(): Promise<void> {
    await this.page.goto('/volumes');
    await this.waitForPageLoad();
  }

  async waitForPageLoad(): Promise<void> {
    await expect(this.volumesList).toBeVisible({ timeout: 10000 });
  }

  async getVolumeCount(): Promise<number> {
    await this.page.waitForSelector('[data-testid="volume-row"]', { timeout: 5000 });
    return this.volumeRows.count();
  }

  async createVolume(
    name: string,
    driver = 'local',
    labels?: Record<string, string>
  ): Promise<void> {
    await this.createVolumeButton.click();
    await expect(this.createModal).toBeVisible();

    await this.volumeNameInput.fill(name);
    await this.volumeDriverSelect.selectOption(driver);

    if (labels) {
      const labelsString = Object.entries(labels)
        .map(([k, v]) => `${k}=${v}`)
        .join(',');
      await this.volumeLabelsInput.fill(labelsString);
    }

    await this.createConfirmButton.click();
    await expect(this.successToast).toBeVisible({ timeout: 10000 });
  }

  async searchVolume(query: string): Promise<void> {
    await this.searchInput.fill(query);
    await this.page.waitForTimeout(500);
  }

  async deleteVolume(volumeName: string): Promise<void> {
    const row = this.volumeRows.filter({ hasText: volumeName });
    await row.locator('[data-testid="delete-volume-button"]').click();
    await expect(this.confirmDeleteButton).toBeVisible();
    await this.confirmDeleteButton.click();
    await expect(this.successToast).toBeVisible({ timeout: 10000 });
  }

  async viewVolumeDetails(volumeName: string): Promise<void> {
    const row = this.volumeRows.filter({ hasText: volumeName });
    await row.locator('[data-testid="view-details-button"]').click();
    await expect(this.volumeDetailsModal).toBeVisible();
  }

  async getVolumeDetails(): Promise<{
    name: string;
    driver: string;
    mountpoint: string;
    labels: Record<string, string>;
    size: string;
    created: string;
  }> {
    await expect(this.volumeDetailsModal).toBeVisible();

    const labelsText =
      (await this.page.locator('[data-testid="volume-labels"]').textContent()) || '';
    const labels: Record<string, string> = {};
    labelsText.split(',').forEach((pair) => {
      const [k, v] = pair.split('=');
      if (k && v) labels[k.trim()] = v.trim();
    });

    return {
      name: (await this.page.locator('[data-testid="volume-name"]').textContent()) || '',
      driver: (await this.page.locator('[data-testid="volume-driver"]').textContent()) || '',
      mountpoint:
        (await this.page.locator('[data-testid="volume-mountpoint"]').textContent()) || '',
      labels,
      size: (await this.page.locator('[data-testid="volume-size"]').textContent()) || '',
      created: (await this.page.locator('[data-testid="volume-created"]').textContent()) || '',
    };
  }

  async closeVolumeDetails(): Promise<void> {
    await this.page.locator('[data-testid="close-modal-button"]').click();
    await expect(this.volumeDetailsModal).toBeHidden();
  }

  async getVolumeUsage(volumeName: string): Promise<{
    size: string;
    containers: string[];
  }> {
    await this.viewVolumeDetails(volumeName);

    const containers = await this.page
      .locator('[data-testid="volume-containers"] [data-testid="container-name"]')
      .allTextContents();

    const size = (await this.page.locator('[data-testid="volume-usage-size"]').textContent()) || '';

    await this.closeVolumeDetails();

    return { size, containers };
  }

  async pruneVolumes(): Promise<number> {
    await this.pruneButton.click();
    await expect(this.page.locator('[data-testid="prune-confirm-modal"]')).toBeVisible();
    await this.page.locator('[data-testid="confirm-prune-button"]').click();

    await expect(this.successToast).toBeVisible({ timeout: 10000 });
    const message = (await this.successToast.textContent()) || '';
    const match = message.match(/(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  }

  async backupVolume(volumeName: string, backupPath: string): Promise<void> {
    const row = this.volumeRows.filter({ hasText: volumeName });
    await row.locator('[data-testid="backup-volume-button"]').click();

    await expect(this.page.locator('[data-testid="backup-modal"]')).toBeVisible();
    await this.page.locator('[data-testid="backup-path-input"]').fill(backupPath);
    await this.page.locator('[data-testid="confirm-backup-button"]').click();

    await expect(this.loadingSpinner).toBeVisible({ timeout: 5000 });
    await expect(this.loadingSpinner).toBeHidden({ timeout: 30000 });
    await expect(this.successToast).toBeVisible({ timeout: 10000 });
  }

  async restoreVolume(backupPath: string, targetVolumeName?: string): Promise<void> {
    await this.restoreButton.click();

    await expect(this.page.locator('[data-testid="restore-modal"]')).toBeVisible();
    await this.page.locator('[data-testid="restore-path-input"]').fill(backupPath);

    if (targetVolumeName) {
      await this.page.locator('[data-testid="restore-target-input"]').fill(targetVolumeName);
    }

    await this.page.locator('[data-testid="confirm-restore-button"]').click();

    await expect(this.loadingSpinner).toBeVisible({ timeout: 5000 });
    await expect(this.loadingSpinner).toBeHidden({ timeout: 30000 });
    await expect(this.successToast).toBeVisible({ timeout: 10000 });
  }

  async volumeExists(volumeName: string): Promise<boolean> {
    await this.page.waitForTimeout(500);
    const row = this.volumeRows.filter({ hasText: volumeName });
    return row.count() > 0;
  }

  async isVolumeInUse(volumeName: string): Promise<boolean> {
    const row = this.volumeRows.filter({ hasText: volumeName });
    const badge = row.locator('[data-testid="in-use-badge"]');
    return badge.isVisible();
  }
}
