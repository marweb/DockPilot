import { test, expect } from './auth.setup';

test.describe('Internationalization Tests', () => {
  const locales = [
    { code: 'es', name: 'Español', rtl: false, dateFormat: 'DD/MM/YYYY' },
    { code: 'en', name: 'English', rtl: false, dateFormat: 'MM/DD/YYYY' },
    { code: 'fr', name: 'Français', rtl: false, dateFormat: 'DD/MM/YYYY' },
    { code: 'de', name: 'Deutsch', rtl: false, dateFormat: 'DD.MM.YYYY' },
    { code: 'zh', name: '中文', rtl: false, dateFormat: 'YYYY-MM-DD' },
  ];

  test.beforeEach(async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard');
    await authenticatedPage.waitForLoadState('networkidle');
  });

  for (const locale of locales) {
    test(`change language to ${locale.name} (${locale.code})`, async ({ authenticatedPage }) => {
      const langSelector = authenticatedPage.locator(
        '[data-testid="language-selector"], [data-testid="locale-selector"]'
      );

      if (!(await langSelector.isVisible().catch(() => false))) {
        const userMenu = authenticatedPage.locator(
          '[data-testid="user-menu"], [data-testid="settings-menu"]'
        );
        await userMenu.click();
      }

      await expect(langSelector).toBeVisible();
      await langSelector.click();

      const langOption = authenticatedPage
        .locator(`[data-testid="lang-${locale.code}"], [value="${locale.code}"]`)
        .first();
      await expect(langOption).toBeVisible({ timeout: 5000 });
      await langOption.click();

      await authenticatedPage.waitForLoadState('networkidle');
      await authenticatedPage.waitForTimeout(500);

      const htmlElement = authenticatedPage.locator('html');
      const langAttr = await htmlElement.getAttribute('lang');
      expect(langAttr?.toLowerCase()).toContain(locale.code);

      const bodyText = await authenticatedPage.locator('body').textContent();

      if (locale.code === 'es') {
        expect(bodyText?.toLowerCase()).toMatch(/panel|contenedores|imágenes|volúmenes/);
      } else if (locale.code === 'en') {
        expect(bodyText?.toLowerCase()).toMatch(/dashboard|containers|images|volumes/);
      } else if (locale.code === 'fr') {
        expect(bodyText?.toLowerCase()).toMatch(/tableau|conteneurs|images/);
      } else if (locale.code === 'de') {
        expect(bodyText?.toLowerCase()).toMatch(/dashboard|container|bilder/);
      } else if (locale.code === 'zh') {
        expect(bodyText).toMatch(/[\u4e00-\u9fa5]/);
      }

      await expect(authenticatedPage).toHaveScreenshot(`dashboard-${locale.code}.png`, {
        fullPage: true,
      });
    });
  }

  test('texts translated correctly', async ({ authenticatedPage }) => {
    const translations: Record<string, Record<string, string>> = {
      en: {
        dashboard: 'Dashboard',
        containers: 'Containers',
        images: 'Images',
        volumes: 'Volumes',
        networks: 'Networks',
        settings: 'Settings',
      },
      es: {
        dashboard: 'Panel',
        containers: 'Contenedores',
        images: 'Imágenes',
        volumes: 'Volúmenes',
        networks: 'Redes',
        settings: 'Configuración',
      },
      fr: {
        dashboard: 'Tableau de bord',
        containers: 'Conteneurs',
        images: 'Images',
        volumes: 'Volumes',
        networks: 'Réseaux',
        settings: 'Paramètres',
      },
      de: {
        dashboard: 'Dashboard',
        containers: 'Container',
        images: 'Images',
        volumes: 'Volumes',
        networks: 'Netzwerke',
        settings: 'Einstellungen',
      },
      zh: {
        dashboard: '仪表板',
        containers: '容器',
        images: '镜像',
        volumes: '卷',
        networks: '网络',
        settings: '设置',
      },
    };

    const langSelector = authenticatedPage.locator('[data-testid="language-selector"]');

    for (const [lang, texts] of Object.entries(translations)) {
      if (!(await langSelector.isVisible().catch(() => false))) {
        const userMenu = authenticatedPage.locator('[data-testid="user-menu"]');
        await userMenu.click();
      }

      await langSelector.click();
      const langOption = authenticatedPage.locator(`[data-testid="lang-${lang}"]`).first();
      await langOption.click();
      await authenticatedPage.waitForTimeout(500);

      for (const [key, expectedText] of Object.entries(texts)) {
        const navItem = authenticatedPage.locator(`[data-testid="nav-${key}"]`);
        if (await navItem.isVisible().catch(() => false)) {
          const text = await navItem.textContent();
          expect(text?.toLowerCase()).toContain(expectedText.toLowerCase());
        }
      }
    }

    await langSelector.click();
    await authenticatedPage.locator('[data-testid="lang-en"]').first().click();
  });

  test('language persistence', async ({ authenticatedPage }) => {
    const langSelector = authenticatedPage.locator('[data-testid="language-selector"]');

    if (!(await langSelector.isVisible().catch(() => false))) {
      const userMenu = authenticatedPage.locator('[data-testid="user-menu"]');
      await userMenu.click();
    }

    await langSelector.click();
    await authenticatedPage.locator('[data-testid="lang-es"]').first().click();
    await authenticatedPage.waitForTimeout(500);

    const htmlBefore = await authenticatedPage.locator('html').getAttribute('lang');

    await authenticatedPage.reload();
    await authenticatedPage.waitForLoadState('networkidle');

    const htmlAfter = await authenticatedPage.locator('html').getAttribute('lang');
    expect(htmlAfter).toBe(htmlBefore);

    const localStorage = await authenticatedPage.evaluate(() => {
      return {
        locale: localStorage.getItem('locale'),
        language: localStorage.getItem('language'),
        i18nextLng: localStorage.getItem('i18nextLng'),
      };
    });

    const storedLang = localStorage.locale || localStorage.language || localStorage.i18nextLng;
    expect(storedLang).toBeTruthy();
    expect(storedLang).toContain('es');

    await authenticatedPage.goto('/containers');
    await authenticatedPage.waitForLoadState('networkidle');

    const htmlOnOtherPage = await authenticatedPage.locator('html').getAttribute('lang');
    expect(htmlOnOtherPage).toBe(htmlBefore);
  });

  test('dates formatted according to locale', async ({ authenticatedPage }) => {
    const langSelector = authenticatedPage.locator('[data-testid="language-selector"]');

    for (const locale of locales) {
      if (!(await langSelector.isVisible().catch(() => false))) {
        const userMenu = authenticatedPage.locator('[data-testid="user-menu"]');
        await userMenu.click();
      }

      await langSelector.click();
      await authenticatedPage.locator(`[data-testid="lang-${locale.code}"]`).first().click();
      await authenticatedPage.waitForTimeout(500);

      const dateElements = authenticatedPage.locator(
        '[data-testid*="date"], [data-testid*="time"], time'
      );
      const count = await dateElements.count();

      if (count > 0) {
        for (let i = 0; i < Math.min(count, 3); i++) {
          const dateText = await dateElements.nth(i).textContent();
          expect(dateText).toBeTruthy();

          if (locale.code === 'en') {
            expect(dateText).toMatch(/\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{2}-\d{2}/);
          } else if (locale.code === 'es' || locale.code === 'fr') {
            expect(dateText).toMatch(/\d{1,2}[\/\.]\d{1,2}[\/\.]\d{4}/);
          } else if (locale.code === 'de') {
            expect(dateText).toMatch(/\d{1,2}\.\d{1,2}\.\d{4}/);
          } else if (locale.code === 'zh') {
            expect(dateText).toMatch(/\d{4}[年/-]\d{1,2}[月/-]\d{1,2}/);
          }
        }
      }

      const intlDate = await authenticatedPage.evaluate((lang) => {
        const date = new Date('2024-01-15');
        return new Intl.DateTimeFormat(lang).format(date);
      }, locale.code);

      expect(intlDate).toBeTruthy();
    }
  });

  test('numbers formatted according to locale', async ({ authenticatedPage }) => {
    const langSelector = authenticatedPage.locator('[data-testid="language-selector"]');

    for (const locale of locales) {
      if (!(await langSelector.isVisible().catch(() => false))) {
        const userMenu = authenticatedPage.locator('[data-testid="user-menu"]');
        await userMenu.click();
      }

      await langSelector.click();
      await authenticatedPage.locator(`[data-testid="lang-${locale.code}"]`).first().click();
      await authenticatedPage.waitForTimeout(500);

      const numberElements = authenticatedPage.locator(
        '[data-testid="stats-count"], [data-testid*="count"], [data-testid*="size"]'
      );
      const count = await numberElements.count();

      if (count > 0) {
        for (let i = 0; i < Math.min(count, 3); i++) {
          const numberText = await numberElements.nth(i).textContent();
          expect(numberText).toBeTruthy();

          const hasNumber = /\d/.test(numberText || '');
          if (hasNumber) {
            const intlNumber = await authenticatedPage.evaluate((lang) => {
              return new Intl.NumberFormat(lang).format(1234567.89);
            }, locale.code);

            expect(intlNumber).toContain('1');
          }
        }
      }
    }
  });

  test('RTL support for applicable languages', async ({ authenticatedPage }) => {
    const rtlLocales = ['ar', 'he', 'fa'];

    const langSelector = authenticatedPage.locator('[data-testid="language-selector"]');

    if (!(await langSelector.isVisible().catch(() => false))) {
      const userMenu = authenticatedPage.locator('[data-testid="user-menu"]');
      await userMenu.click();
    }

    for (const locale of rtlLocales) {
      const langOption = authenticatedPage.locator(`[data-testid="lang-${locale}"]`);

      if (await langOption.isVisible().catch(() => false)) {
        await langSelector.click();
        await langOption.click();
        await authenticatedPage.waitForTimeout(500);

        const htmlElement = authenticatedPage.locator('html');
        const dir = await htmlElement.getAttribute('dir');
        expect(dir).toBe('rtl');

        const body = authenticatedPage.locator('body');
        const textAlign = await body.evaluate((el) => {
          return window.getComputedStyle(el).direction;
        });
        expect(textAlign).toBe('rtl');

        await expect(authenticatedPage).toHaveScreenshot(`dashboard-rtl-${locale}.png`, {
          fullPage: true,
        });
      }
    }

    await langSelector.click();
    await authenticatedPage.locator('[data-testid="lang-en"]').first().click();
  });

  test('language switcher accessibility', async ({ authenticatedPage }) => {
    const langSelector = authenticatedPage.locator('[data-testid="language-selector"]');

    if (!(await langSelector.isVisible().catch(() => false))) {
      const userMenu = authenticatedPage.locator('[data-testid="user-menu"]');
      await userMenu.click();
    }

    await expect(langSelector).toBeVisible();

    const ariaLabel = await langSelector.getAttribute('aria-label');
    const title = await langSelector.getAttribute('title');
    expect(ariaLabel || title).toBeTruthy();

    await langSelector.focus();
    await expect(langSelector).toBeFocused();

    await authenticatedPage.keyboard.press('Enter');

    const dropdown = authenticatedPage.locator(
      '[role="listbox"], [data-testid="language-dropdown"]'
    );
    await expect(dropdown).toBeVisible();

    await authenticatedPage.keyboard.press('ArrowDown');

    const firstOption = dropdown.locator('[role="option"], [data-testid^="lang-"]').first();
    await expect(firstOption).toBeFocused();

    await authenticatedPage.keyboard.press('Escape');
    await expect(dropdown).not.toBeVisible();

    // Verify language selector has proper ARIA attributes
    const expanded = await langSelector.getAttribute('aria-expanded');
    expect(expanded === 'true' || expanded === 'false').toBe(true);
  });

  test('language preference in URL', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/es/dashboard');
    await authenticatedPage.waitForLoadState('networkidle');

    const htmlElement = authenticatedPage.locator('html');
    const lang = await htmlElement.getAttribute('lang');
    expect(lang).toContain('es');

    const bodyText = await authenticatedPage.locator('body').textContent();
    expect(bodyText?.toLowerCase()).toMatch(/panel|contenedores/);

    await authenticatedPage.goto('/fr/dashboard');
    await authenticatedPage.waitForLoadState('networkidle');

    const frLang = await htmlElement.getAttribute('lang');
    expect(frLang).toContain('fr');
  });

  test('language preference in cookies', async ({ authenticatedPage, context }) => {
    await context.addCookies([
      {
        name: 'locale',
        value: 'de',
        domain: 'localhost',
        path: '/',
      },
    ]);

    await authenticatedPage.reload();
    await authenticatedPage.waitForLoadState('networkidle');

    const htmlElement = authenticatedPage.locator('html');
    const lang = await htmlElement.getAttribute('lang');
    expect(lang).toContain('de');
  });

  test('currency and unit formatting by locale', async ({ authenticatedPage }) => {
    const langSelector = authenticatedPage.locator('[data-testid="language-selector"]');

    if (!(await langSelector.isVisible().catch(() => false))) {
      const userMenu = authenticatedPage.locator('[data-testid="user-menu"]');
      await userMenu.click();
    }

    await langSelector.click();
    await authenticatedPage.locator('[data-testid="lang-en"]').first().click();
    await authenticatedPage.waitForTimeout(500);

    const sizeElements = authenticatedPage.locator(
      '[data-testid*="size"], [data-testid*="memory"], [data-testid*="disk"]'
    );
    const count = await sizeElements.count();

    for (let i = 0; i < Math.min(count, 3); i++) {
      const sizeText = await sizeElements.nth(i).textContent();

      const hasUnit = /MB|GB|TB|KB|bytes?/i.test(sizeText || '');
      if (hasUnit) {
        expect(sizeText).toMatch(/\d+\.?\d*\s*(MB|GB|TB|KB|bytes?)/i);
      }
    }

    const formatTests = [
      { locale: 'en', number: 1234.56, expected: /1[,.]234/ },
      { locale: 'de', number: 1234.56, expected: /1.234|1[,.]234/ },
      { locale: 'fr', number: 1234.56, expected: /1[\s.]234/ },
    ];

    for (const test of formatTests) {
      const formatted = await authenticatedPage.evaluate((data) => {
        return new Intl.NumberFormat(data.locale, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(data.number);
      }, test);

      expect(formatted).toMatch(test.expected);
    }
  });

  test('cross-browser i18n support', async ({ authenticatedPage, browserName }) => {
    const langSelector = authenticatedPage.locator('[data-testid="language-selector"]');

    if (!(await langSelector.isVisible().catch(() => false))) {
      const userMenu = authenticatedPage.locator('[data-testid="user-menu"]');
      await userMenu.click();
    }

    const testLocales = ['es', 'fr', 'de'];

    for (const locale of testLocales) {
      await langSelector.click();
      const langOption = authenticatedPage.locator(`[data-testid="lang-${locale}"]`).first();
      await langOption.click();
      await authenticatedPage.waitForTimeout(500);

      const htmlElement = authenticatedPage.locator('html');
      const lang = await htmlElement.getAttribute('lang');
      expect(lang).toContain(locale);

      const intlSupported = await authenticatedPage.evaluate((l) => {
        try {
          new Intl.DateTimeFormat(l).format(new Date());
          new Intl.NumberFormat(l).format(1234.56);
          return true;
        } catch {
          return false;
        }
      }, locale);

      expect(intlSupported).toBe(true);
    }
  });
});
