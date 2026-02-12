import { Page, Locator, expect } from '@playwright/test';

export class LoginPage {
  readonly page: Page;
  readonly usernameInput: Locator;
  readonly passwordInput: Locator;
  readonly loginButton: Locator;
  readonly errorMessage: Locator;
  readonly rememberMeCheckbox: Locator;
  readonly forgotPasswordLink: Locator;

  constructor(page: Page) {
    this.page = page;
    this.usernameInput = page.locator('[data-testid="username-input"]');
    this.passwordInput = page.locator('[data-testid="password-input"]');
    this.loginButton = page.locator('[data-testid="login-button"]');
    this.errorMessage = page.locator('[data-testid="login-error"]');
    this.rememberMeCheckbox = page.locator('[data-testid="remember-me-checkbox"]');
    this.forgotPasswordLink = page.locator('[data-testid="forgot-password-link"]');
  }

  async goto(): Promise<void> {
    await this.page.goto('/login');
    await this.waitForPageLoad();
  }

  async waitForPageLoad(): Promise<void> {
    await expect(this.usernameInput).toBeVisible({ timeout: 10000 });
    await expect(this.passwordInput).toBeVisible({ timeout: 10000 });
    await expect(this.loginButton).toBeVisible({ timeout: 10000 });
  }

  async login(username: string, password: string, rememberMe: boolean = false): Promise<void> {
    if (username) {
      await this.usernameInput.fill(username);
    }

    if (password) {
      await this.passwordInput.fill(password);
    }

    if (rememberMe) {
      await this.rememberMeCheckbox.check();
    }

    await this.loginButton.click();
  }

  async logout(): Promise<void> {
    await this.page.click('[data-testid="user-menu"]');
    await this.page.waitForSelector('[data-testid="logout-button"]', { timeout: 5000 });
    await this.page.click('[data-testid="logout-button"]');
    await this.page.waitForURL('**/login', { timeout: 10000 });
  }

  async isLoggedIn(): Promise<boolean> {
    try {
      await this.page.waitForSelector('[data-testid="dashboard-layout"]', { timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  async getErrorMessage(): Promise<string | null> {
    try {
      await this.errorMessage.waitFor({ state: 'visible', timeout: 5000 });
      return await this.errorMessage.textContent();
    } catch {
      return null;
    }
  }

  async hasError(): Promise<boolean> {
    try {
      await this.errorMessage.waitFor({ state: 'visible', timeout: 3000 });
      return await this.errorMessage.isVisible();
    } catch {
      return false;
    }
  }

  async clickForgotPassword(): Promise<void> {
    await this.forgotPasswordLink.click();
  }

  async fillUsername(username: string): Promise<void> {
    await this.usernameInput.fill(username);
  }

  async fillPassword(password: string): Promise<void> {
    await this.passwordInput.fill(password);
  }

  async clearForm(): Promise<void> {
    await this.usernameInput.clear();
    await this.passwordInput.clear();
    if (await this.rememberMeCheckbox.isChecked()) {
      await this.rememberMeCheckbox.uncheck();
    }
  }

  async getUsernameValidationMessage(): Promise<string | null> {
    return await this.usernameInput.evaluate((el: HTMLInputElement) => el.validationMessage);
  }

  async getPasswordValidationMessage(): Promise<string | null> {
    return await this.passwordInput.evaluate((el: HTMLInputElement) => el.validationMessage);
  }

  async waitForRedirect(urlPattern: string | RegExp, timeout: number = 10000): Promise<void> {
    await this.page.waitForURL(urlPattern, { timeout });
  }

  async assertOnLoginPage(): Promise<void> {
    await expect(this.page).toHaveURL(/.*login/);
    await expect(this.usernameInput).toBeVisible();
    await expect(this.passwordInput).toBeVisible();
  }
}
