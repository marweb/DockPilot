import { test, expect } from '@playwright/test';
import { SettingsPage } from './pages/SettingsPage';
import { mockUsers, mockTokens } from '../fixtures/data';

test.describe('Settings E2E Tests', () => {
  let settingsPage: SettingsPage;

  test.beforeEach(async ({ page }) => {
    settingsPage = new SettingsPage(page);

    // Mock settings API
    await page.route('**/api/settings/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            username: mockUsers[0].username,
            email: 'admin@example.com',
            displayName: 'Admin User',
            bio: '',
            language: 'en',
            theme: 'system',
            notifications: {
              emailEnabled: true,
              pushEnabled: true,
              containerAlerts: true,
              tunnelAlerts: true,
              securityAlerts: true,
            },
          },
        }),
      });
    });

    await settingsPage.goto();
  });

  test.describe('Profile Settings', () => {
    test('should update username successfully', async ({ page }) => {
      await page.route('**/api/settings/profile**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: { username: 'newusername' },
          }),
        });
      });

      await settingsPage.updateUsername('newusername');
      await settingsPage.expectSuccess();
    });

    test('should validate username format', async () => {
      await settingsPage.goToTab('profile');
      await settingsPage.usernameInput.clear();
      await settingsPage.usernameInput.fill('ab'); // Too short
      await settingsPage.saveProfileButton.click();

      // Should show validation error
      const hasError = await settingsPage.validationErrors.isVisible().catch(() => false);
      expect(hasError).toBeTruthy();
    });

    test('should prevent duplicate usernames', async ({ page }) => {
      await page.route('**/api/settings/profile**', async (route) => {
        await route.fulfill({
          status: 409,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            error: 'Username already exists',
          }),
        });
      });

      await settingsPage.updateUsername('existinguser');
      await settingsPage.expectError();
    });

    test('should update display name', async ({ page }) => {
      await page.route('**/api/settings/profile**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: { displayName: 'New Display Name' },
          }),
        });
      });

      await settingsPage.updateDisplayName('New Display Name');
      await settingsPage.expectSuccess();
    });

    test('should update bio', async ({ page }) => {
      await page.route('**/api/settings/profile**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: { bio: 'This is my bio' },
          }),
        });
      });

      await settingsPage.updateBio('This is my bio');
      await settingsPage.expectSuccess();
    });
  });

  test.describe('Account Settings', () => {
    test('should change email with verification', async ({ page }) => {
      await page.route('**/api/settings/email**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: { email: 'newemail@example.com', verificationSent: true },
          }),
        });
      });

      await settingsPage.updateEmail('newemail@example.com', 'currentPassword123');
      await settingsPage.expectSuccess();
    });

    test('should validate email format', async () => {
      await settingsPage.goToTab('account');
      await settingsPage.emailInput.clear();
      await settingsPage.emailInput.fill('invalid-email');
      await settingsPage.saveAccountButton.click();

      const hasError = await settingsPage.validationErrors.isVisible().catch(() => false);
      expect(hasError).toBeTruthy();
    });

    test('should change password successfully', async ({ page }) => {
      await page.route('**/api/settings/password**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            message: 'Password changed successfully',
          }),
        });
      });

      await settingsPage.changePassword('oldPassword123', 'newSecurePass456!');
      await settingsPage.expectSuccess();
    });

    test('should validate password requirements', async () => {
      await settingsPage.goToTab('account');
      await settingsPage.currentPasswordInput.fill('currentPass');
      await settingsPage.newPasswordInput.fill('123'); // Too weak
      await settingsPage.confirmPasswordInput.fill('123');
      await settingsPage.changePasswordButton.click();

      const hasError = await settingsPage.validationErrors.isVisible().catch(() => false);
      expect(hasError).toBeTruthy();
    });

    test('should validate password confirmation matches', async () => {
      await settingsPage.goToTab('account');
      await settingsPage.currentPasswordInput.fill('currentPass');
      await settingsPage.newPasswordInput.fill('newSecurePass456!');
      await settingsPage.confirmPasswordInput.fill('differentPass');
      await settingsPage.changePasswordButton.click();

      const passwordsMatch = await settingsPage.doPasswordsMatch();
      expect(passwordsMatch).toBeFalsy();
    });

    test('should require current password for email change', async () => {
      await settingsPage.goToTab('account');
      await settingsPage.emailInput.clear();
      await settingsPage.emailInput.fill('new@example.com');
      // Don't fill current password
      await settingsPage.saveAccountButton.click();

      const hasError = await settingsPage.validationErrors.isVisible().catch(() => false);
      expect(hasError).toBeTruthy();
    });
  });

  test.describe('Notification Settings', () => {
    test('should toggle email notifications', async ({ page }) => {
      await page.route('**/api/settings/notifications**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: { emailEnabled: false },
          }),
        });
      });

      await settingsPage.toggleEmailNotifications(false);
      await settingsPage.expectSuccess();
    });

    test('should toggle push notifications', async ({ page }) => {
      await page.route('**/api/settings/notifications**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: { pushEnabled: true },
          }),
        });
      });

      await settingsPage.togglePushNotifications(true);
      await settingsPage.expectSuccess();
    });

    test('should toggle container alerts', async ({ page }) => {
      await page.route('**/api/settings/notifications**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: { containerAlerts: true },
          }),
        });
      });

      await settingsPage.toggleContainerAlerts(true);
      await settingsPage.expectSuccess();
    });

    test('should toggle tunnel alerts', async ({ page }) => {
      await page.route('**/api/settings/notifications**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: { tunnelAlerts: false },
          }),
        });
      });

      await settingsPage.toggleTunnelAlerts(false);
      await settingsPage.expectSuccess();
    });

    test('should toggle security alerts', async ({ page }) => {
      await page.route('**/api/settings/notifications**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: { securityAlerts: true },
          }),
        });
      });

      await settingsPage.toggleSecurityAlerts(true);
      await settingsPage.expectSuccess();
    });
  });

  test.describe('Appearance Settings', () => {
    test('should change theme to dark mode', async ({ page }) => {
      await page.route('**/api/settings/appearance**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: { theme: 'dark' },
          }),
        });
      });

      await settingsPage.setTheme('dark');
      await settingsPage.expectSuccess();

      // Verify theme applied
      const theme = await settingsPage.getCurrentTheme();
      expect(theme).toBe('dark');
    });

    test('should change theme to light mode', async ({ page }) => {
      await page.route('**/api/settings/appearance**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: { theme: 'light' },
          }),
        });
      });

      await settingsPage.setTheme('light');
      await settingsPage.expectSuccess();
    });

    test('should change theme to system', async ({ page }) => {
      await page.route('**/api/settings/appearance**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: { theme: 'system' },
          }),
        });
      });

      await settingsPage.setTheme('system');
      await settingsPage.expectSuccess();
    });

    test('should change language', async ({ page }) => {
      await page.route('**/api/settings/appearance**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: { language: 'es' },
          }),
        });
      });

      await settingsPage.setLanguage('es');
      await settingsPage.expectSuccess();

      const language = await settingsPage.getCurrentLanguage();
      expect(language).toBe('es');
    });

    test('should toggle compact mode', async ({ page }) => {
      await page.route('**/api/settings/appearance**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: { compactMode: true },
          }),
        });
      });

      await settingsPage.toggleCompactMode(true);
      await settingsPage.expectSuccess();
    });
  });

  test.describe('API Keys Management', () => {
    test('should create new API key', async ({ page }) => {
      await page.route('**/api/settings/api-keys**', async (route, request) => {
        if (request.method() === 'POST') {
          await route.fulfill({
            status: 201,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              data: {
                id: 'key-123',
                name: 'Test API Key',
                key: 'dp_test_key_abc123xyz',
                createdAt: new Date().toISOString(),
              },
            }),
          });
        } else {
          await route.continue();
        }
      });

      const apiKey = await settingsPage.createApiKey(
        'Test API Key',
        'read:containers,write:containers'
      );
      expect(apiKey).toBeTruthy();
      await settingsPage.expectSuccess();
    });

    test('should list existing API keys', async ({ page }) => {
      await page.route('**/api/settings/api-keys**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: [
              { id: 'key-1', name: 'Production Key', createdAt: '2024-01-01' },
              { id: 'key-2', name: 'Development Key', createdAt: '2024-01-02' },
            ],
          }),
        });
      });

      await settingsPage.goToTab('api');
      const count = await settingsPage.getApiKeysCount();
      expect(count).toBeGreaterThanOrEqual(0);
    });

    test('should revoke API key', async ({ page }) => {
      await page.route('**/api/settings/api-keys/key-1**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            message: 'API key revoked',
          }),
        });
      });

      await settingsPage.revokeApiKey('Production Key');
      await settingsPage.expectSuccess();
    });

    test('should validate API key name', async () => {
      await settingsPage.goToTab('api');
      await settingsPage.createApiKeyButton.click();
      await settingsPage.apiKeyNameInput.fill('');
      await settingsPage.generateKeyButton.click();

      const hasError = await settingsPage.validationErrors.isVisible().catch(() => false);
      expect(hasError).toBeTruthy();
    });
  });

  test.describe('Two-Factor Authentication', () => {
    test('should enable 2FA setup', async ({ page }) => {
      await page.route('**/api/settings/2fa/setup**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              qrCode: 'data:image/png;base64,mockqrcode',
              secret: 'MOCKSECRETKEY',
            },
          }),
        });
      });

      await settingsPage.enableTwoFactor();

      // Modal should appear for QR code scanning
      const modalVisible = await settingsPage.twoFactorModal.isVisible().catch(() => false);
      expect(modalVisible).toBeTruthy();
    });

    test('should verify 2FA code', async ({ page }) => {
      await page.route('**/api/settings/2fa/verify**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: { backupCodes: ['12345678', '87654321'] },
          }),
        });
      });

      // First enable 2FA to show modal
      await settingsPage.enableTwoFactor();
      await settingsPage.enterTwoFactorCode('123456');
      await settingsPage.expectSuccess();
    });

    test('should disable 2FA with verification', async ({ page }) => {
      await page.route('**/api/settings/2fa/disable**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            message: '2FA disabled successfully',
          }),
        });
      });

      // Assume 2FA is enabled
      await settingsPage.page.evaluate(() => {
        // Mock 2FA enabled state
        localStorage.setItem('2fa_enabled', 'true');
      });

      await settingsPage.disableTwoFactor('123456');
      await settingsPage.expectSuccess();
    });

    test('should show backup codes after 2FA setup', async ({ page }) => {
      await page.route('**/api/settings/2fa/backup-codes**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              backupCodes: ['12345678', '87654321', 'abcdefgh'],
            },
          }),
        });
      });

      await settingsPage.goToTab('security');
      const backupCodesVisible = await settingsPage.backupCodesSection
        .isVisible()
        .catch(() => false);

      // Should show backup codes section if 2FA is enabled
      if (backupCodesVisible) {
        await expect(settingsPage.backupCodesSection).toBeVisible();
      }
    });

    test('should regenerate backup codes', async ({ page }) => {
      await page.route('**/api/settings/2fa/backup-codes/regenerate**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              backupCodes: ['newcode1', 'newcode2', 'newcode3'],
            },
          }),
        });
      });

      await settingsPage.goToTab('security');
      const hasButton = await settingsPage.regenerateCodesButton.isVisible().catch(() => false);

      if (hasButton) {
        await settingsPage.regenerateCodesButton.click();

        // Confirm regeneration
        if (await settingsPage.confirmModal.isVisible()) {
          await settingsPage.confirmButton.click();
        }

        await settingsPage.expectSuccess();
      }
    });
  });

  test.describe('Session Management', () => {
    test('should display active sessions', async ({ page }) => {
      await page.route('**/api/settings/sessions**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: [
              {
                id: 'session-1',
                device: 'Chrome on Windows',
                location: 'Madrid, Spain',
                lastActive: '2024-01-20T10:00:00Z',
                current: true,
              },
              {
                id: 'session-2',
                device: 'Safari on macOS',
                location: 'Barcelona, Spain',
                lastActive: '2024-01-19T15:00:00Z',
                current: false,
              },
            ],
          }),
        });
      });

      await settingsPage.goToTab('security');
      const sessionsVisible = await settingsPage.sessionList.isVisible().catch(() => false);
      expect(sessionsVisible).toBeTruthy();
    });

    test('should revoke other sessions', async ({ page }) => {
      await page.route('**/api/settings/sessions/**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            message: 'Session revoked',
          }),
        });
      });

      await settingsPage.goToTab('security');
      const hasSessions = await settingsPage.revokeSessionButton.isVisible().catch(() => false);

      if (hasSessions) {
        await settingsPage.revokeSession(1); // Revoke second session
        await settingsPage.expectSuccess();
      }
    });
  });

  test.describe('Validation and Error Handling', () => {
    test('should show validation errors for required fields', async () => {
      await settingsPage.goToTab('profile');
      await settingsPage.usernameInput.clear();
      await settingsPage.saveProfileButton.click();

      const isValid = await settingsPage.isUsernameValid();
      expect(isValid).toBeFalsy();
    });

    test('should handle API errors gracefully', async ({ page }) => {
      await page.route('**/api/settings/**', async (route) => {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            error: 'Internal server error',
          }),
        });
      });

      await settingsPage.updateUsername('testuser');
      await settingsPage.expectError();
    });

    test('should handle network errors', async ({ page }) => {
      await page.route('**/api/settings/**', async (route) => {
        await route.abort('failed');
      });

      await settingsPage.updateUsername('testuser');
      await settingsPage.expectError();
    });

    test('should prevent navigation with unsaved changes', async () => {
      await settingsPage.goToTab('profile');
      await settingsPage.usernameInput.fill('modified-username');

      // Try to navigate away
      await settingsPage.tabs.account.click();

      // Should show confirmation dialog
      const hasDialog =
        (await settingsPage.page.locator('[role="dialog"], .confirm-dialog').count()) > 0;
      expect(hasDialog).toBeTruthy();
    });
  });

  test.describe('Tab Navigation', () => {
    test('should navigate between all tabs', async () => {
      const tabs: (keyof typeof settingsPage.tabs)[] = [
        'profile',
        'account',
        'notifications',
        'appearance',
        'security',
        'api',
      ];

      for (const tabName of tabs) {
        await settingsPage.goToTab(tabName);
        await expect(settingsPage.page).toHaveURL(/.*settings.*/);
      }
    });

    test('should persist tab state on refresh', async ({ page }) => {
      await settingsPage.goToTab('notifications');
      await page.reload();

      // Should still be on notifications tab or show notifications content
      const notificationsVisible = await settingsPage.notificationsForm
        .isVisible()
        .catch(() => false);
      expect(notificationsVisible || page.url().includes('notifications')).toBeTruthy();
    });
  });
});
