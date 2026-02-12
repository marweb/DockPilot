import { Page, Locator, expect } from '@playwright/test';

export interface AdminFormData {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export class SetupPage {
  readonly page: Page;
  readonly usernameInput: Locator;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly confirmPasswordInput: Locator;
  readonly submitButton: Locator;
  readonly setupWizard: Locator;
  readonly welcomeMessage: Locator;
  readonly progressSteps: Locator;

  constructor(page: Page) {
    this.page = page;
    this.usernameInput = page.locator('[data-testid="setup-username-input"]');
    this.emailInput = page.locator('[data-testid="setup-email-input"]');
    this.passwordInput = page.locator('[data-testid="setup-password-input"]');
    this.confirmPasswordInput = page.locator('[data-testid="setup-confirm-password-input"]');
    this.submitButton = page.locator('[data-testid="setup-submit-button"]');
    this.setupWizard = page.locator('[data-testid="setup-wizard"]');
    this.welcomeMessage = page.locator('[data-testid="setup-welcome"]');
    this.progressSteps = page.locator('[data-testid="setup-steps"]');
  }

  async goto(): Promise<void> {
    await this.page.goto('/setup');
    await this.waitForPageLoad();
  }

  async waitForPageLoad(): Promise<void> {
    await expect(this.setupWizard).toBeVisible({ timeout: 10000 });
    await expect(this.usernameInput).toBeVisible({ timeout: 10000 });
    await expect(this.emailInput).toBeVisible({ timeout: 10000 });
    await expect(this.passwordInput).toBeVisible({ timeout: 10000 });
    await expect(this.confirmPasswordInput).toBeVisible({ timeout: 10000 });
    await expect(this.submitButton).toBeVisible({ timeout: 10000 });
  }

  async fillAdminForm(data: Partial<AdminFormData>): Promise<void> {
    if (data.username !== undefined) {
      await this.usernameInput.fill(data.username);
    }

    if (data.email !== undefined) {
      await this.emailInput.fill(data.email);
    }

    if (data.password !== undefined) {
      await this.passwordInput.fill(data.password);
    }

    if (data.confirmPassword !== undefined) {
      await this.confirmPasswordInput.fill(data.confirmPassword);
    }
  }

  async submitAdminForm(): Promise<void> {
    await this.submitButton.click();
  }

  async completeSetup(
    data: Omit<AdminFormData, 'confirmPassword'> & { confirmPassword?: string }
  ): Promise<void> {
    const formData: AdminFormData = {
      username: data.username,
      email: data.email,
      password: data.password,
      confirmPassword: data.confirmPassword || data.password,
    };

    await this.fillAdminForm(formData);
    await this.submitAdminForm();

    await this.page.waitForURL('/dashboard', { timeout: 15000 });
  }

  async isSetupWizardVisible(): Promise<boolean> {
    try {
      await this.setupWizard.waitFor({ state: 'visible', timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  async getWelcomeMessage(): Promise<string | null> {
    try {
      return await this.welcomeMessage.textContent();
    } catch {
      return null;
    }
  }

  async getFieldError(
    fieldName: 'username' | 'email' | 'password' | 'confirmPassword'
  ): Promise<string | null> {
    const errorLocator = this.page.locator(`[data-testid="${fieldName}-error"]`);
    try {
      await errorLocator.waitFor({ state: 'visible', timeout: 3000 });
      return await errorLocator.textContent();
    } catch {
      return null;
    }
  }

  async hasFieldError(
    fieldName: 'username' | 'email' | 'password' | 'confirmPassword'
  ): Promise<boolean> {
    const errorLocator = this.page.locator(`[data-testid="${fieldName}-error"]`);
    try {
      await errorLocator.waitFor({ state: 'visible', timeout: 3000 });
      return await errorLocator.isVisible();
    } catch {
      return false;
    }
  }

  async clearForm(): Promise<void> {
    await this.usernameInput.clear();
    await this.emailInput.clear();
    await this.passwordInput.clear();
    await this.confirmPasswordInput.clear();
  }

  async getCurrentStep(): Promise<number> {
    const activeStep = await this.page
      .locator('[data-testid^="step-"].active, [data-testid^="step-"][aria-current="step"]')
      .count();
    if (activeStep > 0) {
      const stepElement = await this.page
        .locator('[data-testid^="step-"].active, [data-testid^="step-"][aria-current="step"]')
        .first();
      const testId = await stepElement.getAttribute('data-testid');
      if (testId) {
        const match = testId.match(/step-(\d+)/);
        return match ? parseInt(match[1], 10) : 1;
      }
    }
    return 1;
  }

  async getProgressSteps(): Promise<number> {
    return await this.page.locator('[data-testid^="step-"]').count();
  }

  async assertOnSetupPage(): Promise<void> {
    await expect(this.page).toHaveURL('/setup');
    await expect(this.setupWizard).toBeVisible();
    await expect(this.usernameInput).toBeVisible();
  }

  async assertSetupComplete(): Promise<void> {
    await expect(this.page).toHaveURL('/dashboard', { timeout: 15000 });
    await expect(this.page.locator('[data-testid="dashboard-layout"]')).toBeVisible();
  }

  async fillUsername(username: string): Promise<void> {
    await this.usernameInput.fill(username);
  }

  async fillEmail(email: string): Promise<void> {
    await this.emailInput.fill(email);
  }

  async fillPassword(password: string): Promise<void> {
    await this.passwordInput.fill(password);
  }

  async fillConfirmPassword(confirmPassword: string): Promise<void> {
    await this.confirmPasswordInput.fill(confirmPassword);
  }

  async getUsernameValidationMessage(): Promise<string | null> {
    return await this.usernameInput.evaluate((el: HTMLInputElement) => el.validationMessage);
  }

  async getEmailValidationMessage(): Promise<string | null> {
    return await this.emailInput.evaluate((el: HTMLInputElement) => el.validationMessage);
  }

  async getPasswordValidationMessage(): Promise<string | null> {
    return await this.passwordInput.evaluate((el: HTMLInputElement) => el.validationMessage);
  }

  async getConfirmPasswordValidationMessage(): Promise<string | null> {
    return await this.confirmPasswordInput.evaluate((el: HTMLInputElement) => el.validationMessage);
  }

  async isSubmitButtonEnabled(): Promise<boolean> {
    return await this.submitButton.isEnabled();
  }

  async isSubmitButtonDisabled(): Promise<boolean> {
    return await this.submitButton.isDisabled();
  }
}
