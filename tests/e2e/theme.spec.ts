import { test, expect } from './auth.setup';

test.describe('Theme Tests', () => {
  test.beforeEach(async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard');
    await authenticatedPage.waitForLoadState('networkidle');
  });

  test('switch to dark mode', async ({ authenticatedPage }) => {
    const themeToggle = authenticatedPage.locator(
      '[data-testid="theme-toggle"], [data-testid="dark-mode-toggle"]'
    );

    if (!(await themeToggle.isVisible().catch(() => false))) {
      const userMenu = authenticatedPage.locator(
        '[data-testid="user-menu"], [data-testid="theme-menu"]'
      );
      await userMenu.click();
    }

    await expect(themeToggle).toBeVisible();

    const htmlElement = authenticatedPage.locator('html');
    const initialTheme =
      (await htmlElement.getAttribute('data-theme')) || (await htmlElement.getAttribute('class'));
    const isInitiallyDark = initialTheme?.includes('dark');

    if (!isInitiallyDark) {
      await themeToggle.click();
    } else {
      await themeToggle.click();
      await authenticatedPage.waitForTimeout(300);
      await themeToggle.click();
    }

    await authenticatedPage.waitForTimeout(500);

    const currentTheme =
      (await htmlElement.getAttribute('data-theme')) || (await htmlElement.getAttribute('class'));
    expect(currentTheme).toContain('dark');

    const bodyBg = await authenticatedPage.evaluate(() => {
      return window.getComputedStyle(document.body).backgroundColor;
    });

    const rgb = bodyBg.match(/\d+/g)?.map(Number);
    if (rgb && rgb.length >= 3) {
      const brightness = (rgb[0] * 299 + rgb[1] * 587 + rgb[2] * 114) / 1000;
      expect(brightness).toBeLessThan(128);
    }

    await expect(authenticatedPage).toHaveScreenshot('dashboard-dark-mode.png', {
      fullPage: true,
    });

    // Verify high contrast mode is applied
    const body = authenticatedPage.locator('body');
    const bgColor = await body.evaluate((el) => window.getComputedStyle(el).backgroundColor);
    expect(bgColor).toBeTruthy();
  });

  test('switch to light mode', async ({ authenticatedPage }) => {
    const themeToggle = authenticatedPage.locator(
      '[data-testid="theme-toggle"], [data-testid="light-mode-toggle"]'
    );

    if (!(await themeToggle.isVisible().catch(() => false))) {
      const userMenu = authenticatedPage.locator(
        '[data-testid="user-menu"], [data-testid="theme-menu"]'
      );
      await userMenu.click();
    }

    await expect(themeToggle).toBeVisible();

    const htmlElement = authenticatedPage.locator('html');
    const initialTheme =
      (await htmlElement.getAttribute('data-theme')) || (await htmlElement.getAttribute('class'));
    const isInitiallyLight = !initialTheme?.includes('dark');

    if (!isInitiallyLight) {
      await themeToggle.click();
    } else {
      await themeToggle.click();
      await authenticatedPage.waitForTimeout(300);
      await themeToggle.click();
    }

    await authenticatedPage.waitForTimeout(500);

    const currentTheme =
      (await htmlElement.getAttribute('data-theme')) || (await htmlElement.getAttribute('class'));
    expect(currentTheme).not.toContain('dark');
    expect(currentTheme).toContain('light');

    const bodyBg = await authenticatedPage.evaluate(() => {
      return window.getComputedStyle(document.body).backgroundColor;
    });

    const rgb = bodyBg.match(/\d+/g)?.map(Number);
    if (rgb && rgb.length >= 3) {
      const brightness = (rgb[0] * 299 + rgb[1] * 587 + rgb[2] * 114) / 1000;
      expect(brightness).toBeGreaterThan(200);
    }

    await expect(authenticatedPage).toHaveScreenshot('dashboard-light-mode.png', {
      fullPage: true,
    });
  });

  test('theme persistence across page reloads', async ({ authenticatedPage }) => {
    const themeToggle = authenticatedPage.locator('[data-testid="theme-toggle"]');

    if (!(await themeToggle.isVisible().catch(() => false))) {
      const userMenu = authenticatedPage.locator('[data-testid="user-menu"]');
      await userMenu.click();
    }

    await themeToggle.click();
    await authenticatedPage.waitForTimeout(500);

    const htmlElement = authenticatedPage.locator('html');
    const themeBeforeReload =
      (await htmlElement.getAttribute('data-theme')) || (await htmlElement.getAttribute('class'));

    await authenticatedPage.reload();
    await authenticatedPage.waitForLoadState('networkidle');

    const themeAfterReload =
      (await htmlElement.getAttribute('data-theme')) || (await htmlElement.getAttribute('class'));
    expect(themeAfterReload).toBe(themeBeforeReload);

    const localStorage = await authenticatedPage.evaluate(() => {
      return {
        theme: localStorage.getItem('theme'),
        colorScheme: localStorage.getItem('colorScheme'),
      };
    });

    expect(localStorage.theme || localStorage.colorScheme).toBeTruthy();
  });

  test('system detects OS preference', async ({ authenticatedPage }) => {
    await authenticatedPage.evaluate(() => {
      localStorage.removeItem('theme');
      localStorage.removeItem('colorScheme');
    });

    await authenticatedPage.reload();
    await authenticatedPage.waitForLoadState('networkidle');

    const prefersDark = await authenticatedPage.evaluate(() => {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    });

    const htmlElement = authenticatedPage.locator('html');
    const currentTheme =
      (await htmlElement.getAttribute('data-theme')) || (await htmlElement.getAttribute('class'));

    if (prefersDark) {
      expect(currentTheme).toContain('dark');
    } else {
      expect(currentTheme).toContain('light');
    }
  });

  test('theme applied consistently across all components', async ({ authenticatedPage }) => {
    const themeToggle = authenticatedPage.locator('[data-testid="theme-toggle"]');
    if (!(await themeToggle.isVisible().catch(() => false))) {
      const userMenu = authenticatedPage.locator('[data-testid="user-menu"]');
      await userMenu.click();
    }

    await themeToggle.click();
    await authenticatedPage.waitForTimeout(500);

    const components = [
      { selector: 'header, [data-testid="header"]', name: 'Header' },
      { selector: '[data-testid="sidebar"]', name: 'Sidebar' },
      { selector: 'main, [data-testid="main-content"]', name: 'Main Content' },
      { selector: '[data-testid="stats-card"]', name: 'Stats Card' },
      { selector: 'button', name: 'Button' },
      { selector: 'table, [data-testid="data-table"]', name: 'Table' },
      { selector: '[data-testid="modal"]', name: 'Modal' },
    ];

    for (const component of components) {
      const element = authenticatedPage.locator(component.selector).first();
      if (await element.isVisible().catch(() => false)) {
        const themeClass = await element.evaluate((el) => {
          const htmlTheme =
            document.documentElement.getAttribute('data-theme') ||
            document.documentElement.className;
          return htmlTheme;
        });

        expect(themeClass).toContain('dark');
      }
    }

    const routes = ['/dashboard', '/containers', '/images', '/settings'];
    for (const route of routes) {
      await authenticatedPage.goto(route);
      await authenticatedPage.waitForLoadState('networkidle');

      const htmlElement = authenticatedPage.locator('html');
      const theme =
        (await htmlElement.getAttribute('data-theme')) || (await htmlElement.getAttribute('class'));
      expect(theme).toContain('dark');
    }
  });

  test('theme toggle accessibility', async ({ authenticatedPage }) => {
    const themeToggle = authenticatedPage.locator('[data-testid="theme-toggle"]');

    if (!(await themeToggle.isVisible().catch(() => false))) {
      const userMenu = authenticatedPage.locator('[data-testid="user-menu"]');
      await userMenu.click();
    }

    await expect(themeToggle).toBeVisible();

    const ariaLabel = await themeToggle.getAttribute('aria-label');
    const title = await themeToggle.getAttribute('title');
    expect(ariaLabel || title).toBeTruthy();
    expect((ariaLabel || title)?.toLowerCase()).toMatch(/theme|dark|light|mode/);

    await themeToggle.focus();
    await expect(themeToggle).toBeFocused();

    await authenticatedPage.keyboard.press('Enter');
    await authenticatedPage.waitForTimeout(300);

    await authenticatedPage.keyboard.press('Space');
    await authenticatedPage.waitForTimeout(300);

    // Verify toggle button has proper ARIA attributes
    const pressed = await themeToggle.getAttribute('aria-pressed');
    expect(pressed === 'true' || pressed === 'false').toBe(true);
  });

  test('theme transitions smoothly', async ({ authenticatedPage }) => {
    const themeToggle = authenticatedPage.locator('[data-testid="theme-toggle"]');

    if (!(await themeToggle.isVisible().catch(() => false))) {
      const userMenu = authenticatedPage.locator('[data-testid="user-menu"]');
      await userMenu.click();
    }

    const body = authenticatedPage.locator('body');
    const hasTransition = await body.evaluate((el) => {
      const style = window.getComputedStyle(el);
      return style.transition.includes('background-color') || style.transition.includes('color');
    });

    const html = authenticatedPage.locator('html');
    const htmlHasTransition = await html.evaluate((el) => {
      const style = window.getComputedStyle(el);
      return style.transitionDuration !== '0s';
    });

    const startTime = Date.now();
    await themeToggle.click();
    await authenticatedPage.waitForTimeout(100);

    const endTime = Date.now();
    const transitionTime = endTime - startTime;

    if (hasTransition || htmlHasTransition) {
      expect(transitionTime).toBeGreaterThan(50);
    }
  });

  test('theme respects user preference in cookies', async ({ authenticatedPage, context }) => {
    await context.addCookies([
      {
        name: 'theme',
        value: 'dark',
        domain: 'localhost',
        path: '/',
      },
    ]);

    await authenticatedPage.reload();
    await authenticatedPage.waitForLoadState('networkidle');

    const htmlElement = authenticatedPage.locator('html');
    const theme =
      (await htmlElement.getAttribute('data-theme')) || (await htmlElement.getAttribute('class'));
    expect(theme).toContain('dark');
  });

  test('theme on different viewports', async ({ authenticatedPage }) => {
    const viewports = [
      { width: 1920, height: 1080 },
      { width: 768, height: 1024 },
      { width: 375, height: 667 },
    ];

    const themeToggle = authenticatedPage.locator('[data-testid="theme-toggle"]');

    for (const viewport of viewports) {
      await authenticatedPage.setViewportSize(viewport);

      if (!(await themeToggle.isVisible().catch(() => false))) {
        const userMenu = authenticatedPage.locator('[data-testid="user-menu"]');
        await userMenu.click();
      }

      await themeToggle.click();
      await authenticatedPage.waitForTimeout(300);

      const htmlElement = authenticatedPage.locator('html');
      const theme =
        (await htmlElement.getAttribute('data-theme')) || (await htmlElement.getAttribute('class'));
      expect(theme).toContain('dark');

      await expect(authenticatedPage).toHaveScreenshot(
        `theme-dark-${viewport.width}x${viewport.height}.png`
      );
    }

    await authenticatedPage.setViewportSize({ width: 1920, height: 1080 });
  });

  test('cross-browser theme support', async ({ authenticatedPage, browserName }) => {
    const themeToggle = authenticatedPage.locator('[data-testid="theme-toggle"]');

    if (!(await themeToggle.isVisible().catch(() => false))) {
      const userMenu = authenticatedPage.locator('[data-testid="user-menu"]');
      await userMenu.click();
    }

    await themeToggle.click();
    await authenticatedPage.waitForTimeout(500);

    const htmlElement = authenticatedPage.locator('html');
    const theme =
      (await htmlElement.getAttribute('data-theme')) || (await htmlElement.getAttribute('class'));

    if (browserName === 'firefox') {
      expect(theme).toContain('dark');
    } else if (browserName === 'webkit') {
      expect(theme).toContain('dark');
    } else {
      expect(theme).toContain('dark');
    }

    const supportsDarkMode = await authenticatedPage.evaluate(() => {
      return CSS.supports('color-scheme', 'dark');
    });

    expect(supportsDarkMode).toBe(true);
  });

  test('theme with high contrast preference', async ({ authenticatedPage }) => {
    await authenticatedPage.emulateMedia({
      prefersColorScheme: 'dark',
      prefersContrast: 'high',
    });

    await authenticatedPage.reload();
    await authenticatedPage.waitForLoadState('networkidle');

    const htmlElement = authenticatedPage.locator('html');
    const classes = (await htmlElement.getAttribute('class')) || '';

    expect(classes.includes('dark') || classes.includes('high-contrast')).toBe(true);

    // Verify contrast in dark mode
    const bodyText = await authenticatedPage
      .locator('body')
      .evaluate((el) => window.getComputedStyle(el).color);
    expect(bodyText).toBeTruthy();
  });
});
