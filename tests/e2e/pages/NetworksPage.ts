import { Page, Locator, expect } from '@playwright/test';

export class NetworksPage {
  readonly page: Page;
  readonly networksList: Locator;
  readonly createNetworkButton: Locator;
  readonly searchInput: Locator;
  readonly networkTable: Locator;
  readonly networkRows: Locator;
  readonly deleteButton: Locator;
  readonly confirmDeleteButton: Locator;
  readonly networkDetailsModal: Locator;
  readonly pruneButton: Locator;
  readonly connectButton: Locator;
  readonly disconnectButton: Locator;
  readonly createModal: Locator;
  readonly networkNameInput: Locator;
  readonly networkDriverSelect: Locator;
  readonly networkSubnetInput: Locator;
  readonly networkGatewayInput: Locator;
  readonly createConfirmButton: Locator;
  readonly loadingSpinner: Locator;
  readonly successToast: Locator;
  readonly errorToast: Locator;

  constructor(page: Page) {
    this.page = page;
    this.networksList = page.locator('[data-testid="networks-list"]');
    this.createNetworkButton = page.locator('[data-testid="create-network-button"]');
    this.searchInput = page.locator('[data-testid="network-search-input"]');
    this.networkTable = page.locator('[data-testid="networks-table"]');
    this.networkRows = page.locator('[data-testid="network-row"]');
    this.deleteButton = page.locator('[data-testid="delete-network-button"]');
    this.confirmDeleteButton = page.locator('[data-testid="confirm-delete-button"]');
    this.networkDetailsModal = page.locator('[data-testid="network-details-modal"]');
    this.pruneButton = page.locator('[data-testid="prune-networks-button"]');
    this.connectButton = page.locator('[data-testid="connect-container-button"]');
    this.disconnectButton = page.locator('[data-testid="disconnect-container-button"]');
    this.createModal = page.locator('[data-testid="create-network-modal"]');
    this.networkNameInput = page.locator('[data-testid="network-name-input"]');
    this.networkDriverSelect = page.locator('[data-testid="network-driver-select"]');
    this.networkSubnetInput = page.locator('[data-testid="network-subnet-input"]');
    this.networkGatewayInput = page.locator('[data-testid="network-gateway-input"]');
    this.createConfirmButton = page.locator('[data-testid="create-confirm-button"]');
    this.loadingSpinner = page.locator('[data-testid="loading-spinner"]');
    this.successToast = page.locator('[data-testid="success-toast"]');
    this.errorToast = page.locator('[data-testid="error-toast"]');
  }

  async goto(): Promise<void> {
    await this.page.goto('/networks');
    await this.waitForPageLoad();
  }

  async waitForPageLoad(): Promise<void> {
    await expect(this.networksList).toBeVisible({ timeout: 10000 });
  }

  async getNetworkCount(): Promise<number> {
    await this.page.waitForSelector('[data-testid="network-row"]', { timeout: 5000 });
    return this.networkRows.count();
  }

  async createNetwork(
    name: string,
    driver = 'bridge',
    options?: {
      subnet?: string;
      gateway?: string;
      internal?: boolean;
      attachable?: boolean;
    }
  ): Promise<void> {
    await this.createNetworkButton.click();
    await expect(this.createModal).toBeVisible();

    await this.networkNameInput.fill(name);
    await this.networkDriverSelect.selectOption(driver);

    if (options?.subnet) {
      await this.networkSubnetInput.fill(options.subnet);
    }

    if (options?.gateway) {
      await this.networkGatewayInput.fill(options.gateway);
    }

    if (options?.internal) {
      await this.page.locator('[data-testid="network-internal-checkbox"]').check();
    }

    if (options?.attachable) {
      await this.page.locator('[data-testid="network-attachable-checkbox"]').check();
    }

    await this.createConfirmButton.click();
    await expect(this.successToast).toBeVisible({ timeout: 10000 });
  }

  async searchNetwork(query: string): Promise<void> {
    await this.searchInput.fill(query);
    await this.page.waitForTimeout(500);
  }

  async deleteNetwork(networkName: string): Promise<void> {
    const row = this.networkRows.filter({ hasText: networkName });
    await row.locator('[data-testid="delete-network-button"]').click();
    await expect(this.confirmDeleteButton).toBeVisible();
    await this.confirmDeleteButton.click();
    await expect(this.successToast).toBeVisible({ timeout: 10000 });
  }

  async viewNetworkDetails(networkName: string): Promise<void> {
    const row = this.networkRows.filter({ hasText: networkName });
    await row.locator('[data-testid="view-details-button"]').click();
    await expect(this.networkDetailsModal).toBeVisible();
  }

  async getNetworkDetails(): Promise<{
    name: string;
    driver: string;
    subnet: string;
    gateway: string;
    scope: string;
    internal: boolean;
    containers: string[];
  }> {
    await expect(this.networkDetailsModal).toBeVisible();

    const containers = await this.page
      .locator('[data-testid="network-containers"] [data-testid="container-name"]')
      .allTextContents();

    return {
      name: (await this.page.locator('[data-testid="network-name"]').textContent()) || '',
      driver: (await this.page.locator('[data-testid="network-driver"]').textContent()) || '',
      subnet: (await this.page.locator('[data-testid="network-subnet"]').textContent()) || '',
      gateway: (await this.page.locator('[data-testid="network-gateway"]').textContent()) || '',
      scope: (await this.page.locator('[data-testid="network-scope"]').textContent()) || '',
      internal:
        (await this.page.locator('[data-testid="network-internal"]').textContent()) === 'true',
      containers,
    };
  }

  async closeNetworkDetails(): Promise<void> {
    await this.page.locator('[data-testid="close-modal-button"]').click();
    await expect(this.networkDetailsModal).toBeHidden();
  }

  async connectContainer(networkName: string, containerName: string): Promise<void> {
    await this.viewNetworkDetails(networkName);
    await this.page.locator('[data-testid="connect-container-button"]').click();

    await expect(this.page.locator('[data-testid="connect-modal"]')).toBeVisible();
    await this.page.locator('[data-testid="container-select"]').selectOption(containerName);
    await this.page.locator('[data-testid="confirm-connect-button"]').click();

    await expect(this.successToast).toBeVisible({ timeout: 10000 });
    await this.closeNetworkDetails();
  }

  async disconnectContainer(networkName: string, containerName: string): Promise<void> {
    await this.viewNetworkDetails(networkName);

    const containerRow = this.page
      .locator('[data-testid="network-containers"]')
      .filter({ hasText: containerName });
    await containerRow.locator('[data-testid="disconnect-button"]').click();

    await expect(this.page.locator('[data-testid="disconnect-confirm-modal"]')).toBeVisible();
    await this.page.locator('[data-testid="confirm-disconnect-button"]').click();

    await expect(this.successToast).toBeVisible({ timeout: 10000 });
    await this.closeNetworkDetails();
  }

  async pruneNetworks(): Promise<number> {
    await this.pruneButton.click();
    await expect(this.page.locator('[data-testid="prune-confirm-modal"]')).toBeVisible();
    await this.page.locator('[data-testid="confirm-prune-button"]').click();

    await expect(this.successToast).toBeVisible({ timeout: 10000 });
    const message = (await this.successToast.textContent()) || '';
    const match = message.match(/(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  }

  async networkExists(networkName: string): Promise<boolean> {
    await this.page.waitForTimeout(500);
    const row = this.networkRows.filter({ hasText: networkName });
    return row.count() > 0;
  }

  async isContainerConnected(networkName: string, containerName: string): Promise<boolean> {
    await this.viewNetworkDetails(networkName);
    const containers = await this.page
      .locator('[data-testid="network-containers"]')
      .allTextContents();
    await this.closeNetworkDetails();
    return containers.some((c) => c.includes(containerName));
  }

  async getNetworkContainers(networkName: string): Promise<string[]> {
    await this.viewNetworkDetails(networkName);
    const containers = await this.page
      .locator('[data-testid="network-containers"] [data-testid="container-name"]')
      .allTextContents();
    await this.closeNetworkDetails();
    return containers;
  }
}
