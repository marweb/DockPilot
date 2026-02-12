import { test as base, expect, Page, BrowserContext } from '@playwright/test';
import path from 'path';
import fs from 'fs';

export interface TestUser {
  username: string;
  email: string;
  password: string;
  role: 'admin' | 'user';
}

export const testUser: TestUser = {
  username: 'testuser',
  email: 'test@dockpilot.local',
  password: 'TestPassword123!',
  role: 'admin',
};

export const adminUser: TestUser = {
  username: 'admin',
  email: 'admin@dockpilot.local',
  password: 'AdminPassword123!',
  role: 'admin',
};

const STORAGE_STATE_PATH = path.join(process.cwd(), 'playwright/.auth/user.json');

export interface AuthFixtures {
  authenticatedPage: Page;
  loginPage: Page;
  testUser: TestUser;
  adminUser: TestUser;
  storageState: string;
}

export const test = base.extend<AuthFixtures>({
  testUser: async ({}, use) => {
    await use(testUser);
  },

  adminUser: async ({}, use) => {
    await use(adminUser);
  },

  storageState: async ({}, use) => {
    await use(STORAGE_STATE_PATH);
  },

  authenticatedPage: async ({ browser, testUser }, use) => {
    const context = await browser.newContext({
      storageState: STORAGE_STATE_PATH,
    });
    const page = await context.newPage();

    await use(page);

    await context.close();
  },

  loginPage: async ({ page, baseURL }, use) => {
    await page.goto('/login');
    await expect(page).toHaveURL(/.*login/);
    await use(page);
  },
});

export { expect } from '@playwright/test';

export async function ensureAuthFile() {
  const authDir = path.dirname(STORAGE_STATE_PATH);
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }
}

export async function clearStorageState() {
  if (fs.existsSync(STORAGE_STATE_PATH)) {
    fs.unlinkSync(STORAGE_STATE_PATH);
  }
}

export async function loginUser(page: Page, user: TestUser): Promise<void> {
  await page.goto('/login');
  await page.fill('[data-testid="username-input"]', user.username);
  await page.fill('[data-testid="password-input"]', user.password);
  await page.click('[data-testid="login-button"]');
  await page.waitForURL('**/dashboard', { timeout: 10000 });
}

export async function logoutUser(page: Page): Promise<void> {
  await page.click('[data-testid="user-menu"]');
  await page.click('[data-testid="logout-button"]');
  await page.waitForURL('**/login', { timeout: 10000 });
}

export async function isAuthenticated(page: Page): Promise<boolean> {
  try {
    const dashboardElement = await page.locator('[data-testid="dashboard-layout"]').first();
    return await dashboardElement.isVisible({ timeout: 5000 });
  } catch {
    return false;
  }
}

export async function setupAuthenticatedContext(
  browserContext: BrowserContext,
  user: TestUser
): Promise<void> {
  const page = await browserContext.newPage();

  await page.goto('/login');
  await page.fill('[data-testid="username-input"]', user.username);
  await page.fill('[data-testid="password-input"]', user.password);
  await page.click('[data-testid="login-button"]');
  await page.waitForURL('**/dashboard', { timeout: 10000 });

  await page.context().storageState({ path: STORAGE_STATE_PATH });
  await page.close();
}

export async function cleanupTestUser(apiContext: any, username: string): Promise<void> {
  try {
    await apiContext.delete(`/api/users/${username}`, {
      failOnStatusCode: false,
    });
  } catch (error) {
    console.log(`Failed to cleanup user ${username}:`, error);
  }
}
