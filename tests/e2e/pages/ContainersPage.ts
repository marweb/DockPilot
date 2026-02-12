import { expect, type Locator, type Page } from '@playwright/test';

export class ContainersPage {
  readonly page: Page;
  readonly url = '/containers';

  // Main elements
  readonly heading: Locator;
  readonly createContainerButton: Locator;
  readonly refreshButton: Locator;
  readonly searchInput: Locator;
  readonly filterSelect: Locator;
  readonly containersTable: Locator;
  readonly containersList: Locator;
  readonly emptyState: Locator;
  readonly loadingSpinner: Locator;

  // Modal elements
  readonly modal: Locator;
  readonly modalTitle: Locator;
  readonly modalConfirmButton: Locator;
  readonly modalCancelButton: Locator;
  readonly modalCloseButton: Locator;

  // Create container form
  readonly createForm: Locator;
  readonly imageInput: Locator;
  readonly nameInput: Locator;
  readonly commandInput: Locator;
  readonly addPortButton: Locator;
  readonly addEnvButton: Locator;
  readonly submitButton: Locator;

  constructor(page: Page) {
    this.page = page;

    // Main elements
    this.heading = page.locator('h1:has-text("Containers")');
    this.createContainerButton = page.locator('button:has-text("Create Container")');
    this.refreshButton = page.locator('button[aria-label="Refresh"], button:has-text("Refresh")');
    this.searchInput = page
      .locator('input[placeholder*="search" i], input[placeholder*="buscar" i]')
      .first();
    this.filterSelect = page.locator('select[name="status"], [role="combobox"]').first();
    this.containersTable = page.locator('table, [role="grid"]').first();
    this.containersList = page.locator('[data-testid="container-item"], .container-item, tr');
    this.emptyState = page.locator(
      '[data-testid="empty-state"], .empty-state, text="No containers"'
    );
    this.loadingSpinner = page.locator('[data-testid="loading"], .loading, [role="progressbar"]');

    // Modal elements
    this.modal = page.locator('[role="dialog"], .modal, [data-testid="modal"]').first();
    this.modalTitle = this.modal.locator('h2, h3, .modal-title').first();
    this.modalConfirmButton = this.modal
      .locator('button:has-text("Confirm"), button:has-text("Delete"), button:has-text("Yes")')
      .first();
    this.modalCancelButton = this.modal
      .locator('button:has-text("Cancel"), button:has-text("No")')
      .first();
    this.modalCloseButton = this.modal.locator('button[aria-label="Close"], .modal-close').first();

    // Create container form
    this.createForm = page.locator('form[data-testid="create-container-form"], form').first();
    this.imageInput = page.locator('input[name="image"], input[placeholder*="image" i]').first();
    this.nameInput = page.locator('input[name="name"], input[placeholder*="name" i]').first();
    this.commandInput = page.locator('input[name="command"], textarea[name="command"]').first();
    this.addPortButton = page
      .locator('button:has-text("Add Port"), button[data-testid="add-port"]')
      .first();
    this.addEnvButton = page
      .locator('button:has-text("Add Environment Variable"), button[data-testid="add-env"]')
      .first();
    this.submitButton = page.locator('button[type="submit"], button:has-text("Create")').first();
  }

  /**
   * Navigate to containers page
   */
  async goto(): Promise<void> {
    await this.page.goto(this.url);
    await this.waitForLoad();
  }

  /**
   * Wait for page to load
   */
  async waitForLoad(): Promise<void> {
    await expect(this.heading).toBeVisible({ timeout: 10000 });
    await this.loadingSpinner.waitFor({ state: 'hidden', timeout: 15000 });
  }

  /**
   * Get all container rows
   */
  async getContainerRows(): Promise<Locator[]> {
    return this.containersList.all();
  }

  /**
   * Get container row by name
   */
  async getContainerRowByName(name: string): Promise<Locator | null> {
    const rows = await this.getContainerRows();
    for (const row of rows) {
      const text = await row.textContent();
      if (text?.includes(name)) {
        return row;
      }
    }
    return null;
  }

  /**
   * Check if container exists in list
   */
  async hasContainer(name: string): Promise<boolean> {
    const row = await this.getContainerRowByName(name);
    return row !== null;
  }

  /**
   * Click on container to view details
   */
  async clickContainer(name: string): Promise<void> {
    const row = await this.getContainerRowByName(name);
    if (!row) {
      throw new Error(`Container "${name}" not found`);
    }
    await row.click();
    await this.page.waitForURL(/\/containers\/.+/, { timeout: 10000 });
  }

  /**
   * Search for containers
   */
  async search(query: string): Promise<void> {
    await this.searchInput.fill(query);
    await this.page.waitForTimeout(500); // Wait for debounce
    await this.loadingSpinner.waitFor({ state: 'hidden', timeout: 10000 });
  }

  /**
   * Clear search
   */
  async clearSearch(): Promise<void> {
    await this.searchInput.clear();
    await this.page.waitForTimeout(500);
    await this.loadingSpinner.waitFor({ state: 'hidden', timeout: 10000 });
  }

  /**
   * Filter by status
   */
  async filterByStatus(status: 'all' | 'running' | 'stopped' | 'exited' | 'paused'): Promise<void> {
    await this.filterSelect.selectOption(status);
    await this.loadingSpinner.waitFor({ state: 'hidden', timeout: 10000 });
  }

  /**
   * Refresh containers list
   */
  async refresh(): Promise<void> {
    await this.refreshButton.click();
    await this.loadingSpinner.waitFor({ state: 'hidden', timeout: 15000 });
  }

  /**
   * Open create container modal/form
   */
  async openCreateContainer(): Promise<void> {
    await this.createContainerButton.click();
    await expect(this.createForm).toBeVisible({ timeout: 5000 });
  }

  /**
   * Fill create container form
   */
  async fillCreateContainerForm(data: {
    image: string;
    name?: string;
    command?: string;
    ports?: Array<{ hostPort: string; containerPort: string }>;
    env?: Record<string, string>;
  }): Promise<void> {
    await this.imageInput.fill(data.image);

    if (data.name) {
      await this.nameInput.fill(data.name);
    }

    if (data.command) {
      await this.commandInput.fill(data.command);
    }

    // Add ports
    if (data.ports && data.ports.length > 0) {
      for (const port of data.ports) {
        await this.addPortButton.click();
        const portRows = this.page.locator('[data-testid="port-row"], .port-row');
        const lastRow = portRows.last();
        await lastRow.locator('input[name*="hostPort"]').fill(port.hostPort);
        await lastRow.locator('input[name*="containerPort"]').fill(port.containerPort);
      }
    }

    // Add environment variables
    if (data.env) {
      for (const [key, value] of Object.entries(data.env)) {
        await this.addEnvButton.click();
        const envRows = this.page.locator('[data-testid="env-row"], .env-row');
        const lastRow = envRows.last();
        await lastRow.locator('input[name*="key"], input[name*="name"]').fill(key);
        await lastRow.locator('input[name*="value"]').fill(value);
      }
    }
  }

  /**
   * Submit create container form
   */
  async submitCreateContainer(): Promise<void> {
    await this.submitButton.click();
    await this.loadingSpinner.waitFor({ state: 'hidden', timeout: 30000 });
  }

  /**
   * Create a new container
   */
  async createContainer(data: {
    image: string;
    name?: string;
    command?: string;
    ports?: Array<{ hostPort: string; containerPort: string }>;
    env?: Record<string, string>;
  }): Promise<void> {
    await this.openCreateContainer();
    await this.fillCreateContainerForm(data);
    await this.submitCreateContainer();
  }

  /**
   * Start a container
   */
  async startContainer(name: string): Promise<void> {
    const row = await this.getContainerRowByName(name);
    if (!row) {
      throw new Error(`Container "${name}" not found`);
    }

    const startButton = row.locator('button:has-text("Start"), button[aria-label="Start"]').first();
    await startButton.click();
    await this.loadingSpinner.waitFor({ state: 'hidden', timeout: 15000 });
  }

  /**
   * Stop a container
   */
  async stopContainer(name: string): Promise<void> {
    const row = await this.getContainerRowByName(name);
    if (!row) {
      throw new Error(`Container "${name}" not found`);
    }

    const stopButton = row.locator('button:has-text("Stop"), button[aria-label="Stop"]').first();
    await stopButton.click();
    await this.loadingSpinner.waitFor({ state: 'hidden', timeout: 15000 });
  }

  /**
   * Restart a container
   */
  async restartContainer(name: string): Promise<void> {
    const row = await this.getContainerRowByName(name);
    if (!row) {
      throw new Error(`Container "${name}" not found`);
    }

    const restartButton = row
      .locator('button:has-text("Restart"), button[aria-label="Restart"]')
      .first();
    await restartButton.click();
    await this.loadingSpinner.waitFor({ state: 'hidden', timeout: 15000 });
  }

  /**
   * Delete a container
   */
  async deleteContainer(name: string, confirm = true): Promise<void> {
    const row = await this.getContainerRowByName(name);
    if (!row) {
      throw new Error(`Container "${name}" not found`);
    }

    const deleteButton = row
      .locator(
        'button:has-text("Delete"), button[aria-label="Delete"], button[data-testid="delete"]'
      )
      .first();
    await deleteButton.click();

    // Wait for confirmation modal
    await expect(this.modal).toBeVisible({ timeout: 5000 });

    if (confirm) {
      await this.modalConfirmButton.click();
      await this.loadingSpinner.waitFor({ state: 'hidden', timeout: 15000 });
      await this.modal.waitFor({ state: 'hidden', timeout: 10000 });
    } else {
      await this.modalCancelButton.click();
      await this.modal.waitFor({ state: 'hidden', timeout: 5000 });
    }
  }

  /**
   * View container logs
   */
  async viewLogs(name: string): Promise<void> {
    const row = await this.getContainerRowByName(name);
    if (!row) {
      throw new Error(`Container "${name}" not found`);
    }

    const logsButton = row
      .locator('button:has-text("Logs"), button[aria-label="Logs"], a:has-text("Logs")')
      .first();
    await logsButton.click();
    await this.page.waitForURL(/\/containers\/.+/, { timeout: 10000 });
  }

  /**
   * Get container status
   */
  async getContainerStatus(name: string): Promise<string | null> {
    const row = await this.getContainerRowByName(name);
    if (!row) {
      return null;
    }

    const statusCell = row.locator('[data-testid="status"], .status, td:nth-child(3)').first();
    return statusCell.textContent();
  }

  /**
   * Wait for container to appear in list
   */
  async waitForContainer(name: string, timeout = 30000): Promise<void> {
    await this.page.waitForFunction(
      (containerName) => {
        const rows = document.querySelectorAll('tr, [data-testid="container-item"]');
        for (const row of rows) {
          if (row.textContent?.includes(containerName)) {
            return true;
          }
        }
        return false;
      },
      name,
      { timeout }
    );
  }

  /**
   * Wait for container to disappear from list
   */
  async waitForContainerRemoval(name: string, timeout = 30000): Promise<void> {
    await this.page.waitForFunction(
      (containerName) => {
        const rows = document.querySelectorAll('tr, [data-testid="container-item"]');
        for (const row of rows) {
          if (row.textContent?.includes(containerName)) {
            return false;
          }
        }
        return true;
      },
      name,
      { timeout }
    );
  }

  /**
   * Check if empty state is displayed
   */
  async isEmptyState(): Promise<boolean> {
    try {
      await this.emptyState.waitFor({ state: 'visible', timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get container count
   */
  async getContainerCount(): Promise<number> {
    const rows = await this.getContainerRows();
    // Filter out header row if present
    return rows.filter((row) => row.locator('td, [role="cell"]').count() > 0).length;
  }

  /**
   * Execute prune containers
   */
  async pruneContainers(): Promise<void> {
    const pruneButton = this.page
      .locator('button:has-text("Prune"), button[data-testid="prune"]')
      .first();
    await pruneButton.click();

    // Wait for confirmation modal
    await expect(this.modal).toBeVisible({ timeout: 5000 });
    await this.modalConfirmButton.click();
    await this.loadingSpinner.waitFor({ state: 'hidden', timeout: 30000 });
    await this.modal.waitFor({ state: 'hidden', timeout: 10000 });
  }
}
