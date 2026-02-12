import { test, expect, Page, BrowserContext } from '@playwright/test';
import { LoginPage } from './pages/LoginPage';

test.describe('Authentication', () => {
  let loginPage: LoginPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    await page.goto('/login');
  });

  test.afterEach(async ({ context }) => {
    await context.clearCookies();
    await context.clearPermissions();
  });

  test.describe('Login', () => {
    test('successful login with valid credentials', async ({ page }) => {
      await loginPage.login('admin', 'AdminPassword123!');

      await expect(page).toHaveURL('/dashboard', { timeout: 10000 });
      await expect(page.locator('[data-testid="dashboard-layout"]')).toBeVisible();
      await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();
    });

    test('failed login with invalid credentials', async ({ page }) => {
      await loginPage.login('invaliduser', 'wrongpassword');

      await expect(page).toHaveURL('/login');
      await expect(loginPage.errorMessage).toBeVisible();
      await expect(loginPage.errorMessage).toContainText('Invalid credentials');
    });

    test('failed login with empty fields', async () => {
      await loginPage.login('', '');

      await expect(loginPage.usernameInput).toHaveAttribute('required');
      await expect(loginPage.passwordInput).toHaveAttribute('required');
    });

    test('failed login with only username', async ({ page }) => {
      await loginPage.login('admin', '');

      await expect(page).toHaveURL('/login');
      await expect(loginPage.passwordInput).toHaveAttribute('required');
    });

    test('failed login with only password', async ({ page }) => {
      await loginPage.login('', 'AdminPassword123!');

      await expect(page).toHaveURL('/login');
      await expect(loginPage.usernameInput).toHaveAttribute('required');
    });
  });

  test.describe('Logout', () => {
    test('logout works correctly', async ({ page, context }) => {
      await loginPage.login('admin', 'AdminPassword123!');
      await expect(page).toHaveURL('/dashboard', { timeout: 10000 });

      await loginPage.logout();

      await expect(page).toHaveURL('/login', { timeout: 10000 });
      await expect(page.locator('[data-testid="login-form"]')).toBeVisible();
    });

    test('logout clears session cookies', async ({ page, context }) => {
      await loginPage.login('admin', 'AdminPassword123!');
      await page.waitForURL('/dashboard');

      const cookiesBefore = await context.cookies();
      expect(
        cookiesBefore.some((c) => c.name.includes('session') || c.name.includes('auth'))
      ).toBeTruthy();

      await loginPage.logout();

      const cookiesAfter = await context.cookies();
      expect(
        cookiesAfter.some((c) => c.name.includes('session') || c.name.includes('auth'))
      ).toBeFalsy();
    });
  });

  test.describe('Route Protection', () => {
    test('redirects to login when accessing protected routes without authentication', async ({
      page,
    }) => {
      await page.goto('/dashboard');

      await expect(page).toHaveURL('/login?redirect=/dashboard', { timeout: 5000 });
      await expect(page.locator('[data-testid="login-form"]')).toBeVisible();
    });

    test('redirects to login when accessing containers without authentication', async ({
      page,
    }) => {
      await page.goto('/containers');

      await expect(page).toHaveURL('/login?redirect=/containers', { timeout: 5000 });
    });

    test('redirects to login when accessing images without authentication', async ({ page }) => {
      await page.goto('/images');

      await expect(page).toHaveURL('/login?redirect=/images', { timeout: 5000 });
    });

    test('redirects to login when accessing networks without authentication', async ({ page }) => {
      await page.goto('/networks');

      await expect(page).toHaveURL('/login?redirect=/networks', { timeout: 5000 });
    });

    test('redirects to login when accessing volumes without authentication', async ({ page }) => {
      await page.goto('/volumes');

      await expect(page).toHaveURL('/login?redirect=/volumes', { timeout: 5000 });
    });

    test('redirects to login when accessing settings without authentication', async ({ page }) => {
      await page.goto('/settings');

      await expect(page).toHaveURL('/login?redirect=/settings', { timeout: 5000 });
    });
  });

  test.describe('Session Persistence', () => {
    test('session persists after page refresh', async ({ page }) => {
      await loginPage.login('admin', 'AdminPassword123!');
      await page.waitForURL('/dashboard');

      await page.reload();

      await expect(page).toHaveURL('/dashboard');
      await expect(page.locator('[data-testid="dashboard-layout"]')).toBeVisible();
    });

    test('session persists in new tab', async ({ browser, context }) => {
      const page1 = await context.newPage();
      loginPage = new LoginPage(page1);

      await loginPage.login('admin', 'AdminPassword123!');
      await page1.waitForURL('/dashboard');

      const page2 = await context.newPage();
      await page2.goto('/dashboard');

      await expect(page2).toHaveURL('/dashboard');
      await expect(page2.locator('[data-testid="dashboard-layout"]')).toBeVisible();

      await page1.close();
      await page2.close();
    });
  });

  test.describe('Redirect After Login', () => {
    test('redirects to original URL after login', async ({ page }) => {
      await page.goto('/containers');
      await page.waitForURL('/login?redirect=/containers');

      await loginPage.login('admin', 'AdminPassword123!');

      await expect(page).toHaveURL('/containers', { timeout: 10000 });
    });
  });

  test.describe('Login Form UI', () => {
    test('displays login form correctly', async ({ page }) => {
      await expect(loginPage.usernameInput).toBeVisible();
      await expect(loginPage.passwordInput).toBeVisible();
      await expect(loginPage.loginButton).toBeVisible();
      await expect(loginPage.loginButton).toContainText('Sign In');
    });

    test('password input masks characters', async () => {
      await loginPage.passwordInput.fill('testpassword');
      await expect(loginPage.passwordInput).toHaveAttribute('type', 'password');
    });

    test('login button is disabled during submission', async ({ page }) => {
      await loginPage.usernameInput.fill('admin');
      await loginPage.passwordInput.fill('AdminPassword123!');

      const submitPromise = loginPage.loginButton.click();

      await expect(loginPage.loginButton).toBeDisabled({ timeout: 1000 });
      await submitPromise;
    });
  });
});

test.describe('Token Refresh', () => {
  let loginPage: LoginPage;

  test('automatic token refresh', async ({ page, context }) => {
    loginPage = new LoginPage(page);
    await loginPage.login('admin', 'AdminPassword123!');
    await page.waitForURL('/dashboard');

    await page.evaluate(() => {
      localStorage.setItem('accessToken', 'expired_token');
    });

    await page.reload();

    const token = await page.evaluate(() => localStorage.getItem('accessToken'));
    expect(token).not.toBe('expired_token');
  });

  test('redirects to login when refresh token is invalid', async ({ page }) => {
    loginPage = new LoginPage(page);
    await loginPage.login('admin', 'AdminPassword123!');
    await page.waitForURL('/dashboard');

    await page.evaluate(() => {
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('accessToken');
    });

    await page.reload();

    await expect(page).toHaveURL('/login', { timeout: 10000 });
  });
});
