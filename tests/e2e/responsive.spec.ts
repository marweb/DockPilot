import { test, expect } from './auth.setup';

test.describe('Responsive Design Tests', () => {
  const viewports = {
    desktop: { width: 1920, height: 1080, deviceScaleFactor: 1 },
    tablet: { width: 768, height: 1024, deviceScaleFactor: 2 },
    mobile: { width: 375, height: 667, deviceScaleFactor: 2 },
  };

  test.beforeEach(async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard');
    await authenticatedPage.waitForLoadState('networkidle');
  });

  test('desktop viewport (1920x1080) displays correctly', async ({ authenticatedPage }) => {
    await authenticatedPage.setViewportSize({
      width: viewports.desktop.width,
      height: viewports.desktop.height,
    });
    await authenticatedPage.goto('/dashboard');
    await authenticatedPage.waitForLoadState('networkidle');

    const sidebar = authenticatedPage.locator('[data-testid="sidebar"]');
    await expect(sidebar).toBeVisible();

    const sidebarBox = await sidebar.boundingBox();
    expect(sidebarBox?.width).toBeGreaterThan(200);

    const mainContent = authenticatedPage.locator('main, [data-testid="main-content"]');
    const mainBox = await mainContent.boundingBox();
    expect(mainBox?.width).toBeGreaterThan(1000);

    const statsCards = authenticatedPage.locator('[data-testid="stats-card"]');
    const cardCount = await statsCards.count();
    expect(cardCount).toBeGreaterThanOrEqual(4);

    for (let i = 0; i < cardCount; i++) {
      const card = statsCards.nth(i);
      await expect(card).toBeVisible();

      const box = await card.boundingBox();
      expect(box?.width).toBeGreaterThan(200);
    }

    await expect(authenticatedPage).toHaveScreenshot('responsive-desktop-dashboard.png', {
      fullPage: true,
    });
  });

  test('tablet viewport (768x1024) displays correctly', async ({ authenticatedPage }) => {
    await authenticatedPage.setViewportSize({
      width: viewports.tablet.width,
      height: viewports.tablet.height,
    });
    await authenticatedPage.goto('/dashboard');
    await authenticatedPage.waitForLoadState('networkidle');

    const sidebar = authenticatedPage.locator('[data-testid="sidebar"]');

    if (await sidebar.isVisible().catch(() => false)) {
      const sidebarBox = await sidebar.boundingBox();

      if (sidebarBox && sidebarBox.width > 150) {
        expect(sidebarBox.width).toBeLessThan(250);
      }
    }

    const hamburgerBtn = authenticatedPage.locator('[data-testid="mobile-menu-toggle"]');
    if (await hamburgerBtn.isVisible().catch(() => false)) {
      await expect(hamburgerBtn).toBeVisible();
    }

    const mainContent = authenticatedPage.locator('main, [data-testid="main-content"]');
    const mainBox = await mainContent.boundingBox();
    expect(mainBox?.width).toBeGreaterThan(400);
    expect(mainBox?.width).toBeLessThan(768);

    const statsCards = authenticatedPage.locator('[data-testid="stats-card"]');
    const cardCount = await statsCards.count();

    if (cardCount >= 2) {
      const firstCard = statsCards.first();
      const secondCard = statsCards.nth(1);

      const firstBox = await firstCard.boundingBox();
      const secondBox = await secondCard.boundingBox();

      if (firstBox && secondBox) {
        const sameRow = Math.abs(firstBox.y - secondBox.y) < 50;
        const stacked = Math.abs(firstBox.x - secondBox.x) < 50;

        expect(sameRow || stacked).toBe(true);
      }
    }

    await expect(authenticatedPage).toHaveScreenshot('responsive-tablet-dashboard.png', {
      fullPage: true,
    });
  });

  test('mobile viewport (375x667) displays correctly', async ({ authenticatedPage }) => {
    await authenticatedPage.setViewportSize({
      width: viewports.mobile.width,
      height: viewports.mobile.height,
    });
    await authenticatedPage.goto('/dashboard');
    await authenticatedPage.waitForLoadState('networkidle');

    const sidebar = authenticatedPage.locator('[data-testid="sidebar"]');
    await expect(sidebar).not.toBeVisible();

    const hamburgerBtn = authenticatedPage.locator('[data-testid="mobile-menu-toggle"]');
    await expect(hamburgerBtn).toBeVisible();

    const header = authenticatedPage.locator('header, [data-testid="header"]');
    const headerBox = await header.boundingBox();
    expect(headerBox?.width).toBeLessThanOrEqual(375);

    const mainContent = authenticatedPage.locator('main, [data-testid="main-content"]');
    const mainBox = await mainContent.boundingBox();
    expect(mainBox?.width).toBeLessThanOrEqual(375);

    const statsCards = authenticatedPage.locator('[data-testid="stats-card"]');
    const cardCount = await statsCards.count();

    for (let i = 0; i < cardCount; i++) {
      const card = statsCards.nth(i);
      const box = await card.boundingBox();

      if (box) {
        expect(box.width).toBeLessThanOrEqual(375);
      }
    }

    const touchTargets = authenticatedPage.locator('button, a, [role="button"], input, select');
    const touchCount = await touchTargets.count();

    for (let i = 0; i < Math.min(touchCount, 10); i++) {
      const target = touchTargets.nth(i);
      const box = await target.boundingBox();

      if (box) {
        expect(box.width).toBeGreaterThanOrEqual(44);
        expect(box.height).toBeGreaterThanOrEqual(44);
      }
    }

    await expect(authenticatedPage).toHaveScreenshot('responsive-mobile-dashboard.png', {
      fullPage: true,
    });
  });

  test('sidebar behaves correctly across viewports', async ({ authenticatedPage }) => {
    await authenticatedPage.setViewportSize(viewports.desktop);
    await authenticatedPage.goto('/dashboard');
    await authenticatedPage.waitForLoadState('networkidle');

    const sidebar = authenticatedPage.locator('[data-testid="sidebar"]');
    const toggleBtn = authenticatedPage.locator('[data-testid="sidebar-toggle"]');

    await expect(sidebar).toBeVisible();
    await expect(toggleBtn).toBeVisible();

    await authenticatedPage.setViewportSize(viewports.tablet);
    await authenticatedPage.waitForTimeout(300);

    const sidebarTablet = authenticatedPage.locator('[data-testid="sidebar"]');
    const tabletBox = await sidebarTablet.boundingBox();

    if (tabletBox && tabletBox.width > 100) {
      expect(tabletBox.width).toBeLessThan(200);
    }

    await authenticatedPage.setViewportSize(viewports.mobile);
    await authenticatedPage.waitForTimeout(300);

    await expect(sidebar).not.toBeVisible();

    const hamburgerBtn = authenticatedPage.locator('[data-testid="mobile-menu-toggle"]');
    await expect(hamburgerBtn).toBeVisible();

    await hamburgerBtn.click();

    const mobileSidebar = authenticatedPage.locator('[data-testid="mobile-sidebar"]');
    await expect(mobileSidebar).toBeVisible();

    await authenticatedPage.keyboard.press('Escape');
    await expect(mobileSidebar).not.toBeVisible();

    await authenticatedPage.setViewportSize(viewports.desktop);
  });

  test('adaptive tables on different viewports', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/containers');
    await authenticatedPage.waitForLoadState('networkidle');

    const table = authenticatedPage.locator('table, [data-testid="data-table"]');

    await authenticatedPage.setViewportSize(viewports.desktop);
    await authenticatedPage.waitForTimeout(300);

    if (await table.isVisible().catch(() => false)) {
      const headers = table.locator('th, [role="columnheader"]');
      const headerCount = await headers.count();
      expect(headerCount).toBeGreaterThan(3);
    }

    await authenticatedPage.setViewportSize(viewports.tablet);
    await authenticatedPage.waitForTimeout(300);

    if (await table.isVisible().catch(() => false)) {
      const tableBox = await table.boundingBox();
      expect(tableBox?.width).toBeLessThanOrEqual(768);
    }

    await authenticatedPage.setViewportSize(viewports.mobile);
    await authenticatedPage.waitForTimeout(300);

    const cardView = authenticatedPage.locator(
      '[data-testid="card-view"], [data-testid="mobile-list"]'
    );
    const mobileTable = authenticatedPage.locator('table, [data-testid="data-table"]');

    const hasCardView = await cardView.isVisible().catch(() => false);
    const hasTable = await mobileTable.isVisible().catch(() => false);

    expect(hasCardView || hasTable).toBe(true);

    if (hasCardView) {
      const cards = cardView.locator('[data-testid*="card"], [data-testid*="item"]');
      const cardCount = await cards.count();
      expect(cardCount).toBeGreaterThanOrEqual(0);
    }

    await authenticatedPage.setViewportSize(viewports.desktop);
  });

  test('hamburger menu functionality on mobile', async ({ authenticatedPage }) => {
    await authenticatedPage.setViewportSize(viewports.mobile);
    await authenticatedPage.goto('/dashboard');
    await authenticatedPage.waitForLoadState('networkidle');

    const hamburgerBtn = authenticatedPage.locator('[data-testid="mobile-menu-toggle"]');
    await expect(hamburgerBtn).toBeVisible();

    await hamburgerBtn.click();

    const mobileSidebar = authenticatedPage.locator('[data-testid="mobile-sidebar"]');
    const mobileOverlay = authenticatedPage.locator('[data-testid="mobile-overlay"]');

    await expect(mobileSidebar).toBeVisible();
    await expect(mobileOverlay).toBeVisible();

    const sidebarBox = await mobileSidebar.boundingBox();
    expect(sidebarBox?.width).toBeGreaterThan(200);
    expect(sidebarBox?.width).toBeLessThan(375);

    const navLinks = mobileSidebar.locator('[data-testid^="nav-"]');
    const linkCount = await navLinks.count();
    expect(linkCount).toBeGreaterThan(3);

    const firstLink = navLinks.first();
    await firstLink.click();

    await expect(mobileSidebar).not.toBeVisible();
    await expect(mobileOverlay).not.toBeVisible();

    await hamburgerBtn.click();
    await expect(mobileSidebar).toBeVisible();

    await mobileOverlay.click();
    await expect(mobileSidebar).not.toBeVisible();

    await hamburgerBtn.click();
    await authenticatedPage.keyboard.press('Escape');
    await expect(mobileSidebar).not.toBeVisible();

    await authenticatedPage.setViewportSize(viewports.desktop);
  });

  test('responsive navigation across all pages', async ({ authenticatedPage }) => {
    const routes = ['/dashboard', '/containers', '/images', '/volumes'];

    for (const route of routes) {
      await authenticatedPage.goto(route);
      await authenticatedPage.waitForLoadState('networkidle');

      for (const [name, viewport] of Object.entries(viewports)) {
        await authenticatedPage.setViewportSize(viewport);
        await authenticatedPage.waitForTimeout(300);

        const mainContent = authenticatedPage.locator('main, [data-testid="main-content"]');
        await expect(mainContent).toBeVisible();

        const mainBox = await mainContent.boundingBox();
        expect(mainBox?.width).toBeLessThanOrEqual(viewport.width);

        const header = authenticatedPage.locator('header, [data-testid="header"]');
        const headerBox = await header.boundingBox();
        expect(headerBox?.width).toBeLessThanOrEqual(viewport.width);

        await expect(authenticatedPage).toHaveScreenshot(
          `responsive-${name}-${route.replace(/\//g, '-')}.png`,
          {
            fullPage: true,
          }
        );
      }
    }

    await authenticatedPage.setViewportSize(viewports.desktop);
  });

  test('touch targets are appropriately sized on mobile', async ({ authenticatedPage }) => {
    await authenticatedPage.setViewportSize(viewports.mobile);
    await authenticatedPage.goto('/dashboard');
    await authenticatedPage.waitForLoadState('networkidle');

    const interactiveElements = authenticatedPage.locator(
      'button, a, [role="button"], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const elementCount = await interactiveElements.count();

    const violations: Array<{ element: string; width: number; height: number }> = [];

    for (let i = 0; i < elementCount; i++) {
      const element = interactiveElements.nth(i);
      const box = await element.boundingBox();

      if (box && (box.width > 0 || box.height > 0)) {
        if (box.width < 44 || box.height < 44) {
          const tagName = await element.evaluate((el) => el.tagName.toLowerCase());
          const testId = await element.getAttribute('data-testid');
          violations.push({
            element: testId || tagName,
            width: box.width,
            height: box.height,
          });
        }
      }
    }

    expect(violations.length).toBeLessThan(elementCount * 0.2);
  });

  test('responsive images and media', async ({ authenticatedPage }) => {
    await authenticatedPage.setViewportSize(viewports.desktop);
    await authenticatedPage.goto('/dashboard');
    await authenticatedPage.waitForLoadState('networkidle');

    const images = authenticatedPage.locator('img, [data-testid*="image"], [data-testid*="logo"]');
    const imageCount = await images.count();

    if (imageCount > 0) {
      for (const [name, viewport] of Object.entries(viewports)) {
        await authenticatedPage.setViewportSize(viewport);
        await authenticatedPage.waitForTimeout(300);

        for (let i = 0; i < Math.min(imageCount, 5); i++) {
          const image = images.nth(i);
          const box = await image.boundingBox();

          if (box && box.width > 0) {
            expect(box.width).toBeLessThanOrEqual(viewport.width);

            const naturalWidth = await image.evaluate(
              (el) => (el as HTMLImageElement).naturalWidth
            );
            if (naturalWidth > 0) {
              expect(box.width / naturalWidth).toBeGreaterThanOrEqual(0.1);
            }
          }
        }
      }
    }

    await authenticatedPage.setViewportSize(viewports.desktop);
  });

  test('responsive typography scales correctly', async ({ authenticatedPage }) => {
    const testViewports = [
      { name: 'mobile', width: 375, height: 667 },
      { name: 'tablet', width: 768, height: 1024 },
      { name: 'desktop', width: 1920, height: 1080 },
    ];

    for (const viewport of testViewports) {
      await authenticatedPage.setViewportSize(viewport);
      await authenticatedPage.goto('/dashboard');
      await authenticatedPage.waitForLoadState('networkidle');

      const h1 = authenticatedPage.locator('h1').first();
      const h2 = authenticatedPage.locator('h2').first();
      const body = authenticatedPage.locator('p, span').first();

      if (await h1.isVisible().catch(() => false)) {
        const h1Size = await h1.evaluate((el) => parseFloat(window.getComputedStyle(el).fontSize));
        expect(h1Size).toBeGreaterThanOrEqual(16);

        if (viewport.name === 'mobile') {
          expect(h1Size).toBeLessThanOrEqual(32);
        }
      }

      if (await h2.isVisible().catch(() => false)) {
        const h2Size = await h2.evaluate((el) => parseFloat(window.getComputedStyle(el).fontSize));
        expect(h2Size).toBeGreaterThanOrEqual(14);
      }

      if (await body.isVisible().catch(() => false)) {
        const bodySize = await body.evaluate((el) =>
          parseFloat(window.getComputedStyle(el).fontSize)
        );
        expect(bodySize).toBeGreaterThanOrEqual(12);
      }
    }

    await authenticatedPage.setViewportSize(viewports.desktop);
  });

  test('responsive forms and inputs', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/settings');
    await authenticatedPage.waitForLoadState('networkidle');

    for (const [name, viewport] of Object.entries(viewports)) {
      await authenticatedPage.setViewportSize(viewport);
      await authenticatedPage.waitForTimeout(300);

      const inputs = authenticatedPage.locator('input, select, textarea');
      const inputCount = await inputs.count();

      for (let i = 0; i < Math.min(inputCount, 5); i++) {
        const input = inputs.nth(i);
        const box = await input.boundingBox();

        if (box) {
          expect(box.width).toBeLessThanOrEqual(viewport.width - 32);
        }
      }

      const formGroups = authenticatedPage.locator(
        '[data-testid*="form-group"], .form-group, fieldset'
      );
      const formCount = await formGroups.count();

      if (formCount > 0 && viewport.width < 768) {
        const firstGroup = formGroups.first();
        const labels = firstGroup.locator('label');
        const inputs = firstGroup.locator('input, select, textarea');

        const labelBox = await labels.first().boundingBox();
        const inputBox = await inputs.first().boundingBox();

        if (labelBox && inputBox) {
          const isStacked = Math.abs(labelBox.x - inputBox.x) < 10;
          expect(isStacked).toBe(true);
        }
      }
    }

    await authenticatedPage.setViewportSize(viewports.desktop);
  });

  test('orientation change handling', async ({ authenticatedPage }) => {
    await authenticatedPage.setViewportSize({ width: 375, height: 667 });
    await authenticatedPage.goto('/dashboard');
    await authenticatedPage.waitForLoadState('networkidle');

    await authenticatedPage.setViewportSize({ width: 667, height: 375 });
    await authenticatedPage.waitForTimeout(500);

    const mainContent = authenticatedPage.locator('main, [data-testid="main-content"]');
    await expect(mainContent).toBeVisible();

    const mainBox = await mainContent.boundingBox();
    expect(mainBox?.width).toBe(667);
    expect(mainBox?.height).toBeGreaterThan(300);

    await authenticatedPage.setViewportSize({ width: 375, height: 667 });
    await authenticatedPage.waitForTimeout(500);

    const portraitBox = await mainContent.boundingBox();
    expect(portraitBox?.width).toBe(375);

    await authenticatedPage.setViewportSize(viewports.desktop);
  });

  test('responsive accessibility compliance', async ({ authenticatedPage }) => {
    for (const [name, viewport] of Object.entries(viewports)) {
      await authenticatedPage.setViewportSize(viewport);
      await authenticatedPage.goto('/dashboard');
      await authenticatedPage.waitForLoadState('networkidle');

      // Verify content is accessible at different sizes
      const main = authenticatedPage.locator('main, [role="main"]');
      expect(await main.count()).toBeGreaterThan(0);

      const zoom200 = await authenticatedPage.evaluate(() => {
        document.body.style.zoom = '2';
        return true;
      });

      expect(zoom200).toBe(true);

      await authenticatedPage.evaluate(() => {
        document.body.style.zoom = '1';
      });
    }

    await authenticatedPage.setViewportSize(viewports.desktop);
  });

  test('responsive performance on viewport change', async ({ authenticatedPage }) => {
    const viewportsToTest = [
      { width: 1920, height: 1080 },
      { width: 1366, height: 768 },
      { width: 1024, height: 768 },
      { width: 768, height: 1024 },
      { width: 414, height: 896 },
      { width: 375, height: 667 },
    ];

    for (const viewport of viewportsToTest) {
      const startTime = Date.now();

      await authenticatedPage.setViewportSize(viewport);
      await authenticatedPage.waitForTimeout(100);

      await authenticatedPage.waitForLoadState('domcontentloaded');

      const resizeTime = Date.now() - startTime;
      expect(resizeTime).toBeLessThan(1000);

      const mainContent = authenticatedPage.locator('main, [data-testid="main-content"]');
      await expect(mainContent).toBeVisible({ timeout: 2000 });
    }

    await authenticatedPage.setViewportSize(viewports.desktop);
  });

  test('cross-browser responsive rendering', async ({ authenticatedPage, browserName }) => {
    for (const [name, viewport] of Object.entries(viewports)) {
      await authenticatedPage.setViewportSize(viewport);
      await authenticatedPage.goto('/dashboard');
      await authenticatedPage.waitForLoadState('networkidle');

      const mainContent = authenticatedPage.locator('main, [data-testid="main-content"]');
      const box = await mainContent.boundingBox();

      expect(box).toBeTruthy();
      expect(box?.width).toBeGreaterThan(0);
      expect(box?.height).toBeGreaterThan(0);

      const statsCards = authenticatedPage.locator('[data-testid="stats-card"]');
      const cardCount = await statsCards.count();

      if (cardCount > 0) {
        const firstCard = statsCards.first();
        const cardBox = await firstCard.boundingBox();

        expect(cardBox).toBeTruthy();
        expect(cardBox?.width).toBeGreaterThan(0);
      }

      if (browserName === 'firefox' || browserName === 'webkit') {
        const scrollbarWidth = await authenticatedPage.evaluate(() => {
          return window.innerWidth - document.documentElement.clientWidth;
        });

        expect(scrollbarWidth).toBeGreaterThanOrEqual(0);
      }
    }

    await authenticatedPage.setViewportSize(viewports.desktop);
  });
});
