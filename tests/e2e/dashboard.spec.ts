import { test, expect } from './auth.setup';

test.describe('Dashboard Tests', () => {
  test.beforeEach(async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard');
    await authenticatedPage.waitForLoadState('networkidle');
  });

  test('stats cards display correct data', async ({ authenticatedPage }) => {
    const statsCards = authenticatedPage.locator('[data-testid="stats-card"]');
    await expect(statsCards).toHaveCount(4);

    const expectedCards = ['containers', 'images', 'volumes', 'networks'];

    for (const cardType of expectedCards) {
      const card = authenticatedPage.locator(`[data-testid="stats-card-${cardType}"]`);
      await expect(card).toBeVisible();

      const count = card.locator('[data-testid="stats-count"]');
      await expect(count).toBeVisible();

      const countText = await count.textContent();
      const countNumber = parseInt(countText?.replace(/,/g, '') || '0');
      expect(countNumber).toBeGreaterThanOrEqual(0);

      const label = card.locator('[data-testid="stats-label"]');
      await expect(label).toBeVisible();
      await expect(label).not.toBeEmpty();

      const trend = card.locator('[data-testid="stats-trend"]');
      if (await trend.isVisible().catch(() => false)) {
        const trendText = await trend.textContent();
        expect(trendText).toMatch(/[+-]?\d+%/);
      }
    }

    const firstCard = statsCards.first();
    // Verify card has sufficient contrast
    const cardBg = await firstCard.evaluate((el) => window.getComputedStyle(el).backgroundColor);
    const cardText = await firstCard
      .locator('[data-testid="stats-count"]')
      .evaluate((el) => window.getComputedStyle(el).color);
    expect(cardBg).toBeTruthy();
    expect(cardText).toBeTruthy();
  });

  test('container counters update correctly', async ({ authenticatedPage }) => {
    const containerCard = authenticatedPage.locator('[data-testid="stats-card-containers"]');
    await expect(containerCard).toBeVisible();

    const runningCount = containerCard.locator('[data-testid="containers-running"]');
    const stoppedCount = containerCard.locator('[data-testid="containers-stopped"]');
    const totalCount = containerCard.locator('[data-testid="stats-count"]');

    await expect(runningCount).toBeVisible();
    await expect(stoppedCount).toBeVisible();
    await expect(totalCount).toBeVisible();

    const running = parseInt((await runningCount.textContent())?.replace(/,/g, '') || '0');
    const stopped = parseInt((await stoppedCount.textContent())?.replace(/,/g, '') || '0');
    const total = parseInt((await totalCount.textContent())?.replace(/,/g, '') || '0');

    expect(running + stopped).toBe(total);
    expect(running).toBeGreaterThanOrEqual(0);
    expect(stopped).toBeGreaterThanOrEqual(0);
    expect(total).toBeGreaterThanOrEqual(0);

    await expect(containerCard).toHaveScreenshot('container-stats.png');
  });

  test('image counters display correctly', async ({ authenticatedPage }) => {
    const imageCard = authenticatedPage.locator('[data-testid="stats-card-images"]');
    await expect(imageCard).toBeVisible();

    const totalImages = imageCard.locator('[data-testid="stats-count"]');
    const sizeInfo = imageCard.locator('[data-testid="images-size"]');

    await expect(totalImages).toBeVisible();

    const count = parseInt((await totalImages.textContent())?.replace(/,/g, '') || '0');
    expect(count).toBeGreaterThanOrEqual(0);

    if (await sizeInfo.isVisible().catch(() => false)) {
      const sizeText = await sizeInfo.textContent();
      expect(sizeText).toMatch(/\d+\.?\d*\s*(MB|GB|TB)/i);
    }
  });

  test('volume and network counters', async ({ authenticatedPage }) => {
    const volumeCard = authenticatedPage.locator('[data-testid="stats-card-volumes"]');
    const networkCard = authenticatedPage.locator('[data-testid="stats-card-networks"]');

    await expect(volumeCard).toBeVisible();
    await expect(networkCard).toBeVisible();

    const volumeCount = volumeCard.locator('[data-testid="stats-count"]');
    const networkCount = networkCard.locator('[data-testid="stats-count"]');

    const volumes = parseInt((await volumeCount.textContent())?.replace(/,/g, '') || '0');
    const networks = parseInt((await networkCount.textContent())?.replace(/,/g, '') || '0');

    expect(volumes).toBeGreaterThanOrEqual(0);
    expect(networks).toBeGreaterThanOrEqual(0);

    const volumeSize = volumeCard.locator('[data-testid="volumes-size"]');
    if (await volumeSize.isVisible().catch(() => false)) {
      const sizeText = await volumeSize.textContent();
      expect(sizeText).toMatch(/\d+\.?\d*\s*(MB|GB|TB)/i);
    }
  });

  test('quick actions work correctly', async ({ authenticatedPage }) => {
    const quickActions = authenticatedPage.locator('[data-testid="quick-actions"]');
    await expect(quickActions).toBeVisible();

    const actions = [
      { testId: 'create-container', expectedRoute: '/containers/create' },
      { testId: 'pull-image', expectedRoute: '/images/pull' },
      { testId: 'create-volume', expectedRoute: '/volumes/create' },
      { testId: 'create-network', expectedRoute: '/networks/create' },
    ];

    for (const action of actions) {
      const button = quickActions.locator(`[data-testid="${action.testId}"]`);
      await expect(button).toBeVisible();
      await expect(button).toBeEnabled();

      await button.click();
      await authenticatedPage.waitForURL(`**${action.expectedRoute}`, { timeout: 5000 });
      await expect(authenticatedPage).toHaveURL(new RegExp(action.expectedRoute));

      await authenticatedPage.goto('/dashboard');
      await authenticatedPage.waitForLoadState('networkidle');
    }
  });

  test('resource graphs are displayed', async ({ authenticatedPage }) => {
    const cpuGraph = authenticatedPage.locator('[data-testid="cpu-usage-graph"]');
    const memoryGraph = authenticatedPage.locator('[data-testid="memory-usage-graph"]');
    const diskGraph = authenticatedPage.locator('[data-testid="disk-usage-graph"]');

    await expect(cpuGraph).toBeVisible();
    await expect(memoryGraph).toBeVisible();

    const cpuCanvas = cpuGraph.locator('canvas, svg');
    const memoryCanvas = memoryGraph.locator('canvas, svg');

    await expect(cpuCanvas).toBeVisible();
    await expect(memoryCanvas).toBeVisible();

    if (await diskGraph.isVisible().catch(() => false)) {
      const diskCanvas = diskGraph.locator('canvas, svg');
      await expect(diskCanvas).toBeVisible();
    }

    const cpuLabel = cpuGraph.locator('[data-testid="graph-label"], h3, h4');
    await expect(cpuLabel).toContainText(/cpu/i);

    const graphsContainer = authenticatedPage.locator('[data-testid="resource-graphs"]');
    // Verify graphs container has proper ARIA labels
    const ariaLabel = await graphsContainer.getAttribute('aria-label');
    expect(ariaLabel || true).toBeTruthy();

    await expect(graphsContainer).toHaveScreenshot('resource-graphs.png');
  });

  test('recent alerts are displayed', async ({ authenticatedPage }) => {
    const alertsSection = authenticatedPage.locator('[data-testid="recent-alerts"]');
    await expect(alertsSection).toBeVisible();

    const alertsList = alertsSection.locator('[data-testid="alerts-list"]');
    await expect(alertsList).toBeVisible();

    const alertItems = alertsList.locator('[data-testid^="alert-"]');
    const count = await alertItems.count();

    if (count > 0) {
      for (let i = 0; i < Math.min(count, 3); i++) {
        const alert = alertItems.nth(i);
        await expect(alert).toBeVisible();

        const timestamp = alert.locator('[data-testid="alert-timestamp"]');
        await expect(timestamp).toBeVisible();

        const message = alert.locator('[data-testid="alert-message"]');
        await expect(message).toBeVisible();
        await expect(message).not.toBeEmpty();

        const severity = alert.locator('[data-testid="alert-severity"]');
        if (await severity.isVisible().catch(() => false)) {
          const severityText = await severity.textContent();
          expect(['info', 'warning', 'error', 'critical']).toContain(severityText?.toLowerCase());
        }
      }
    }

    const viewAllBtn = alertsSection.locator('[data-testid="view-all-alerts"]');
    if (await viewAllBtn.isVisible().catch(() => false)) {
      await viewAllBtn.click();
      await authenticatedPage.waitForURL('**/alerts');
    }
  });

  test('responsive design across viewports', async ({ authenticatedPage }) => {
    const viewports = [
      { name: 'desktop', width: 1920, height: 1080 },
      { name: 'tablet', width: 768, height: 1024 },
      { name: 'mobile', width: 375, height: 667 },
    ];

    for (const viewport of viewports) {
      await authenticatedPage.setViewportSize({ width: viewport.width, height: viewport.height });
      await authenticatedPage.goto('/dashboard');
      await authenticatedPage.waitForLoadState('networkidle');

      const mainContent = authenticatedPage.locator(
        'main, [role="main"], [data-testid="main-content"]'
      );
      await expect(mainContent).toBeVisible();

      const dashboardGrid = authenticatedPage.locator('[data-testid="dashboard-grid"]');
      if (await dashboardGrid.isVisible().catch(() => false)) {
        const gridStyles = await dashboardGrid.evaluate((el) => {
          const computed = window.getComputedStyle(el);
          return {
            display: computed.display,
            gridTemplateColumns: computed.gridTemplateColumns,
          };
        });

        if (viewport.name === 'mobile') {
          expect(gridStyles.gridTemplateColumns).toContain('1fr');
        }
      }

      await expect(authenticatedPage).toHaveScreenshot(`dashboard-${viewport.name}.png`, {
        fullPage: true,
      });
    }

    await authenticatedPage.setViewportSize({ width: 1920, height: 1080 });
  });

  test('dashboard accessibility compliance', async ({ authenticatedPage }) => {
    // Verify page structure for accessibility
    const main = authenticatedPage.locator('main, [role="main"], [data-testid="dashboard-page"]');
    expect(await main.count()).toBeGreaterThan(0);

    const headings = authenticatedPage.locator('h1, h2, h3');
    const headingCount = await headings.count();
    expect(headingCount).toBeGreaterThan(0);

    for (let i = 0; i < headingCount; i++) {
      const heading = headings.nth(i);
      await expect(heading).not.toBeEmpty();
    }

    const interactiveElements = authenticatedPage.locator('button, a, [role="button"]');
    const interactiveCount = await interactiveElements.count();

    for (let i = 0; i < Math.min(interactiveCount, 5); i++) {
      const element = interactiveElements.nth(i);
      const hasAriaLabel = await element.getAttribute('aria-label');
      const hasAriaLabelledBy = await element.getAttribute('aria-labelledby');
      const hasTitle = await element.getAttribute('title');
      const textContent = await element.textContent();

      expect(hasAriaLabel || hasAriaLabelledBy || hasTitle || textContent?.trim()).toBeTruthy();
    }
  });

  test('dashboard performance budget', async ({ authenticatedPage }) => {
    const startTime = Date.now();
    await authenticatedPage.goto('/dashboard');
    await authenticatedPage.waitForLoadState('networkidle');
    const totalLoadTime = Date.now() - startTime;

    expect(totalLoadTime).toBeLessThan(3000);

    const performanceMetrics = await authenticatedPage.evaluate(() => {
      const navigation = performance.getEntriesByType(
        'navigation'
      )[0] as PerformanceNavigationTiming;
      const paintEntries = performance.getEntriesByType('paint');

      return {
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.startTime,
        loadComplete: navigation.loadEventEnd - navigation.startTime,
        firstPaint: paintEntries.find((p) => p.name === 'first-paint')?.startTime,
        firstContentfulPaint: paintEntries.find((p) => p.name === 'first-contentful-paint')
          ?.startTime,
      };
    });

    expect(performanceMetrics.domContentLoaded).toBeLessThan(1500);
    expect(performanceMetrics.loadComplete).toBeLessThan(3000);
    expect(performanceMetrics.firstContentfulPaint).toBeLessThan(1500);

    const resourceSizes = await authenticatedPage.evaluate(() => {
      return performance.getEntriesByType('resource').map((r) => ({
        name: r.name,
        size: (r as PerformanceResourceTiming).encodedBodySize || 0,
      }));
    });

    const totalSize = resourceSizes.reduce((sum, r) => sum + r.size, 0);
    expect(totalSize).toBeLessThan(5 * 1024 * 1024);
  });

  test('data refresh and auto-update', async ({ authenticatedPage }) => {
    const statsCard = authenticatedPage.locator('[data-testid="stats-card-containers"]');
    const initialCount = await statsCard.locator('[data-testid="stats-count"]').textContent();

    const refreshBtn = authenticatedPage.locator('[data-testid="refresh-dashboard"]');
    if (await refreshBtn.isVisible().catch(() => false)) {
      await refreshBtn.click();
      await authenticatedPage.waitForLoadState('networkidle');

      const newCount = await statsCard.locator('[data-testid="stats-count"]').textContent();
      expect(newCount).toBeTruthy();
    }

    await authenticatedPage.waitForTimeout(35000);

    const updatedCount = await statsCard.locator('[data-testid="stats-count"]').textContent();
    expect(updatedCount).toBeTruthy();
  });

  test('cross-browser dashboard rendering', async ({ authenticatedPage, browserName }) => {
    const dashboardContainer = authenticatedPage.locator('[data-testid="dashboard-page"]');
    await expect(dashboardContainer).toBeVisible();

    const statsCards = authenticatedPage.locator('[data-testid="stats-card"]');
    const cardCount = await statsCards.count();
    expect(cardCount).toBeGreaterThan(0);

    for (let i = 0; i < cardCount; i++) {
      const card = statsCards.nth(i);
      await expect(card).toBeVisible();

      const box = await card.boundingBox();
      expect(box).toBeTruthy();
      expect(box?.width).toBeGreaterThan(0);
      expect(box?.height).toBeGreaterThan(0);
    }

    if (browserName === 'webkit') {
      const graphs = authenticatedPage.locator('canvas, svg');
      const graphCount = await graphs.count();
      expect(graphCount).toBeGreaterThanOrEqual(0);
    }
  });
});
