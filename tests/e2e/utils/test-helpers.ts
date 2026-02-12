import { Page, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Container state types
 */
export type ContainerState =
  | 'created'
  | 'running'
  | 'paused'
  | 'restarting'
  | 'removing'
  | 'exited'
  | 'dead';

/**
 * Test container configuration
 */
export interface TestContainerConfig {
  name: string;
  image: string;
  command?: string;
  ports?: Array<{ hostPort: number; containerPort: number; protocol?: string }>;
  env?: Record<string, string>;
  labels?: Record<string, string>;
  volumes?: Array<{ hostPath?: string; containerPath: string; mode?: string }>;
  network?: string;
  memory?: number;
  cpus?: number;
}

/**
 * Wait for a container to reach a specific state
 * @param page - Playwright page object
 * @param name - Container name
 * @param state - Expected state
 * @param options - Timeout and interval options
 */
export async function waitForContainerState(
  page: Page,
  name: string,
  state: ContainerState,
  options: { timeout?: number; interval?: number } = {}
): Promise<void> {
  const { timeout = 30000, interval = 500 } = options;
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    try {
      const response = await page.request.get(`/api/containers?name=${encodeURIComponent(name)}`);
      if (response.ok()) {
        const result = await response.json();
        const container = result.data?.find((c: any) => c.name === name);

        if (container?.state === state) {
          return;
        }
      }
    } catch (error) {
      // Ignore errors during polling
    }

    await page.waitForTimeout(interval);
  }

  throw new Error(`Timeout waiting for container '${name}' to reach state '${state}'`);
}

/**
 * Create a test container via API
 * @param page - Playwright page object
 * @param config - Container configuration
 * @returns Container ID
 */
export async function createTestContainer(
  page: Page,
  config: TestContainerConfig
): Promise<string> {
  const response = await page.request.post('/api/containers/create', {
    data: {
      name: config.name,
      image: config.image,
      command: config.command,
      ports: config.ports?.map((p) => ({
        containerPort: p.containerPort,
        hostPort: p.hostPort,
        hostIp: '0.0.0.0',
        protocol: p.protocol || 'tcp',
      })),
      env: config.env,
      labels: { 'test-suite': 'e2e', ...config.labels },
      volumes: config.volumes,
      network: config.network,
      memory: config.memory,
      cpus: config.cpus,
    },
  });

  if (!response.ok()) {
    const errorText = await response.text();
    throw new Error(`Failed to create container: ${errorText}`);
  }

  const result = await response.json();
  return result.data.id;
}

/**
 * Delete a test container via API
 * @param page - Playwright page object
 * @param name - Container name or ID
 * @param force - Force delete even if running
 */
export async function deleteTestContainer(page: Page, name: string, force = true): Promise<void> {
  // First get the container ID by name
  const listResponse = await page.request.get(`/api/containers?name=${encodeURIComponent(name)}`);
  let containerId = name;

  if (listResponse.ok()) {
    const result = await listResponse.json();
    const container = result.data?.find((c: any) => c.name === name);
    if (container) {
      containerId = container.id;
    }
  }

  const response = await page.request.delete(`/api/containers/${containerId}?force=${force}`);

  if (!response.ok() && response.status() !== 404) {
    const errorText = await response.text();
    throw new Error(`Failed to delete container: ${errorText}`);
  }
}

/**
 * Wait for a toast notification to appear
 * @param page - Playwright page object
 * @param message - Expected message (partial match)
 * @param options - Timeout and type options
 */
export async function waitForToast(
  page: Page,
  message: string,
  options: {
    timeout?: number;
    type?: 'success' | 'error' | 'warning' | 'info';
  } = {}
): Promise<void> {
  const { timeout = 10000, type } = options;

  const toastSelector = type ? `[data-testid="toast-${type}"]` : '[data-testid^="toast-"]';

  const toast = page.locator(toastSelector).filter({ hasText: message });
  await toast.waitFor({ state: 'visible', timeout });
}

/**
 * Wait for loading spinner to disappear
 * @param page - Playwright page object
 * @param options - Timeout options
 */
export async function waitForLoading(
  page: Page,
  options: { timeout?: number } = {}
): Promise<void> {
  const { timeout = 30000 } = options;

  const spinners = page.locator('[data-testid="loading-spinner"], .loading, [aria-busy="true"]');

  // Wait for any spinner to appear first (if loading hasn't started)
  try {
    await spinners.first().waitFor({ state: 'visible', timeout: 2000 });
  } catch {
    // Spinner might have already disappeared
  }

  // Wait for all spinners to disappear
  await spinners.waitFor({ state: 'hidden', timeout });
}

/**
 * Take a screenshot with timestamp
 * @param page - Playwright page object
 * @param name - Screenshot name
 * @param options - Screenshot options
 * @returns Path to the screenshot file
 */
export async function takeScreenshot(
  page: Page,
  name: string,
  options: {
    fullPage?: boolean;
    dir?: string;
  } = {}
): Promise<string> {
  const { fullPage = true, dir = 'test-results/screenshots' } = options;

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `${name}-${timestamp}.png`;
  const screenshotPath = path.join(dir, filename);

  // Ensure directory exists
  fs.mkdirSync(dir, { recursive: true });

  await page.screenshot({
    path: screenshotPath,
    fullPage,
  });

  return screenshotPath;
}

/**
 * Generate random test data
 */
export interface TestData {
  containerName: string;
  username: string;
  email: string;
  projectName: string;
  networkName: string;
  volumeName: string;
  timestamp: number;
}

/**
 * Generate random test data for use in tests
 * @param prefix - Optional prefix for names
 * @returns TestData object with random values
 */
export function generateTestData(prefix = 'test'): TestData {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 10000);
  const randomStr = Math.random().toString(36).substring(2, 8);

  return {
    containerName: `${prefix}-container-${randomStr}`,
    username: `${prefix}-user-${random}`,
    email: `${prefix}-${random}@example.com`,
    projectName: `${prefix}-project-${randomStr}`,
    networkName: `${prefix}-network-${randomStr}`,
    volumeName: `${prefix}-volume-${randomStr}`,
    timestamp,
  };
}

/**
 * Generate a unique identifier
 * @param prefix - Optional prefix
 * @returns Unique string identifier
 */
export function generateUniqueId(prefix = 'id'): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

/**
 * Wait for element to be stable (no animation/transition)
 * @param page - Playwright page object
 * @param selector - Element selector
 * @param options - Timeout options
 */
export async function waitForElementStable(
  page: Page,
  selector: string,
  options: { timeout?: number } = {}
): Promise<void> {
  const { timeout = 5000 } = options;

  await page.waitForFunction(
    (sel) => {
      const element = document.querySelector(sel);
      if (!element) return false;

      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    },
    selector,
    { timeout }
  );
}

/**
 * Retry an async operation with exponential backoff
 * @param fn - Function to retry
 * @param options - Retry options
 * @returns Result of the function
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    initialDelay?: number;
    maxDelay?: number;
    backoffMultiplier?: number;
  } = {}
): Promise<T> {
  const { maxRetries = 3, initialDelay = 1000, maxDelay = 10000, backoffMultiplier = 2 } = options;

  let lastError: Error;
  let delay = initialDelay;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (attempt === maxRetries) {
        throw lastError;
      }

      await new Promise((resolve) => setTimeout(resolve, delay));
      delay = Math.min(delay * backoffMultiplier, maxDelay);
    }
  }

  throw lastError!;
}

/**
 * Clear test data and cleanup resources
 * @param page - Playwright page object
 * @param containerNames - List of container names to delete
 */
export async function cleanupTestContainers(page: Page, containerNames: string[]): Promise<void> {
  const errors: Error[] = [];

  for (const name of containerNames) {
    try {
      await deleteTestContainer(page, name, true);
    } catch (error) {
      errors.push(error as Error);
    }
  }

  if (errors.length > 0) {
    console.warn(`Failed to cleanup ${errors.length} containers:`, errors);
  }
}

/**
 * Wait for API response after an action
 * @param page - Playwright page object
 * @param urlPattern - URL pattern to match
 * @param action - Action to perform
 * @returns Response object
 */
export async function waitForApiResponse<T>(
  page: Page,
  urlPattern: string | RegExp,
  action: () => Promise<void>
): Promise<T> {
  const responsePromise = page.waitForResponse(urlPattern);
  await action();
  const response = await responsePromise;

  if (!response.ok()) {
    throw new Error(`API request failed: ${response.status()} ${response.statusText()}`);
  }

  return response.json() as Promise<T>;
}

/**
 * Fill form fields from an object
 * @param page - Playwright page object
 * @param fields - Object with field selectors and values
 */
export async function fillFormFields(
  page: Page,
  fields: Record<string, string | number | boolean>
): Promise<void> {
  for (const [selector, value] of Object.entries(fields)) {
    const element = page.locator(selector);

    // Check if it's a checkbox
    const isCheckbox = await element.evaluate(
      (el) => el instanceof HTMLInputElement && el.type === 'checkbox'
    );

    if (isCheckbox) {
      if (Boolean(value)) {
        await element.check();
      } else {
        await element.uncheck();
      }
    } else {
      await element.fill(String(value));
    }
  }
}

/**
 * Assert that page has no accessibility violations
 * @param page - Playwright page object
 */
export async function assertNoAccessibilityViolations(page: Page): Promise<void> {
  // Basic accessibility checks
  const violations = await page.evaluate(() => {
    const issues: string[] = [];

    // Check for images without alt text
    document.querySelectorAll('img:not([alt])').forEach((img) => {
      issues.push(`Image without alt text: ${img.outerHTML}`);
    });

    // Check for buttons without aria-label or visible text
    document.querySelectorAll('button').forEach((btn) => {
      if (!btn.textContent?.trim() && !btn.getAttribute('aria-label')) {
        issues.push(`Button without accessible name: ${btn.outerHTML}`);
      }
    });

    // Check for form inputs without labels
    document.querySelectorAll('input:not([type="hidden"])').forEach((input) => {
      const id = input.getAttribute('id');
      const ariaLabel = input.getAttribute('aria-label');
      const ariaLabelledBy = input.getAttribute('aria-labelledby');
      const hasLabel = id && document.querySelector(`label[for="${id}"]`);

      if (!hasLabel && !ariaLabel && !ariaLabelledBy && !(input as HTMLInputElement).placeholder) {
        issues.push(`Input without label: ${input.outerHTML}`);
      }
    });

    return issues;
  });

  expect(violations).toHaveLength(0);
}
