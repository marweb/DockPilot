import { test, expect } from '@playwright/test';

test.describe('Repositories Modern Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/repos/oauth/status', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            hasPublicUrl: false,
            githubAppConfigured: true,
            gitlabOAuthConfigured: true,
          },
        }),
      });
    });

    await page.route('**/api/repos', async (route, request) => {
      if (request.method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: [] }),
        });
        return;
      }

      if (request.method() === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              id: 'repo-1',
              name: 'demo',
              provider: 'generic',
              repoUrl: 'https://github.com/example/demo.git',
              branch: 'main',
              composePath: 'docker-compose.yml',
              visibility: 'public',
              authType: 'none',
              autoDeploy: false,
              hasHttpsToken: false,
            },
          }),
        });
        return;
      }

      await route.continue();
    });

    await page.route('**/api/repos/oauth/github/device/start', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            device_code: 'abc123',
            user_code: 'WDJB-MJHT',
            verification_uri: 'https://github.com/login/device',
          },
        }),
      });
    });

    await page.route('**/api/repos/oauth/github/device/poll', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            pending: false,
            connection: { username: 'octocat' },
          },
        }),
      });
    });
  });

  test('shows fallback warning when no public URL', async ({ page }) => {
    await page.goto('/repositories');
    await expect(page.getByText('Sin URL pública')).toBeVisible();
  });

  test('creates repository and starts github device flow', async ({ page }) => {
    await page.goto('/repositories');

    await page.getByPlaceholder('Nombre').fill('demo');
    await page.getByPlaceholder('URL repositorio').fill('https://github.com/example/demo.git');
    await page.getByRole('button', { name: 'Crear repositorio' }).click();

    await expect(page.getByText('Repositorio creado correctamente')).toBeVisible();

    await page.getByRole('button', { name: 'Conectar GitHub (Device Flow)' }).click();
    await expect(page.getByText('GitHub Device Flow')).toBeVisible();
    await page.getByRole('button', { name: 'Verificar GitHub' }).click();
    await expect(page.getByText('GitHub conectado: octocat')).toBeVisible();
  });
});
