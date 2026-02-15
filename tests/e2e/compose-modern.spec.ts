import { test, expect } from '@playwright/test';

test.describe('Compose Modern Wizard', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/compose/stacks', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [],
        }),
      });
    });

    await page.route('**/api/compose/preflight', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            valid: true,
            normalizedName: 'demo-stack',
            errors: [],
            warnings: [],
            fingerprint: 'sha256:test-fingerprint',
          },
        }),
      });
    });

    await page.route('**/api/compose/up', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          message: 'Stack started',
          data: {
            deploymentId: 'dep-1',
            fingerprint: 'sha256:test-fingerprint',
          },
        }),
      });
    });
  });

  test('validates and deploys from wizard flow', async ({ page }) => {
    await page.goto('/compose');

    await page.getByPlaceholder('Nombre del microservicio/stack (ej: api-core)').fill('demo-stack');
    await page.getByRole('button', { name: '2. Environment' }).click();
    await page.getByRole('button', { name: '+ Agregar variable' }).click();

    const keyInput = page.locator('input[placeholder="KEY"]').first();
    const valueInput = page.locator('input[placeholder="value"]').first();
    await keyInput.fill('APP_ENV');
    await valueInput.fill('production');

    await page.getByRole('button', { name: '3. Validación' }).click();
    await page.getByRole('button', { name: 'Validar configuración' }).click();
    await expect(page.getByText('Resultado:')).toBeVisible();

    await page.getByRole('button', { name: '4. Deploy' }).click();
    await page.getByRole('button', { name: 'Desplegar stack' }).click();

    await expect(page.getByText('Logs de demo-stack')).toBeVisible();
  });
});
