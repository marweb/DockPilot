import { Page, Locator, expect } from '@playwright/test';

export interface UserSettings {
  username: string;
  email: string;
  language: string;
  theme: 'light' | 'dark' | 'system';
}

export interface NotificationSettings {
  emailEnabled: boolean;
  pushEnabled: boolean;
  containerAlerts: boolean;
  tunnelAlerts: boolean;
  securityAlerts: boolean;
}

export class SettingsPage {
  readonly page: Page;
  readonly url = '/settings';

  // Navigation
  readonly settingsLink: Locator;
  readonly tabs: {
    profile: Locator;
    account: Locator;
    notifications: Locator;
    security: Locator;
    api: Locator;
    appearance: Locator;
  };

  // Profile Section
  readonly profileForm: Locator;
  readonly usernameInput: Locator;
  readonly displayNameInput: Locator;
  readonly bioInput: Locator;
  readonly avatarUpload: Locator;
  readonly saveProfileButton: Locator;

  // Account Section
  readonly accountForm: Locator;
  readonly emailInput: Locator;
  readonly currentPasswordInput: Locator;
  readonly newPasswordInput: Locator;
  readonly confirmPasswordInput: Locator;
  readonly changePasswordButton: Locator;
  readonly saveAccountButton: Locator;

  // Notifications Section
  readonly notificationsForm: Locator;
  readonly emailNotificationsToggle: Locator;
  readonly pushNotificationsToggle: Locator;
  readonly containerAlertsToggle: Locator;
  readonly tunnelAlertsToggle: Locator;
  readonly securityAlertsToggle: Locator;
  readonly saveNotificationsButton: Locator;

  // Appearance Section
  readonly appearanceForm: Locator;
  readonly themeSelect: Locator;
  readonly languageSelect: Locator;
  readonly compactModeToggle: Locator;
  readonly saveAppearanceButton: Locator;

  // Security Section
  readonly securityForm: Locator;
  readonly twoFactorToggle: Locator;
  readonly setup2FAButton: Locator;
  readonly backupCodesSection: Locator;
  readonly regenerateCodesButton: Locator;
  readonly sessionList: Locator;
  readonly revokeSessionButton: Locator;

  // API Keys Section
  readonly apiKeysSection: Locator;
  readonly createApiKeyButton: Locator;
  readonly apiKeyNameInput: Locator;
  readonly apiKeyPermissionsSelect: Locator;
  readonly generateKeyButton: Locator;
  readonly apiKeysList: Locator;
  readonly revokeKeyButton: Locator;

  // Messages
  readonly successMessage: Locator;
  readonly errorMessage: Locator;
  readonly validationErrors: Locator;

  // Modals
  readonly confirmModal: Locator;
  readonly confirmButton: Locator;
  readonly cancelButton: Locator;
  readonly twoFactorModal: Locator;
  readonly twoFactorCodeInput: Locator;
  readonly verify2FAButton: Locator;

  constructor(page: Page) {
    this.page = page;

    // Navigation
    this.settingsLink = page.locator('[data-testid="settings-nav-link"], a[href="/settings"]');
    this.tabs = {
      profile: page.locator(
        '[data-testid="tab-profile"], button:has-text("Profile"), button:has-text("Perfil")'
      ),
      account: page.locator(
        '[data-testid="tab-account"], button:has-text("Account"), button:has-text("Cuenta")'
      ),
      notifications: page.locator(
        '[data-testid="tab-notifications"], button:has-text("Notifications"), button:has-text("Notificaciones")'
      ),
      security: page.locator(
        '[data-testid="tab-security"], button:has-text("Security"), button:has-text("Seguridad")'
      ),
      api: page.locator(
        '[data-testid="tab-api"], button:has-text("API"), button:has-text("API Keys")'
      ),
      appearance: page.locator(
        '[data-testid="tab-appearance"], button:has-text("Appearance"), button:has-text("Apariencia")'
      ),
    };

    // Profile Section
    this.profileForm = page
      .locator('[data-testid="profile-form"], form:has(input[name="username"])')
      .first();
    this.usernameInput = page
      .locator('[data-testid="username-input"] input, input[name="username"]')
      .first();
    this.displayNameInput = page
      .locator('[data-testid="display-name-input"] input, input[name="displayName"]')
      .first();
    this.bioInput = page
      .locator('[data-testid="bio-input"] textarea, textarea[name="bio"]')
      .first();
    this.avatarUpload = page
      .locator(
        '[data-testid="avatar-upload"] input[type="file"], input[type="file"][accept*="image"]'
      )
      .first();
    this.saveProfileButton = page
      .locator(
        '[data-testid="save-profile"], button:has-text("Save Profile"), button:has-text("Guardar Perfil")'
      )
      .first();

    // Account Section
    this.accountForm = page
      .locator('[data-testid="account-form"], form:has(input[type="email"])')
      .first();
    this.emailInput = page
      .locator('[data-testid="email-input"] input, input[type="email"], input[name="email"]')
      .first();
    this.currentPasswordInput = page
      .locator('[data-testid="current-password-input"] input, input[name="currentPassword"]')
      .first();
    this.newPasswordInput = page
      .locator(
        '[data-testid="new-password-input"] input, input[name="newPassword"], input[placeholder*="new password" i]'
      )
      .first();
    this.confirmPasswordInput = page
      .locator(
        '[data-testid="confirm-password-input"] input, input[name="confirmPassword"], input[placeholder*="confirm" i]'
      )
      .first();
    this.changePasswordButton = page
      .locator(
        '[data-testid="change-password"], button:has-text("Change Password"), button:has-text("Cambiar Contraseña")'
      )
      .first();
    this.saveAccountButton = page
      .locator(
        '[data-testid="save-account"], button:has-text("Save Changes"), button:has-text("Guardar Cambios")'
      )
      .first();

    // Notifications Section
    this.notificationsForm = page
      .locator('[data-testid="notifications-form"], form:has(input[type="checkbox"])')
      .first();
    this.emailNotificationsToggle = page
      .locator('[data-testid="email-notifications-toggle"], input[name="emailEnabled"]')
      .first();
    this.pushNotificationsToggle = page
      .locator('[data-testid="push-notifications-toggle"], input[name="pushEnabled"]')
      .first();
    this.containerAlertsToggle = page
      .locator('[data-testid="container-alerts-toggle"], input[name="containerAlerts"]')
      .first();
    this.tunnelAlertsToggle = page
      .locator('[data-testid="tunnel-alerts-toggle"], input[name="tunnelAlerts"]')
      .first();
    this.securityAlertsToggle = page
      .locator('[data-testid="security-alerts-toggle"], input[name="securityAlerts"]')
      .first();
    this.saveNotificationsButton = page
      .locator(
        '[data-testid="save-notifications"], button:has-text("Save Notifications"), button:has-text("Guardar Notificaciones")'
      )
      .first();

    // Appearance Section
    this.appearanceForm = page.locator('[data-testid="appearance-form"]').first();
    this.themeSelect = page.locator('[data-testid="theme-select"], select[name="theme"]').first();
    this.languageSelect = page
      .locator('[data-testid="language-select"], select[name="language"]')
      .first();
    this.compactModeToggle = page
      .locator('[data-testid="compact-mode-toggle"], input[name="compactMode"]')
      .first();
    this.saveAppearanceButton = page
      .locator(
        '[data-testid="save-appearance"], button:has-text("Save Appearance"), button:has-text("Guardar Apariencia")'
      )
      .first();

    // Security Section
    this.securityForm = page.locator('[data-testid="security-form"]').first();
    this.twoFactorToggle = page
      .locator('[data-testid="2fa-toggle"], input[name="twoFactorEnabled"]')
      .first();
    this.setup2FAButton = page
      .locator(
        '[data-testid="setup-2fa"], button:has-text("Enable 2FA"), button:has-text("Activar 2FA")'
      )
      .first();
    this.backupCodesSection = page.locator('[data-testid="backup-codes"], .backup-codes').first();
    this.regenerateCodesButton = page
      .locator(
        '[data-testid="regenerate-codes"], button:has-text("Regenerate Codes"), button:has-text("Regenerar Códigos")'
      )
      .first();
    this.sessionList = page.locator('[data-testid="session-list"], .session-list').first();
    this.revokeSessionButton = page
      .locator(
        '[data-testid="revoke-session"], button:has-text("Revoke"), button:has-text("Revocar")'
      )
      .first();

    // API Keys Section
    this.apiKeysSection = page.locator('[data-testid="api-keys-section"]').first();
    this.createApiKeyButton = page
      .locator(
        '[data-testid="create-api-key"], button:has-text("Create API Key"), button:has-text("Crear API Key")'
      )
      .first();
    this.apiKeyNameInput = page
      .locator('[data-testid="api-key-name-input"] input, input[name="keyName"]')
      .first();
    this.apiKeyPermissionsSelect = page
      .locator('[data-testid="api-key-permissions"] select, select[name="permissions"]')
      .first();
    this.generateKeyButton = page
      .locator(
        '[data-testid="generate-key"], button:has-text("Generate"), button:has-text("Generar")'
      )
      .first();
    this.apiKeysList = page.locator('[data-testid="api-keys-list"], .api-keys-list').first();
    this.revokeKeyButton = page
      .locator('[data-testid="revoke-key"], button:has-text("Revoke"), button:has-text("Revocar")')
      .first();

    // Messages
    this.successMessage = page
      .locator('[data-testid="success-message"], .toast-success, [role="status"]')
      .first();
    this.errorMessage = page
      .locator('[data-testid="error-message"], .toast-error, [role="alert"]')
      .first();
    this.validationErrors = page
      .locator('.field-error, .validation-error, [data-testid="field-error"]')
      .first();

    // Modals
    this.confirmModal = page
      .locator('[role="dialog"], .modal, [data-testid="confirm-modal"]')
      .first();
    this.confirmButton = page
      .locator(
        '[data-testid="confirm-btn"], button:has-text("Confirm"), button:has-text("Confirmar"), button:has-text("Yes")'
      )
      .first();
    this.cancelButton = page
      .locator(
        '[data-testid="cancel-btn"], button:has-text("Cancel"), button:has-text("Cancelar"), button:has-text("No")'
      )
      .first();
    this.twoFactorModal = page
      .locator('[data-testid="2fa-modal"], [role="dialog"]:has-text("Two-Factor")')
      .first();
    this.twoFactorCodeInput = page
      .locator(
        '[data-testid="2fa-code-input"] input, input[name="code"], input[placeholder*="code" i]'
      )
      .first();
    this.verify2FAButton = page
      .locator(
        '[data-testid="verify-2fa"], button:has-text("Verify"), button:has-text("Verificar")'
      )
      .first();
  }

  // Navigation
  async goto(): Promise<void> {
    await this.page.goto(this.url);
    await this.waitForPageLoad();
  }

  async navigateToSettings(): Promise<void> {
    await this.settingsLink.click();
    await this.waitForPageLoad();
  }

  async waitForPageLoad(): Promise<void> {
    await this.page.waitForURL('**/settings');
    await expect(this.profileForm.or(this.accountForm)).toBeVisible({ timeout: 10000 });
  }

  // Tab Navigation
  async goToTab(tabName: keyof typeof this.tabs): Promise<void> {
    await this.tabs[tabName].click();
    await this.page.waitForTimeout(500);
  }

  // Profile Operations
  async updateUsername(username: string): Promise<void> {
    await this.goToTab('profile');
    await this.usernameInput.clear();
    await this.usernameInput.fill(username);
    await this.saveProfileButton.click();
  }

  async updateDisplayName(displayName: string): Promise<void> {
    await this.goToTab('profile');
    await this.displayNameInput.clear();
    await this.displayNameInput.fill(displayName);
    await this.saveProfileButton.click();
  }

  async updateBio(bio: string): Promise<void> {
    await this.goToTab('profile');
    await this.bioInput.clear();
    await this.bioInput.fill(bio);
    await this.saveProfileButton.click();
  }

  // Account Operations
  async updateEmail(email: string, password?: string): Promise<void> {
    await this.goToTab('account');
    await this.emailInput.clear();
    await this.emailInput.fill(email);
    if (password) {
      await this.currentPasswordInput.fill(password);
    }
    await this.saveAccountButton.click();
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    await this.goToTab('account');
    await this.currentPasswordInput.fill(currentPassword);
    await this.newPasswordInput.fill(newPassword);
    await this.confirmPasswordInput.fill(newPassword);
    await this.changePasswordButton.click();
  }

  // Notification Operations
  async toggleEmailNotifications(enabled: boolean): Promise<void> {
    await this.goToTab('notifications');
    const isChecked = await this.emailNotificationsToggle.isChecked();
    if (isChecked !== enabled) {
      await this.emailNotificationsToggle.click();
    }
    await this.saveNotificationsButton.click();
  }

  async togglePushNotifications(enabled: boolean): Promise<void> {
    await this.goToTab('notifications');
    const isChecked = await this.pushNotificationsToggle.isChecked();
    if (isChecked !== enabled) {
      await this.pushNotificationsToggle.click();
    }
    await this.saveNotificationsButton.click();
  }

  async toggleContainerAlerts(enabled: boolean): Promise<void> {
    await this.goToTab('notifications');
    const isChecked = await this.containerAlertsToggle.isChecked();
    if (isChecked !== enabled) {
      await this.containerAlertsToggle.click();
    }
    await this.saveNotificationsButton.click();
  }

  async toggleTunnelAlerts(enabled: boolean): Promise<void> {
    await this.goToTab('notifications');
    const isChecked = await this.tunnelAlertsToggle.isChecked();
    if (isChecked !== enabled) {
      await this.tunnelAlertsToggle.click();
    }
    await this.saveNotificationsButton.click();
  }

  async toggleSecurityAlerts(enabled: boolean): Promise<void> {
    await this.goToTab('notifications');
    const isChecked = await this.securityAlertsToggle.isChecked();
    if (isChecked !== enabled) {
      await this.securityAlertsToggle.click();
    }
    await this.saveNotificationsButton.click();
  }

  // Appearance Operations
  async setTheme(theme: 'light' | 'dark' | 'system'): Promise<void> {
    await this.goToTab('appearance');
    await this.themeSelect.selectOption(theme);
    await this.saveAppearanceButton.click();
  }

  async setLanguage(language: string): Promise<void> {
    await this.goToTab('appearance');
    await this.languageSelect.selectOption(language);
    await this.saveAppearanceButton.click();
  }

  async toggleCompactMode(enabled: boolean): Promise<void> {
    await this.goToTab('appearance');
    const isChecked = await this.compactModeToggle.isChecked();
    if (isChecked !== enabled) {
      await this.compactModeToggle.click();
    }
    await this.saveAppearanceButton.click();
  }

  // Security Operations
  async enableTwoFactor(): Promise<void> {
    await this.goToTab('security');
    const isEnabled = await this.twoFactorToggle.isChecked();
    if (!isEnabled) {
      await this.twoFactorToggle.click();
      await this.setup2FAButton.click();
    }
  }

  async disableTwoFactor(code: string): Promise<void> {
    await this.goToTab('security');
    const isEnabled = await this.twoFactorToggle.isChecked();
    if (isEnabled) {
      await this.twoFactorToggle.click();
      if (await this.twoFactorModal.isVisible()) {
        await this.twoFactorCodeInput.fill(code);
        await this.verify2FAButton.click();
      }
    }
  }

  async enterTwoFactorCode(code: string): Promise<void> {
    await this.twoFactorCodeInput.fill(code);
    await this.verify2FAButton.click();
  }

  async revokeSession(sessionIndex = 0): Promise<void> {
    await this.goToTab('security');
    const sessions = this.sessionList.locator('> *');
    const session = sessions.nth(sessionIndex);
    await session.locator('button:has-text("Revoke")').click();
    if (await this.confirmModal.isVisible()) {
      await this.confirmButton.click();
    }
  }

  // API Key Operations
  async createApiKey(name: string, permissions: string): Promise<string | null> {
    await this.goToTab('api');
    await this.createApiKeyButton.click();
    await this.apiKeyNameInput.fill(name);
    await this.apiKeyPermissionsSelect.selectOption(permissions);
    await this.generateKeyButton.click();

    // Wait for the key to be displayed (usually in a modal)
    const keyModal = this.page.locator(
      '[data-testid="api-key-display"], [role="dialog"]:has-text("API Key")'
    );
    if (await keyModal.isVisible()) {
      const keyText = await keyModal.locator('code, pre').textContent();
      await keyModal.locator('button:has-text("Close"), button:has-text("Done")').click();
      return keyText;
    }
    return null;
  }

  async revokeApiKey(name: string): Promise<void> {
    await this.goToTab('api');
    const keyRow = this.apiKeysList.locator('> *').filter({ hasText: name });
    await keyRow.locator('[data-testid="revoke-key"], button:has-text("Revoke")').click();
    if (await this.confirmModal.isVisible()) {
      await this.confirmButton.click();
    }
  }

  async getApiKeysCount(): Promise<number> {
    await this.goToTab('api');
    return await this.apiKeysList.locator('> *').count();
  }

  // Validation Helpers
  async expectFieldError(fieldName: string): Promise<void> {
    const error = this.page.locator(
      `[data-testid="${fieldName}-error"], .field-error:has-text("${fieldName}")`
    );
    await expect(error).toBeVisible();
  }

  async expectSuccess(): Promise<void> {
    await expect(this.successMessage).toBeVisible({ timeout: 10000 });
  }

  async expectError(): Promise<void> {
    await expect(this.errorMessage).toBeVisible({ timeout: 10000 });
  }

  // Form Validation
  async isUsernameValid(): Promise<boolean> {
    const hasError = (await this.page.locator('[data-testid="username-error"]').count()) > 0;
    return !hasError;
  }

  async isEmailValid(): Promise<boolean> {
    const hasError = (await this.page.locator('[data-testid="email-error"]').count()) > 0;
    return !hasError;
  }

  async isPasswordValid(): Promise<boolean> {
    const hasError = (await this.page.locator('[data-testid="password-error"]').count()) > 0;
    return !hasError;
  }

  async doPasswordsMatch(): Promise<boolean> {
    const newPass = await this.newPasswordInput.inputValue();
    const confirmPass = await this.confirmPasswordInput.inputValue();
    return newPass === confirmPass;
  }

  // Utility Methods
  async clearForm(): Promise<void> {
    await this.usernameInput.clear();
    await this.emailInput.clear();
    await this.currentPasswordInput.clear();
    await this.newPasswordInput.clear();
    await this.confirmPasswordInput.clear();
  }

  async getCurrentUsername(): Promise<string> {
    return await this.usernameInput.inputValue();
  }

  async getCurrentEmail(): Promise<string> {
    return await this.emailInput.inputValue();
  }

  async getCurrentTheme(): Promise<string> {
    return await this.themeSelect.inputValue();
  }

  async getCurrentLanguage(): Promise<string> {
    return await this.languageSelect.inputValue();
  }

  // Mock API Helpers
  async mockSettingsApiResponse(data: object): Promise<void> {
    await this.page.route('**/api/settings/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data }),
      });
    });
  }

  async mockSettingsApiError(statusCode: number, message: string): Promise<void> {
    await this.page.route('**/api/settings/**', async (route) => {
      await route.fulfill({
        status: statusCode,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, error: message }),
      });
    });
  }
}
