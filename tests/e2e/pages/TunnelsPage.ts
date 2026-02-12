import { Page, Locator, expect } from '@playwright/test';
import type { Tunnel, IngressRule, TunnelStatus } from '@dockpilot/types';

export class TunnelsPage {
  readonly page: Page;
  readonly url = '/tunnels';

  // Navigation
  readonly tunnelsLink: Locator;

  // List View
  readonly tunnelsList: Locator;
  readonly tunnelCards: Locator;
  readonly emptyState: Locator;

  // Create Tunnel
  readonly createTunnelButton: Locator;
  readonly createTunnelModal: Locator;
  readonly tunnelNameInput: Locator;
  readonly zoneIdInput: Locator;
  readonly submitCreateButton: Locator;
  readonly cancelCreateButton: Locator;

  // Ingress Rules
  readonly ingressRulesSection: Locator;
  readonly addIngressRuleButton: Locator;
  readonly ingressHostnameInput: Locator;
  readonly ingressServiceInput: Locator;
  readonly ingressPortInput: Locator;
  readonly ingressPathInput: Locator;
  readonly saveIngressButton: Locator;
  readonly ingressRulesList: Locator;

  // Tunnel Actions
  readonly startTunnelButton: Locator;
  readonly stopTunnelButton: Locator;
  readonly deleteTunnelButton: Locator;
  readonly viewLogsButton: Locator;
  readonly configureButton: Locator;

  // Logs Modal
  readonly logsModal: Locator;
  readonly logsContent: Locator;
  readonly closeLogsButton: Locator;
  readonly refreshLogsButton: Locator;

  // Status Indicators
  readonly statusBadge: Locator;
  readonly connectionStatus: Locator;
  readonly publicUrlDisplay: Locator;

  // Authentication
  readonly cloudflareAuthButton: Locator;
  readonly authStatusBadge: Locator;

  // Search & Filter
  readonly searchInput: Locator;
  readonly statusFilter: Locator;
  readonly clearFiltersButton: Locator;

  constructor(page: Page) {
    this.page = page;

    // Navigation
    this.tunnelsLink = page.locator('[data-testid="tunnels-nav-link"], a[href="/tunnels"]');

    // List View
    this.tunnelsList = page.locator('[data-testid="tunnels-list"], .tunnels-list');
    this.tunnelCards = page.locator('[data-testid="tunnel-card"], .tunnel-card');
    this.emptyState = page.locator('[data-testid="tunnels-empty"], .tunnels-empty');

    // Create Tunnel
    this.createTunnelButton = page.locator(
      '[data-testid="create-tunnel-btn"], button:has-text("Create Tunnel"), button:has-text("Nuevo Túnel")'
    );
    this.createTunnelModal = page.locator(
      '[data-testid="create-tunnel-modal"], .create-tunnel-modal, [role="dialog"]:has-text("Create Tunnel")'
    );
    this.tunnelNameInput = page.locator(
      '[data-testid="tunnel-name-input"] input, input[name="name"], input[placeholder*="tunnel name" i]'
    );
    this.zoneIdInput = page.locator(
      '[data-testid="zone-id-input"] input, input[name="zoneId"], input[placeholder*="zone" i]'
    );
    this.submitCreateButton = page
      .locator(
        '[data-testid="submit-create-tunnel"], button:has-text("Create"), button[type="submit"]'
      )
      .first();
    this.cancelCreateButton = page.locator(
      '[data-testid="cancel-create-tunnel"], button:has-text("Cancel")'
    );

    // Ingress Rules
    this.ingressRulesSection = page.locator(
      '[data-testid="ingress-rules-section"], .ingress-rules'
    );
    this.addIngressRuleButton = page.locator(
      '[data-testid="add-ingress-rule"], button:has-text("Add Rule"), button:has-text("Agregar Regla")'
    );
    this.ingressHostnameInput = page
      .locator('[data-testid="ingress-hostname-input"] input, input[name="hostname"]')
      .first();
    this.ingressServiceInput = page
      .locator('[data-testid="ingress-service-input"] input, input[name="service"]')
      .first();
    this.ingressPortInput = page
      .locator('[data-testid="ingress-port-input"] input, input[name="port"]')
      .first();
    this.ingressPathInput = page
      .locator('[data-testid="ingress-path-input"] input, input[name="path"]')
      .first();
    this.saveIngressButton = page.locator(
      '[data-testid="save-ingress-rule"], button:has-text("Save Rule"), button:has-text("Guardar")'
    );
    this.ingressRulesList = page.locator('[data-testid="ingress-rules-list"], .ingress-rules-list');

    // Tunnel Actions
    this.startTunnelButton = page
      .locator('[data-testid="start-tunnel"], button:has-text("Start"), button:has-text("Iniciar")')
      .first();
    this.stopTunnelButton = page
      .locator('[data-testid="stop-tunnel"], button:has-text("Stop"), button:has-text("Detener")')
      .first();
    this.deleteTunnelButton = page
      .locator(
        '[data-testid="delete-tunnel"], button:has-text("Delete"), button:has-text("Eliminar")'
      )
      .first();
    this.viewLogsButton = page
      .locator('[data-testid="view-logs"], button:has-text("Logs"), button:has-text("Ver Logs")')
      .first();
    this.configureButton = page
      .locator(
        '[data-testid="configure-tunnel"], button:has-text("Configure"), button:has-text("Configurar")'
      )
      .first();

    // Logs Modal
    this.logsModal = page.locator(
      '[data-testid="logs-modal"], .logs-modal, [role="dialog"]:has-text("Logs")'
    );
    this.logsContent = page.locator('[data-testid="logs-content"], .logs-content, pre');
    this.closeLogsButton = page
      .locator('[data-testid="close-logs"], button:has-text("Close"), button[aria-label="Close"]')
      .first();
    this.refreshLogsButton = page.locator(
      '[data-testid="refresh-logs"], button:has-text("Refresh")'
    );

    // Status Indicators
    this.statusBadge = page
      .locator('[data-testid="tunnel-status"], .tunnel-status, .status-badge')
      .first();
    this.connectionStatus = page
      .locator('[data-testid="connection-status"], .connection-status')
      .first();
    this.publicUrlDisplay = page.locator('[data-testid="public-url"], .public-url').first();

    // Authentication
    this.cloudflareAuthButton = page.locator(
      '[data-testid="cloudflare-auth"], button:has-text("Connect Cloudflare"), button:has-text("Conectar Cloudflare")'
    );
    this.authStatusBadge = page.locator('[data-testid="auth-status"], .auth-status');

    // Search & Filter
    this.searchInput = page
      .locator(
        '[data-testid="search-tunnels"] input, input[placeholder*="search" i], input[placeholder*="buscar" i]'
      )
      .first();
    this.statusFilter = page
      .locator('[data-testid="status-filter"], select[name="status"]')
      .first();
    this.clearFiltersButton = page.locator(
      '[data-testid="clear-filters"], button:has-text("Clear"), button:has-text("Limpiar")'
    );
  }

  // Navigation
  async goto(): Promise<void> {
    await this.page.goto(this.url);
    await this.waitForPageLoad();
  }

  async navigateToTunnels(): Promise<void> {
    await this.tunnelsLink.click();
    await this.waitForPageLoad();
  }

  async waitForPageLoad(): Promise<void> {
    await this.page.waitForURL('**/tunnels');
    await expect(this.tunnelsList.or(this.emptyState)).toBeVisible();
  }

  // List Operations
  async getTunnelCount(): Promise<number> {
    await this.tunnelCards
      .first()
      .waitFor({ state: 'visible', timeout: 5000 })
      .catch(() => {});
    return await this.tunnelCards.count();
  }

  async getTunnelCard(name: string): Promise<Locator> {
    return this.page.locator('[data-testid="tunnel-card"], .tunnel-card').filter({ hasText: name });
  }

  async tunnelExists(name: string): Promise<boolean> {
    const count = await this.page
      .locator('[data-testid="tunnel-card"], .tunnel-card')
      .filter({ hasText: name })
      .count();
    return count > 0;
  }

  async getTunnelStatus(name: string): Promise<string | null> {
    const card = await this.getTunnelCard(name);
    const status = card.locator('[data-testid="tunnel-status"], .tunnel-status, .status-badge');
    return await status.textContent().catch(() => null);
  }

  // Create Tunnel
  async openCreateModal(): Promise<void> {
    await this.createTunnelButton.click();
    await expect(this.createTunnelModal).toBeVisible();
  }

  async fillCreateForm(name: string, zoneId?: string): Promise<void> {
    await this.tunnelNameInput.fill(name);
    if (zoneId) {
      await this.zoneIdInput.fill(zoneId);
    }
  }

  async submitCreate(): Promise<void> {
    await this.submitCreateButton.click();
    await this.createTunnelModal.waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {});
  }

  async cancelCreate(): Promise<void> {
    await this.cancelCreateButton.click();
    await this.createTunnelModal.waitFor({ state: 'hidden', timeout: 5000 });
  }

  async createTunnel(name: string, zoneId?: string): Promise<void> {
    await this.openCreateModal();
    await this.fillCreateForm(name, zoneId);
    await this.submitCreate();
  }

  // Ingress Rules Configuration
  async openIngressConfiguration(tunnelName: string): Promise<void> {
    const card = await this.getTunnelCard(tunnelName);
    await card.locator('[data-testid="configure-tunnel"], button:has-text("Configure")').click();
    await expect(this.ingressRulesSection).toBeVisible();
  }

  async addIngressRule(rule: Partial<IngressRule>): Promise<void> {
    await this.addIngressRuleButton.click();

    if (rule.hostname) {
      await this.ingressHostnameInput.fill(rule.hostname);
    }
    if (rule.service) {
      await this.ingressServiceInput.fill(rule.service);
    }
    if (rule.port) {
      await this.ingressPortInput.fill(rule.port.toString());
    }
    if (rule.path) {
      await this.ingressPathInput.fill(rule.path);
    }

    await this.saveIngressButton.click();
  }

  async getIngressRulesCount(): Promise<number> {
    return await this.ingressRulesList.locator('> *').count();
  }

  // Tunnel Actions
  async startTunnel(name: string): Promise<void> {
    const card = await this.getTunnelCard(name);
    await card
      .locator('[data-testid="start-tunnel"], button:has-text("Start"), button:has-text("Iniciar")')
      .click();
    await this.page.waitForTimeout(1000);
  }

  async stopTunnel(name: string): Promise<void> {
    const card = await this.getTunnelCard(name);
    await card
      .locator('[data-testid="stop-tunnel"], button:has-text("Stop"), button:has-text("Detener")')
      .click();
    await this.page.waitForTimeout(1000);
  }

  async deleteTunnel(name: string, confirm = true): Promise<void> {
    const card = await this.getTunnelCard(name);
    await card
      .locator(
        '[data-testid="delete-tunnel"], button:has-text("Delete"), button:has-text("Eliminar")'
      )
      .click();

    if (confirm) {
      const confirmButton = this.page.locator(
        'button:has-text("Confirm"), button:has-text("Confirmar"), button:has-text("Delete").nth(1)'
      );
      await confirmButton.click();
    }

    await this.page.waitForTimeout(1000);
  }

  // Logs
  async viewLogs(name: string): Promise<void> {
    const card = await this.getTunnelCard(name);
    await card.locator('[data-testid="view-logs"], button:has-text("Logs")').click();
    await expect(this.logsModal).toBeVisible();
  }

  async closeLogs(): Promise<void> {
    await this.closeLogsButton.click();
    await this.logsModal.waitFor({ state: 'hidden', timeout: 5000 });
  }

  async getLogsContent(): Promise<string> {
    return (await this.logsContent.textContent()) || '';
  }

  async refreshLogs(): Promise<void> {
    await this.refreshLogsButton.click();
    await this.page.waitForTimeout(500);
  }

  // Status & Connection
  async getStatusText(): Promise<string | null> {
    return await this.statusBadge.textContent();
  }

  async isConnected(): Promise<boolean> {
    const status = await this.getStatusText();
    return (
      status?.toLowerCase().includes('connected') || status?.toLowerCase() === 'active' || false
    );
  }

  async getPublicUrl(): Promise<string | null> {
    return await this.publicUrlDisplay.textContent();
  }

  // Cloudflare Authentication
  async connectCloudflare(): Promise<void> {
    await this.cloudflareAuthButton.click();
  }

  async isAuthenticated(): Promise<boolean> {
    const count = await this.authStatusBadge.count();
    if (count === 0) return false;
    const text = await this.authStatusBadge.textContent();
    return (
      text?.toLowerCase().includes('connected') ||
      text?.toLowerCase().includes('authenticated') ||
      false
    );
  }

  // Search & Filter
  async searchTunnels(query: string): Promise<void> {
    await this.searchInput.fill(query);
    await this.page.waitForTimeout(500);
  }

  async filterByStatus(status: TunnelStatus | 'all'): Promise<void> {
    await this.statusFilter.selectOption(status);
    await this.page.waitForTimeout(500);
  }

  async clearFilters(): Promise<void> {
    await this.clearFiltersButton.click();
    await this.page.waitForTimeout(500);
  }

  // Utilities
  async waitForTunnelStatus(
    name: string,
    expectedStatus: TunnelStatus,
    timeout = 10000
  ): Promise<void> {
    const card = await this.getTunnelCard(name);
    const statusLocator = card.locator(
      '[data-testid="tunnel-status"], .tunnel-status, .status-badge'
    );
    await expect(statusLocator).toHaveText(new RegExp(expectedStatus, 'i'), { timeout });
  }

  async expectSuccessMessage(): Promise<void> {
    const successToast = this.page.locator(
      '[data-testid="success-message"], .toast-success, [role="alert"]:has-text("success")'
    );
    await expect(successToast).toBeVisible({ timeout: 10000 });
  }

  async expectErrorMessage(): Promise<void> {
    const errorToast = this.page.locator(
      '[data-testid="error-message"], .toast-error, [role="alert"]:has-text("error")'
    );
    await expect(errorToast).toBeVisible({ timeout: 10000 });
  }

  // Mock API Helpers
  async mockCloudflareApiResponse(route: string, response: object): Promise<void> {
    await this.page.route(route, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(response),
      });
    });
  }

  async mockCloudflareApiError(route: string, statusCode: number, message: string): Promise<void> {
    await this.page.route(route, async (route) => {
      await route.fulfill({
        status: statusCode,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          errors: [{ code: statusCode, message }],
          messages: [],
          result: null,
        }),
      });
    });
  }
}
