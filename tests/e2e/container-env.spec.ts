import { test, expect } from '@playwright/test';

const containerId = 'container-env-test';

test.describe('Container env recreate and rollback', () => {
  test('applies env changes with recreate and shows rollback backup', async ({ page }) => {
    let currentEnv: Record<string, string> = {
      APP_ENV: 'production',
      API_TOKEN: 'super-secret',
    };
    let capturedUpdatePayload: Record<string, unknown> | null = null;

    await page.route(`**/api/containers/${containerId}`, async (route, request) => {
      if (request.method() !== 'GET') {
        await route.continue();
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            id: containerId,
            state: { running: true },
          },
        }),
      });
    });

    await page.route(`**/api/containers/${containerId}/env`, async (route, request) => {
      if (request.method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              env: currentEnv,
              containerName: 'container-env-test',
              image: 'nginx:alpine',
              running: true,
            },
          }),
        });
        return;
      }

      if (request.method() === 'PUT') {
        capturedUpdatePayload = request.postDataJSON() as Record<string, unknown>;
        currentEnv = ((capturedUpdatePayload?.env as Record<string, string>) ||
          currentEnv) as Record<string, string>;

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              previousContainerId: containerId,
              newContainerId: `${containerId}-new`,
              rollbackContainerName: 'rollback_container_env_test',
              rollbackAvailable: true,
            },
          }),
        });
        return;
      }

      await route.continue();
    });

    await page.goto(`/containers/${containerId}`);
    await expect(page.getByText('Variables de entorno por microservicio')).toBeVisible();

    await page.getByRole('button', { name: '+ Agregar variable' }).click();
    const envInputs = page.locator('div.grid input');
    const count = await envInputs.count();
    await envInputs.nth(count - 2).fill('FEATURE_FLAG');
    await envInputs.nth(count - 1).fill('enabled');

    await page.getByRole('button', { name: 'Guardar y recrear' }).click();

    await expect(
      page.getByText('Variables aplicadas. Backup: rollback_container_env_test')
    ).toBeVisible();
    await expect(page.getByText('Variables aplicadas')).toBeVisible();

    expect(capturedUpdatePayload).toMatchObject({
      recreate: true,
      rollbackOnFailure: true,
      keepRollbackContainer: true,
      env: {
        FEATURE_FLAG: 'enabled',
      },
    });
  });

  test('shows API error message when recreate fails', async ({ page }) => {
    await page.route(`**/api/containers/${containerId}`, async (route, request) => {
      if (request.method() !== 'GET') {
        await route.continue();
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            id: containerId,
            state: { running: false },
          },
        }),
      });
    });

    await page.route(`**/api/containers/${containerId}/env`, async (route, request) => {
      if (request.method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              env: {
                APP_ENV: 'production',
              },
              containerName: 'container-env-test',
              image: 'nginx:alpine',
              running: false,
            },
          }),
        });
        return;
      }

      if (request.method() === 'PUT') {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            error: {
              code: 'INTERNAL_ERROR',
              message: 'Rollback fallback also failed',
            },
          }),
        });
        return;
      }

      await route.continue();
    });

    await page.goto(`/containers/${containerId}`);
    await expect(page.getByText('Variables de entorno por microservicio')).toBeVisible();

    await page.getByRole('button', { name: 'Guardar y recrear' }).click();
    await expect(page.getByText('Rollback fallback also failed')).toBeVisible();
  });
});
