import { test, expect } from '@playwright/test';
import { SetupPage } from './pages/SetupPage';
import { LoginPage } from './pages/LoginPage';

test.describe('Initial Setup', () => {
  let setupPage: SetupPage;
  let loginPage: LoginPage;

  test.beforeEach(async ({ page, context }) => {
    setupPage = new SetupPage(page);
    loginPage = new LoginPage(page);

    await context.clearCookies();
    await context.clearPermissions();

    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    await page.goto('/');
  });

  test.describe('Setup Wizard Display', () => {
    test('setup wizard appears when no users exist', async ({ page }) => {
      await expect(page).toHaveURL('/setup', { timeout: 10000 });
      await expect(page.locator('[data-testid="setup-wizard"]')).toBeVisible();
      await expect(page.locator('[data-testid="setup-title"]')).toContainText('Initial Setup');
    });

    test('setup wizard displays welcome message', async ({ page }) => {
      await expect(page.locator('[data-testid="setup-welcome"]')).toBeVisible();
      await expect(page.locator('[data-testid="setup-welcome"]')).toContainText(
        'Welcome to DockPilot'
      );
    });

    test('setup wizard shows progress steps', async ({ page }) => {
      await expect(page.locator('[data-testid="setup-steps"]')).toBeVisible();
      await expect(page.locator('[data-testid="step-1"]')).toContainText('Admin Account');
    });
  });

  test.describe('Admin Account Creation', () => {
    test('can create initial admin user', async ({ page }) => {
      await setupPage.fillAdminForm({
        username: 'admin',
        email: 'admin@dockpilot.local',
        password: 'AdminPassword123!',
        confirmPassword: 'AdminPassword123!',
      });

      await setupPage.submitAdminForm();

      await expect(page).toHaveURL('/dashboard', { timeout: 15000 });
      await expect(page.locator('[data-testid="dashboard-layout"]')).toBeVisible();
    });

    test('auto-logs in after successful setup', async ({ page }) => {
      await setupPage.completeSetup({
        username: 'admin',
        email: 'admin@dockpilot.local',
        password: 'AdminPassword123!',
      });

      await expect(page.locator('[data-testid="user-menu"]')).toContainText('admin');
    });
  });

  test.describe('Form Validation', () => {
    test('validates required fields', async () => {
      await setupPage.submitAdminForm();

      await expect(setupPage.usernameInput).toHaveAttribute('required');
      await expect(setupPage.emailInput).toHaveAttribute('required');
      await expect(setupPage.passwordInput).toHaveAttribute('required');
      await expect(setupPage.confirmPasswordInput).toHaveAttribute('required');
    });

    test('validates username format', async ({ page }) => {
      await setupPage.fillAdminForm({
        username: 'ab',
        email: 'admin@dockpilot.local',
        password: 'AdminPassword123!',
        confirmPassword: 'AdminPassword123!',
      });

      await setupPage.submitAdminForm();

      await expect(page.locator('[data-testid="username-error"]')).toBeVisible();
      await expect(page.locator('[data-testid="username-error"]')).toContainText(
        'at least 3 characters'
      );
    });

    test('validates email format', async ({ page }) => {
      await setupPage.fillAdminForm({
        username: 'admin',
        email: 'invalid-email',
        password: 'AdminPassword123!',
        confirmPassword: 'AdminPassword123!',
      });

      await setupPage.submitAdminForm();

      await expect(page.locator('[data-testid="email-error"]')).toBeVisible();
      await expect(page.locator('[data-testid="email-error"]')).toContainText('valid email');
    });

    test('validates password complexity', async ({ page }) => {
      await setupPage.fillAdminForm({
        username: 'admin',
        email: 'admin@dockpilot.local',
        password: '123',
        confirmPassword: '123',
      });

      await setupPage.submitAdminForm();

      await expect(page.locator('[data-testid="password-error"]')).toBeVisible();
      await expect(page.locator('[data-testid="password-error"]')).toContainText(
        'at least 8 characters'
      );
    });

    test('validates password confirmation match', async ({ page }) => {
      await setupPage.fillAdminForm({
        username: 'admin',
        email: 'admin@dockpilot.local',
        password: 'AdminPassword123!',
        confirmPassword: 'DifferentPassword123!',
      });

      await setupPage.submitAdminForm();

      await expect(page.locator('[data-testid="confirm-password-error"]')).toBeVisible();
      await expect(page.locator('[data-testid="confirm-password-error"]')).toContainText(
        'passwords do not match'
      );
    });

    test('validates password has uppercase, lowercase, and number', async ({ page }) => {
      await setupPage.fillAdminForm({
        username: 'admin',
        email: 'admin@dockpilot.local',
        password: 'lowercaseonly',
        confirmPassword: 'lowercaseonly',
      });

      await setupPage.submitAdminForm();

      await expect(page.locator('[data-testid="password-error"]')).toContainText('uppercase');
    });
  });

  test.describe('Redirection After Setup', () => {
    test('redirects to dashboard after successful setup', async ({ page }) => {
      await setupPage.completeSetup({
        username: 'admin',
        email: 'admin@dockpilot.local',
        password: 'AdminPassword123!',
      });

      await expect(page).toHaveURL('/dashboard', { timeout: 15000 });
    });

    test('cannot access setup page after setup is complete', async ({ page }) => {
      await setupPage.completeSetup({
        username: 'admin',
        email: 'admin@dockpilot.local',
        password: 'AdminPassword123!',
      });

      await page.goto('/setup');

      await expect(page).toHaveURL('/login', { timeout: 10000 });
    });
  });

  test.describe('Setup Form UI', () => {
    test('displays all form fields', async () => {
      await expect(setupPage.usernameInput).toBeVisible();
      await expect(setupPage.emailInput).toBeVisible();
      await expect(setupPage.passwordInput).toBeVisible();
      await expect(setupPage.confirmPasswordInput).toBeVisible();
      await expect(setupPage.submitButton).toBeVisible();
    });

    test('password fields mask input', async () => {
      await setupPage.passwordInput.fill('testpassword');
      await setupPage.confirmPasswordInput.fill('testpassword');

      await expect(setupPage.passwordInput).toHaveAttribute('type', 'password');
      await expect(setupPage.confirmPasswordInput).toHaveAttribute('type', 'password');
    });

    test('submit button shows loading state', async ({ page }) => {
      await setupPage.fillAdminForm({
        username: 'admin',
        email: 'admin@dockpilot.local',
        password: 'AdminPassword123!',
        confirmPassword: 'AdminPassword123!',
      });

      const submitPromise = setupPage.submitButton.click();
      await expect(setupPage.submitButton).toBeDisabled({ timeout: 1000 });
      await submitPromise;
    });
  });
});
