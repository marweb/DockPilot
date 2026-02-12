import { Page, Locator, expect } from '@playwright/test';

export class ComposePage {
  readonly page: Page;
  readonly stacksList: Locator;
  readonly deployStackButton: Locator;
  readonly deployFromFileButton: Locator;
  readonly deployFromEditorButton: Locator;
  readonly searchInput: Locator;
  readonly stackTable: Locator;
  readonly stackRows: Locator;
  readonly deleteButton: Locator;
  readonly confirmDeleteButton: Locator;
  readonly stackDetailsModal: Locator;
  readonly logsButton: Locator;
  readonly scaleButton: Locator;
  readonly stopButton: Locator;
  readonly startButton: Locator;
  readonly pullButton: Locator;
  readonly buildButton: Locator;
  readonly deployModal: Locator;
  readonly stackNameInput: Locator;
  readonly fileUploadInput: Locator;
  readonly yamlEditor: Locator;
  readonly validateButton: Locator;
  readonly deployConfirmButton: Locator;
  readonly loadingSpinner: Locator;
  readonly successToast: Locator;
  readonly errorToast: Locator;
  readonly logsModal: Locator;
  readonly logsOutput: Locator;
  readonly scaleModal: Locator;
  readonly serviceReplicasInput: Locator;

  constructor(page: Page) {
    this.page = page;
    this.stacksList = page.locator('[data-testid="stacks-list"]');
    this.deployStackButton = page.locator('[data-testid="deploy-stack-button"]');
    this.deployFromFileButton = page.locator('[data-testid="deploy-from-file-button"]');
    this.deployFromEditorButton = page.locator('[data-testid="deploy-from-editor-button"]');
    this.searchInput = page.locator('[data-testid="stack-search-input"]');
    this.stackTable = page.locator('[data-testid="stacks-table"]');
    this.stackRows = page.locator('[data-testid="stack-row"]');
    this.deleteButton = page.locator('[data-testid="delete-stack-button"]');
    this.confirmDeleteButton = page.locator('[data-testid="confirm-delete-button"]');
    this.stackDetailsModal = page.locator('[data-testid="stack-details-modal"]');
    this.logsButton = page.locator('[data-testid="view-logs-button"]');
    this.scaleButton = page.locator('[data-testid="scale-service-button"]');
    this.stopButton = page.locator('[data-testid="stop-stack-button"]');
    this.startButton = page.locator('[data-testid="start-stack-button"]');
    this.pullButton = page.locator('[data-testid="pull-images-button"]');
    this.buildButton = page.locator('[data-testid="build-images-button"]');
    this.deployModal = page.locator('[data-testid="deploy-stack-modal"]');
    this.stackNameInput = page.locator('[data-testid="stack-name-input"]');
    this.fileUploadInput = page.locator('[data-testid="file-upload-input"]');
    this.yamlEditor = page.locator('[data-testid="yaml-editor"]');
    this.validateButton = page.locator('[data-testid="validate-compose-button"]');
    this.deployConfirmButton = page.locator('[data-testid="deploy-confirm-button"]');
    this.loadingSpinner = page.locator('[data-testid="loading-spinner"]');
    this.successToast = page.locator('[data-testid="success-toast"]');
    this.errorToast = page.locator('[data-testid="error-toast"]');
    this.logsModal = page.locator('[data-testid="logs-modal"]');
    this.logsOutput = page.locator('[data-testid="logs-output"]');
    this.scaleModal = page.locator('[data-testid="scale-modal"]');
    this.serviceReplicasInput = page.locator('[data-testid="service-replicas-input"]');
  }

  async goto(): Promise<void> {
    await this.page.goto('/compose');
    await this.waitForPageLoad();
  }

  async waitForPageLoad(): Promise<void> {
    await expect(this.stacksList).toBeVisible({ timeout: 10000 });
  }

  async getStackCount(): Promise<number> {
    await this.page.waitForSelector('[data-testid="stack-row"]', { timeout: 5000 });
    return this.stackRows.count();
  }

  async deployFromFile(stackName: string, filePath: string, timeout = 60000): Promise<void> {
    await this.deployStackButton.click();
    await expect(this.deployModal).toBeVisible();

    await this.deployFromFileButton.click();
    await this.stackNameInput.fill(stackName);

    const [fileChooser] = await Promise.all([
      this.page.waitForEvent('filechooser'),
      this.fileUploadInput.click(),
    ]);
    await fileChooser.setFiles(filePath);

    await this.deployConfirmButton.click();

    await expect(this.loadingSpinner).toBeVisible({ timeout: 5000 });
    await expect(this.loadingSpinner).toBeHidden({ timeout });
    await expect(this.successToast).toBeVisible({ timeout: 10000 });
  }

  async deployFromEditor(stackName: string, composeYaml: string, timeout = 60000): Promise<void> {
    await this.deployStackButton.click();
    await expect(this.deployModal).toBeVisible();

    await this.deployFromEditorButton.click();
    await this.stackNameInput.fill(stackName);
    await this.yamlEditor.fill(composeYaml);

    await this.deployConfirmButton.click();

    await expect(this.loadingSpinner).toBeVisible({ timeout: 5000 });
    await expect(this.loadingSpinner).toBeHidden({ timeout });
    await expect(this.successToast).toBeVisible({ timeout: 10000 });
  }

  async validateComposeFile(composeYaml: string): Promise<{
    valid: boolean;
    errors: string[];
  }> {
    await this.deployStackButton.click();
    await expect(this.deployModal).toBeVisible();

    await this.deployFromEditorButton.click();
    await this.yamlEditor.fill(composeYaml);
    await this.validateButton.click();

    await this.page.waitForTimeout(1000);

    const validationResult = this.page.locator('[data-testid="validation-result"]');
    const isValid = await validationResult
      .locator('[data-testid="validation-success"]')
      .isVisible()
      .catch(() => false);

    const errors: string[] = [];
    if (!isValid) {
      const errorElements = await validationResult
        .locator('[data-testid="validation-error"]')
        .allTextContents();
      errors.push(...errorElements);
    }

    await this.page.locator('[data-testid="close-modal-button"]').click();
    await expect(this.deployModal).toBeHidden();

    return { valid: isValid, errors };
  }

  async viewStackLogs(stackName: string, timeout = 10000): Promise<string> {
    const row = this.stackRows.filter({ hasText: stackName });
    await row.locator('[data-testid="view-logs-button"]').click();

    await expect(this.logsModal).toBeVisible();
    await this.page.waitForTimeout(timeout);

    const logs = (await this.logsOutput.textContent()) || '';
    return logs;
  }

  async closeLogsModal(): Promise<void> {
    await this.page.locator('[data-testid="close-logs-button"]').click();
    await expect(this.logsModal).toBeHidden();
  }

  async scaleService(stackName: string, serviceName: string, replicas: number): Promise<void> {
    const row = this.stackRows.filter({ hasText: stackName });
    await row.locator('[data-testid="scale-service-button"]').click();

    await expect(this.scaleModal).toBeVisible();

    const serviceRow = this.page
      .locator('[data-testid="service-row"]')
      .filter({ hasText: serviceName });
    await serviceRow.locator('[data-testid="service-replicas-input"]').fill(replicas.toString());

    await this.page.locator('[data-testid="confirm-scale-button"]').click();
    await expect(this.successToast).toBeVisible({ timeout: 10000 });
  }

  async stopStack(stackName: string): Promise<void> {
    const row = this.stackRows.filter({ hasText: stackName });
    await row.locator('[data-testid="stop-stack-button"]').click();

    await expect(this.page.locator('[data-testid="stop-confirm-modal"]')).toBeVisible();
    await this.page.locator('[data-testid="confirm-stop-button"]').click();

    await expect(this.successToast).toBeVisible({ timeout: 10000 });
  }

  async startStack(stackName: string): Promise<void> {
    const row = this.stackRows.filter({ hasText: stackName });
    await row.locator('[data-testid="start-stack-button"]').click();
    await expect(this.successToast).toBeVisible({ timeout: 10000 });
  }

  async removeStack(stackName: string, removeVolumes = false): Promise<void> {
    const row = this.stackRows.filter({ hasText: stackName });
    await row.locator('[data-testid="delete-stack-button"]').click();

    await expect(this.page.locator('[data-testid="remove-confirm-modal"]')).toBeVisible();

    if (removeVolumes) {
      await this.page.locator('[data-testid="remove-volumes-checkbox"]').check();
    }

    await this.page.locator('[data-testid="confirm-remove-button"]').click();
    await expect(this.successToast).toBeVisible({ timeout: 10000 });
  }

  async pullStackImages(stackName: string, timeout = 120000): Promise<void> {
    const row = this.stackRows.filter({ hasText: stackName });
    await row.locator('[data-testid="pull-images-button"]').click();

    await expect(this.loadingSpinner).toBeVisible({ timeout: 5000 });
    await expect(this.loadingSpinner).toBeHidden({ timeout });
    await expect(this.successToast).toBeVisible({ timeout: 10000 });
  }

  async buildStackImages(stackName: string, timeout = 300000): Promise<void> {
    const row = this.stackRows.filter({ hasText: stackName });
    await row.locator('[data-testid="build-images-button"]').click();

    await expect(this.loadingSpinner).toBeVisible({ timeout: 5000 });
    await expect(this.loadingSpinner).toBeHidden({ timeout });
    await expect(this.successToast).toBeVisible({ timeout: 10000 });
  }

  async viewStackDetails(stackName: string): Promise<void> {
    const row = this.stackRows.filter({ hasText: stackName });
    await row.locator('[data-testid="view-details-button"]').click();
    await expect(this.stackDetailsModal).toBeVisible();
  }

  async getStackDetails(): Promise<{
    name: string;
    status: string;
    services: Array<{
      name: string;
      status: string;
      replicas: string;
    }>;
  }> {
    await expect(this.stackDetailsModal).toBeVisible();

    const serviceRows = this.page.locator('[data-testid="service-row"]');
    const count = await serviceRows.count();
    const services = [];

    for (let i = 0; i < count; i++) {
      const row = serviceRows.nth(i);
      services.push({
        name: (await row.locator('[data-testid="service-name"]').textContent()) || '',
        status: (await row.locator('[data-testid="service-status"]').textContent()) || '',
        replicas: (await row.locator('[data-testid="service-replicas"]').textContent()) || '',
      });
    }

    return {
      name: (await this.page.locator('[data-testid="stack-name"]').textContent()) || '',
      status: (await this.page.locator('[data-testid="stack-status"]').textContent()) || '',
      services,
    };
  }

  async closeStackDetails(): Promise<void> {
    await this.page.locator('[data-testid="close-modal-button"]').click();
    await expect(this.stackDetailsModal).toBeHidden();
  }

  async stackExists(stackName: string): Promise<boolean> {
    await this.page.waitForTimeout(500);
    const row = this.stackRows.filter({ hasText: stackName });
    return row.count() > 0;
  }

  async getStackStatus(stackName: string): Promise<string> {
    const row = this.stackRows.filter({ hasText: stackName });
    return row.locator('[data-testid="stack-status"]').textContent() || '';
  }

  async searchStack(query: string): Promise<void> {
    await this.searchInput.fill(query);
    await this.page.waitForTimeout(500);
  }

  async waitForStackStatus(
    stackName: string,
    expectedStatus: string,
    timeout = 60000
  ): Promise<void> {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      await this.page.reload();
      await this.waitForPageLoad();
      const status = await this.getStackStatus(stackName);
      if (status.toLowerCase() === expectedStatus.toLowerCase()) {
        return;
      }
      await this.page.waitForTimeout(2000);
    }
    throw new Error(
      `Stack ${stackName} did not reach status ${expectedStatus} within ${timeout}ms`
    );
  }
}
