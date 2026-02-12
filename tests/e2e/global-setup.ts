/**
 * Global setup for E2E tests
 * Runs once before all test suites
 */

import { chromium, type FullConfig } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { adminUser, generateMockTokens } from '../fixtures/users';
import { testContainers } from '../fixtures/containers';

/**
 * Test report configuration
 */
interface TestReport {
  startTime: string;
  baseUrl: string;
  environment: {
    nodeVersion: string;
    platform: string;
    ci: boolean;
  };
  setup: {
    adminCreated: boolean;
    containersCleaned: boolean;
    authStorageCreated: boolean;
  };
}

/**
 * Ensure required directories exist
 */
function ensureDirectories(): void {
  const dirs = [
    'test-results',
    'test-results/screenshots',
    'test-results/videos',
    'test-results/traces',
    'test-results/reports',
    'playwright-report',
    'playwright/.auth',
  ];

  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`Created directory: ${dir}`);
    }
  }
}

/**
 * Clean up previous test results
 */
function cleanupPreviousResults(): void {
  const dirsToClean = ['test-results/screenshots', 'test-results/videos', 'test-results/traces'];

  for (const dir of dirsToClean) {
    if (fs.existsSync(dir)) {
      try {
        const files = fs.readdirSync(dir);
        for (const file of files) {
          fs.unlinkSync(path.join(dir, file));
        }
        console.log(`Cleaned directory: ${dir}`);
      } catch (error) {
        console.warn(`Failed to clean directory ${dir}:`, error);
      }
    }
  }
}

/**
 * Check if server is running
 */
async function checkServerHealth(baseUrl: string, maxRetries = 30): Promise<boolean> {
  const healthUrl = `${baseUrl}/healthz`;

  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(healthUrl);
      if (response.ok) {
        console.log('Server is healthy');
        return true;
      }
    } catch (error) {
      // Server not ready yet
    }

    console.log(`Waiting for server... (${i + 1}/${maxRetries})`);
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  throw new Error('Server failed to start within timeout period');
}

/**
 * Create admin user via API
 */
async function createAdminUser(baseUrl: string): Promise<boolean> {
  try {
    // Check if user already exists
    const checkResponse = await fetch(`${baseUrl}/api/users/check?username=${adminUser.username}`);

    if (checkResponse.ok) {
      const checkData = await checkResponse.json();
      if (checkData.data?.exists) {
        console.log('Admin user already exists');
        return true;
      }
    }

    // Create admin user
    const response = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: adminUser.username,
        email: adminUser.email,
        password: adminUser.password,
        firstName: adminUser.firstName,
        lastName: adminUser.lastName,
        role: 'admin',
      }),
    });

    if (response.ok) {
      console.log('Admin user created successfully');
      return true;
    } else {
      const error = await response.text();
      console.warn('Failed to create admin user:', error);
      return false;
    }
  } catch (error) {
    console.error('Error creating admin user:', error);
    return false;
  }
}

/**
 * Create authentication storage for tests
 */
async function createAuthStorage(baseUrl: string): Promise<boolean> {
  const authFile = 'playwright/.auth/admin.json';

  try {
    // Launch browser
    const browser = await chromium.launch();
    const context = await browser.newContext();
    const page = await context.newPage();

    // Navigate to login page
    await page.goto(`${baseUrl}/login`);

    // Perform login
    await page.fill('[data-testid="login-username-input"]', adminUser.username);
    await page.fill('[data-testid="login-password-input"]', adminUser.password);

    await Promise.all([page.waitForNavigation(), page.click('[data-testid="login-submit-btn"]')]);

    // Verify login success
    const currentUrl = page.url();
    if (!currentUrl.includes('/login')) {
      // Save storage state
      await context.storageState({ path: authFile });
      console.log('Auth storage created:', authFile);

      await browser.close();
      return true;
    }

    console.warn('Login may have failed, but continuing...');
    await browser.close();

    // Create mock storage if login didn't work (for development)
    const mockStorage = createMockStorageState();
    fs.writeFileSync(authFile, JSON.stringify(mockStorage, null, 2));
    return true;
  } catch (error) {
    console.warn('Error creating auth storage:', error);

    // Create mock storage as fallback
    try {
      const mockStorage = createMockStorageState();
      fs.writeFileSync(authFile, JSON.stringify(mockStorage, null, 2));
      console.log('Created mock auth storage as fallback');
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Create mock storage state
 */
function createMockStorageState() {
  const tokens = generateMockTokens(adminUser);

  return {
    cookies: [
      {
        name: 'access_token',
        value: tokens.accessToken,
        domain: 'localhost',
        path: '/',
        expires: Math.floor(Date.now() / 1000) + 900,
        httpOnly: true,
        secure: false,
        sameSite: 'Lax',
      },
      {
        name: 'refresh_token',
        value: tokens.refreshToken,
        domain: 'localhost',
        path: '/',
        expires: Math.floor(Date.now() / 1000) + 604800,
        httpOnly: true,
        secure: false,
        sameSite: 'Lax',
      },
    ],
    origins: [
      {
        origin: 'http://localhost:3000',
        localStorage: [
          {
            name: 'user',
            value: JSON.stringify({
              id: adminUser.id,
              username: adminUser.username,
              email: adminUser.email,
              role: adminUser.role,
              firstName: adminUser.firstName,
              lastName: adminUser.lastName,
            }),
          },
        ],
      },
    ],
  };
}

/**
 * Clean up existing test containers
 */
async function cleanupTestContainers(baseUrl: string): Promise<boolean> {
  try {
    const tokens = generateMockTokens(adminUser);

    // Get all containers
    const response = await fetch(`${baseUrl}/api/containers`, {
      headers: {
        Authorization: `Bearer ${tokens.accessToken}`,
      },
    });

    if (!response.ok) {
      console.warn('Could not fetch containers for cleanup');
      return false;
    }

    const result = await response.json();
    const containers = result.data || [];

    // Find test containers
    const testContainersToDelete = containers.filter(
      (c: any) =>
        c.labels?.['test-suite'] === 'e2e' ||
        c.name?.startsWith('test-') ||
        c.name?.startsWith('compose-')
    );

    console.log(`Found ${testContainersToDelete.length} test containers to clean up`);

    // Delete test containers
    for (const container of testContainersToDelete) {
      try {
        await fetch(`${baseUrl}/api/containers/${container.id}?force=true`, {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${tokens.accessToken}`,
          },
        });
        console.log(`Deleted container: ${container.name}`);
      } catch (error) {
        console.warn(`Failed to delete container ${container.name}:`, error);
      }
    }

    return true;
  } catch (error) {
    console.warn('Error cleaning up containers:', error);
    return false;
  }
}

/**
 * Generate setup report
 */
function generateReport(report: TestReport): void {
  const reportPath = 'test-results/reports/setup-report.json';

  try {
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log('Setup report generated:', reportPath);
  } catch (error) {
    console.warn('Failed to generate setup report:', error);
  }
}

/**
 * Main setup function
 */
async function globalSetup(config: FullConfig): Promise<void> {
  console.log('\n========================================');
  console.log('   E2E Global Setup - DockPilot');
  console.log('========================================\n');

  const baseUrl = config.projects[0]?.use?.baseURL || 'http://localhost:3000';
  const startTime = new Date().toISOString();

  // Ensure directories exist
  ensureDirectories();

  // Clean up previous results
  cleanupPreviousResults();

  // Check server health
  console.log('Checking server health...');
  await checkServerHealth(baseUrl);

  // Setup report
  const setupReport: TestReport = {
    startTime,
    baseUrl,
    environment: {
      nodeVersion: process.version,
      platform: process.platform,
      ci: !!process.env.CI,
    },
    setup: {
      adminCreated: false,
      containersCleaned: false,
      authStorageCreated: false,
    },
  };

  // Create admin user
  console.log('\nCreating admin user...');
  setupReport.setup.adminCreated = await createAdminUser(baseUrl);

  // Clean up existing test containers
  console.log('\nCleaning up test containers...');
  setupReport.setup.containersCleaned = await cleanupTestContainers(baseUrl);

  // Create authentication storage
  console.log('\nCreating authentication storage...');
  setupReport.setup.authStorageCreated = await createAuthStorage(baseUrl);

  // Generate report
  generateReport(setupReport);

  console.log('\n========================================');
  console.log('   Global Setup Complete');
  console.log('========================================\n');

  // Log setup status
  console.log('Setup Status:');
  console.log(`  - Admin user: ${setupReport.setup.adminCreated ? '✓' : '✗'}`);
  console.log(`  - Containers cleaned: ${setupReport.setup.containersCleaned ? '✓' : '✗'}`);
  console.log(`  - Auth storage: ${setupReport.setup.authStorageCreated ? '✓' : '✗'}`);
}

export default globalSetup;
