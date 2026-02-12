import { test, expect } from './auth.setup';

test.describe('Navigation Tests', () => {
  test.beforeEach(async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard');
    await authenticatedPage.waitForLoadState('networkidle');
  });

  test('sidebar expands and collapses', async ({ authenticatedPage }) => {
    const sidebar = authenticatedPage.locator('[data-testid="sidebar"]');
    const toggleBtn = authenticatedPage.locator('[data-testid="sidebar-toggle"]');

    await expect(sidebar).toBeVisible();

    await toggleBtn.click();
    await expect(sidebar).toHaveClass(/collapsed/);

    const collapsedWidth = await sidebar.evaluate((el) => el.getBoundingClientRect().width);
    expect(collapsedWidth).toBeLessThan(80);

    await toggleBtn.click();
    await expect(sidebar).not.toHaveClass(/collapsed/);

    const expandedWidth = await sidebar.evaluate((el) => el.getBoundingClientRect().width);
    expect(expandedWidth).toBeGreaterThan(200);

    await expect(sidebar).toHaveScreenshot('sidebar-expanded.png');

    await toggleBtn.click();
    await expect(sidebar).toHaveScreenshot('sidebar-collapsed.png');
  });

  test('navigate through all main routes', async ({ authenticatedPage }) => {
    const routes = [
      { path: '/dashboard', name: 'Dashboard', testId: 'dashboard-page' },
      { path: '/containers', name: 'Containers', testId: 'containers-page' },
      { path: '/images', name: 'Images', testId: 'images-page' },
      { path: '/volumes', name: 'Volumes', testId: 'volumes-page' },
      { path: '/networks', name: 'Networks', testId: 'networks-page' },
      { path: '/stacks', name: 'Stacks', testId: 'stacks-page' },
      { path: '/settings', name: 'Settings', testId: 'settings-page' },
    ];

    for (const route of routes) {
      const link = authenticatedPage.locator(`[data-testid="nav-${route.path.slice(1)}"]`);
      await link.click();

      await authenticatedPage.waitForURL(`**${route.path}`, { timeout: 10000 });
      await expect(authenticatedPage).toHaveURL(new RegExp(route.path));

      const pageElement = authenticatedPage.locator(`[data-testid="${route.testId}"]`);
      await expect(pageElement).toBeVisible({ timeout: 5000 });

      const startTime = Date.now();
      await authenticatedPage.waitForLoadState('networkidle');
      const loadTime = Date.now() - startTime;
      expect(loadTime).toBeLessThan(2000);

      await expect(authenticatedPage).toHaveTitle(new RegExp(route.name, 'i'));
    }
  });

  test('mobile navigation with hamburger menu', async ({ authenticatedPage }) => {
    await authenticatedPage.setViewportSize({ width: 375, height: 667 });

    const hamburgerBtn = authenticatedPage.locator('[data-testid="mobile-menu-toggle"]');
    const mobileSidebar = authenticatedPage.locator('[data-testid="mobile-sidebar"]');

    await expect(hamburgerBtn).toBeVisible();
    await expect(mobileSidebar).not.toBeVisible();

    await hamburgerBtn.click();
    await expect(mobileSidebar).toBeVisible();

    const containersLink = mobileSidebar.locator('[data-testid="nav-containers"]');
    await containersLink.click();

    await authenticatedPage.waitForURL('**/containers');
    await expect(mobileSidebar).not.toBeVisible();

    await hamburgerBtn.click();
    await expect(mobileSidebar).toBeVisible();

    await authenticatedPage.keyboard.press('Escape');
    await expect(mobileSidebar).not.toBeVisible();

    await authenticatedPage.setViewportSize({ width: 1920, height: 1080 });
  });

  test('breadcrumbs work correctly', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/containers/nginx/logs');
    await authenticatedPage.waitForLoadState('networkidle');

    const breadcrumbs = authenticatedPage.locator('[data-testid="breadcrumbs"]');
    await expect(breadcrumbs).toBeVisible();

    const breadcrumbItems = breadcrumbs.locator('li, [data-testid="breadcrumb-item"]');
    await expect(breadcrumbItems).toHaveCount(3);

    const homeCrumb = breadcrumbs.locator('a[href="/dashboard"]').first();
    await expect(homeCrumb).toContainText(/dashboard|home/i);

    await homeCrumb.click();
    await authenticatedPage.waitForURL('**/dashboard');
    await expect(authenticatedPage.locator('[data-testid="dashboard-page"]')).toBeVisible();

    await authenticatedPage.goto('/containers/nginx/logs');
    const containersCrumb = breadcrumbs.locator('a[href="/containers"]').first();
    await containersCrumb.click();
    await authenticatedPage.waitForURL('**/containers');
  });

  test('active state in menu reflects current route', async ({ authenticatedPage }) => {
    const routes = ['/dashboard', '/containers', '/images', '/volumes'];

    for (const route of routes) {
      await authenticatedPage.goto(route);
      await authenticatedPage.waitForLoadState('networkidle');

      const navLink = authenticatedPage.locator(`[data-testid="nav-${route.slice(1)}"]`);
      await expect(navLink).toHaveAttribute('aria-current', 'page');
      await expect(navLink).toHaveClass(/active/);

      const activeLinks = authenticatedPage.locator(
        '[data-testid^="nav-"].active, [data-testid^="nav-"][aria-current="page"]'
      );
      await expect(activeLinks).toHaveCount(1);
    }
  });

  test('keyboard navigation accessibility', async ({ authenticatedPage }) => {
    const skipLink = authenticatedPage.locator('[data-testid="skip-to-content"]');
    await authenticatedPage.keyboard.press('Tab');
    await expect(skipLink).toBeFocused();

    await authenticatedPage.keyboard.press('Enter');
    const mainContent = authenticatedPage.locator(
      'main, [role="main"], [data-testid="main-content"]'
    );
    await expect(mainContent).toBeFocused();

    const firstNavItem = authenticatedPage.locator('[data-testid^="nav-"]').first();
    await firstNavItem.focus();
    await authenticatedPage.keyboard.press('ArrowDown');

    const secondNavItem = authenticatedPage.locator('[data-testid^="nav-"]').nth(1);
    await expect(secondNavItem).toBeFocused();

    await secondNavItem.focus();
    await authenticatedPage.keyboard.press('Enter');
    const href = await secondNavItem.getAttribute('href');
    await authenticatedPage.waitForURL(`**${href}`);

    // Accessibility: Verify sidebar has proper ARIA attributes
    const sidebar = authenticatedPage.locator('[data-testid="sidebar"]');
    const ariaLabel = await sidebar.getAttribute('aria-label');
    expect(ariaLabel || (await sidebar.getAttribute('role'))).toBeTruthy();
  });

  test('external links open in new tab', async ({ authenticatedPage, context }) => {
    await authenticatedPage.goto('/settings');

    const externalLinks = authenticatedPage.locator(
      'a[target="_blank"], a[rel="noopener noreferrer"]'
    );
    const count = await externalLinks.count();

    if (count > 0) {
      for (let i = 0; i < count; i++) {
        const link = externalLinks.nth(i);
        const target = await link.getAttribute('target');
        const rel = await link.getAttribute('rel');

        expect(target).toBe('_blank');
        expect(rel).toContain('noopener');
        expect(rel).toContain('noreferrer');
      }

      const [newPage] = await Promise.all([
        context.waitForEvent('page'),
        externalLinks.first().click(),
      ]);

      await newPage.waitForLoadState();
      expect(newPage.url()).not.toContain('localhost:3000');
      await newPage.close();
    }
  });

  test('navigation performance budget', async ({ authenticatedPage }) => {
    const routes = ['/dashboard', '/containers', '/images'];

    for (const route of routes) {
      const startTime = Date.now();

      await authenticatedPage.goto(route);
      await authenticatedPage.waitForLoadState('domcontentloaded');

      const domContentLoaded = Date.now() - startTime;
      expect(domContentLoaded).toBeLessThan(1500);

      await authenticatedPage.waitForLoadState('networkidle');
      const networkIdle = Date.now() - startTime;
      expect(networkIdle).toBeLessThan(3000);

      const performanceMetrics = await authenticatedPage.evaluate(() => {
        const navigation = performance.getEntriesByType(
          'navigation'
        )[0] as PerformanceNavigationTiming;
        return {
          loadEventEnd: navigation.loadEventEnd,
          domComplete: navigation.domComplete,
          firstContentfulPaint:
            performance.getEntriesByName('first-contentful-paint')[0]?.startTime,
        };
      });

      expect(performanceMetrics.loadEventEnd).toBeLessThan(3000);
      expect(performanceMetrics.firstContentfulPaint).toBeLessThan(1500);
    }
  });

  test('cross-browser navigation compatibility', async ({ authenticatedPage, browserName }) => {
    const routes = ['/dashboard', '/containers', '/settings'];

    for (const route of routes) {
      await authenticatedPage.goto(route);
      await authenticatedPage.waitForLoadState('networkidle');

      const pageContent = authenticatedPage.locator('[data-testid="main-content"], main');
      await expect(pageContent).toBeVisible();

      if (browserName === 'firefox') {
        await authenticatedPage.keyboard.press('Alt+Shift+T');
      } else if (browserName === 'webkit') {
        await authenticatedPage.keyboard.press('Alt+Cmd+ArrowRight');
      }
    }
  });
});
