import { expect, type Locator, type Page } from '@playwright/test';

export class ContainerDetailPage {
  readonly page: Page;
  readonly containerId: string;
  readonly url: string;

  // Header elements
  readonly containerName: Locator;
  readonly containerStatus: Locator;
  readonly backButton: Locator;
  readonly actionButtons: {
    start: Locator;
    stop: Locator;
    restart: Locator;
    delete: Locator;
  };

  // Tabs
  readonly tabs: {
    overview: Locator;
    logs: Locator;
    exec: Locator;
    stats: Locator;
  };
  readonly activeTab: Locator;

  // Overview tab
  readonly overviewSection: {
    container: Locator;
    image: Locator;
    command: Locator;
    created: Locator;
    ports: Locator;
    networks: Locator;
    volumes: Locator;
    environment: Locator;
    labels: Locator;
  };

  // Logs tab
  readonly logsSection: {
    container: Locator;
    logOutput: Locator;
    followToggle: Locator;
    timestampsToggle: Locator;
    clearButton: Locator;
    downloadButton: Locator;
    linesInput: Locator;
    searchInput: Locator;
    autoScrollToggle: Locator;
  };

  // Exec tab
  readonly execSection: {
    container: Locator;
    commandInput: Locator;
    executeButton: Locator;
    terminal: Locator;
    terminalOutput: Locator;
    clearTerminalButton: Locator;
    workingDirInput: Locator;
    userInput: Locator;
  };

  // Stats tab
  readonly statsSection: {
    container: Locator;
    cpuChart: Locator;
    memoryChart: Locator;
    networkChart: Locator;
    ioChart: Locator;
    cpuUsage: Locator;
    memoryUsage: Locator;
    networkIn: Locator;
    networkOut: Locator;
    refreshInterval: Locator;
    pauseButton: Locator;
  };

  constructor(page: Page, containerId?: string) {
    this.page = page;
    this.containerId = containerId || '';
    this.url = containerId ? `/containers/${containerId}` : '/containers';

    // Header elements
    this.containerName = page.locator('h1, [data-testid="container-name"]').first();
    this.containerStatus = page.locator('[data-testid="container-status"], .status-badge').first();
    this.backButton = page
      .locator('button:has-text("Back"), a:has-text("Back"), button[aria-label="Back"]')
      .first();
    this.actionButtons = {
      start: page.locator('button:has-text("Start"), button[aria-label="Start container"]').first(),
      stop: page.locator('button:has-text("Stop"), button[aria-label="Stop container"]').first(),
      restart: page
        .locator('button:has-text("Restart"), button[aria-label="Restart container"]')
        .first(),
      delete: page
        .locator('button:has-text("Delete"), button[aria-label="Delete container"]')
        .first(),
    };

    // Tabs
    const tabList = page.locator('[role="tablist"], .tabs').first();
    this.tabs = {
      overview: tabList
        .locator('button:has-text("Overview"), [role="tab"]:has-text("Overview")')
        .first(),
      logs: tabList.locator('button:has-text("Logs"), [role="tab"]:has-text("Logs")').first(),
      exec: tabList.locator('button:has-text("Exec"), [role="tab"]:has-text("Exec")').first(),
      stats: tabList.locator('button:has-text("Stats"), [role="tab"]:has-text("Stats")').first(),
    };
    this.activeTab = page.locator('[role="tab"][aria-selected="true"], .tab-active').first();

    // Overview tab
    this.overviewSection = {
      container: page
        .locator('[data-testid="overview-tab"], #overview, [role="tabpanel"]:has-text("Image")')
        .first(),
      image: page.locator('[data-testid="container-image"], dt:has-text("Image") + dd').first(),
      command: page
        .locator('[data-testid="container-command"], dt:has-text("Command") + dd')
        .first(),
      created: page
        .locator('[data-testid="container-created"], dt:has-text("Created") + dd')
        .first(),
      ports: page.locator('[data-testid="container-ports"], dt:has-text("Ports") + dd').first(),
      networks: page
        .locator('[data-testid="container-networks"], dt:has-text("Networks") + dd')
        .first(),
      volumes: page
        .locator('[data-testid="container-volumes"], dt:has-text("Volumes") + dd')
        .first(),
      environment: page
        .locator('[data-testid="container-env"], dt:has-text("Environment") + dd')
        .first(),
      labels: page.locator('[data-testid="container-labels"], dt:has-text("Labels") + dd').first(),
    };

    // Logs tab
    this.logsSection = {
      container: page.locator('[data-testid="logs-tab"], #logs').first(),
      logOutput: page.locator('[data-testid="log-output"], .log-output, pre').first(),
      followToggle: page.locator('button[aria-label*="follow" i], input[name="follow"]').first(),
      timestampsToggle: page
        .locator('button[aria-label*="timestamp" i], input[name="timestamps"]')
        .first(),
      clearButton: page
        .locator('button:has-text("Clear"), button[aria-label="Clear logs"]')
        .first(),
      downloadButton: page
        .locator('button:has-text("Download"), button[aria-label="Download logs"]')
        .first(),
      linesInput: page.locator('input[name="lines"], input[placeholder*="lines" i]').first(),
      searchInput: page.locator('input[placeholder*="search" i], input[name="search"]').first(),
      autoScrollToggle: page
        .locator('input[name="autoScroll"], button[aria-label*="auto scroll" i]')
        .first(),
    };

    // Exec tab
    this.execSection = {
      container: page.locator('[data-testid="exec-tab"], #exec').first(),
      commandInput: page
        .locator('input[name="command"], textarea[name="command"], [data-testid="exec-command"]')
        .first(),
      executeButton: page.locator('button:has-text("Execute"), button[type="submit"]').first(),
      terminal: page.locator('[data-testid="terminal"], .terminal, .xterm').first(),
      terminalOutput: page
        .locator('[data-testid="terminal-output"], .terminal-output, .xterm-screen')
        .first(),
      clearTerminalButton: page
        .locator('button:has-text("Clear"), button[aria-label="Clear terminal"]')
        .first(),
      workingDirInput: page
        .locator('input[name="workingDir"], input[placeholder*="working directory" i]')
        .first(),
      userInput: page.locator('input[name="user"], input[placeholder*="user" i]').first(),
    };

    // Stats tab
    this.statsSection = {
      container: page.locator('[data-testid="stats-tab"], #stats').first(),
      cpuChart: page.locator('[data-testid="cpu-chart"], canvas[data-metric="cpu"]').first(),
      memoryChart: page
        .locator('[data-testid="memory-chart"], canvas[data-metric="memory"]')
        .first(),
      networkChart: page
        .locator('[data-testid="network-chart"], canvas[data-metric="network"]')
        .first(),
      ioChart: page.locator('[data-testid="io-chart"], canvas[data-metric="io"]').first(),
      cpuUsage: page.locator('[data-testid="cpu-usage"], .cpu-usage').first(),
      memoryUsage: page.locator('[data-testid="memory-usage"], .memory-usage').first(),
      networkIn: page.locator('[data-testid="network-in"], .network-in').first(),
      networkOut: page.locator('[data-testid="network-out"], .network-out').first(),
      refreshInterval: page.locator('select[name="refreshInterval"]').first(),
      pauseButton: page
        .locator('button:has-text("Pause"), button[aria-label="Pause updates"]')
        .first(),
    };
  }

  /**
   * Navigate to container detail page
   */
  async goto(): Promise<void> {
    await this.page.goto(this.url);
    await this.waitForLoad();
  }

  /**
   * Wait for page to load
   */
  async waitForLoad(): Promise<void> {
    await expect(this.containerName).toBeVisible({ timeout: 10000 });
  }

  /**
   * Get container name
   */
  async getContainerName(): Promise<string> {
    return (await this.containerName.textContent()) || '';
  }

  /**
   * Get container status
   */
  async getContainerStatus(): Promise<string> {
    return (await this.containerStatus.textContent()) || '';
  }

  /**
   * Navigate back to containers list
   */
  async goBack(): Promise<void> {
    await this.backButton.click();
    await this.page.waitForURL('/containers', { timeout: 10000 });
  }

  /**
   * Start the container
   */
  async startContainer(): Promise<void> {
    await this.actionButtons.start.click();
    await this.page.waitForTimeout(1000);
  }

  /**
   * Stop the container
   */
  async stopContainer(): Promise<void> {
    await this.actionButtons.stop.click();
    await this.page.waitForTimeout(1000);
  }

  /**
   * Restart the container
   */
  async restartContainer(): Promise<void> {
    await this.actionButtons.restart.click();
    await this.page.waitForTimeout(2000);
  }

  /**
   * Delete the container
   */
  async deleteContainer(confirm = true): Promise<void> {
    await this.actionButtons.delete.click();

    // Handle confirmation modal
    const modal = this.page.locator('[role="dialog"], .modal').first();
    await expect(modal).toBeVisible({ timeout: 5000 });

    if (confirm) {
      const confirmButton = modal
        .locator('button:has-text("Confirm"), button:has-text("Delete")')
        .first();
      await confirmButton.click();
      await this.page.waitForURL('/containers', { timeout: 10000 });
    } else {
      const cancelButton = modal.locator('button:has-text("Cancel")').first();
      await cancelButton.click();
    }
  }

  /**
   * Switch to Overview tab
   */
  async switchToOverview(): Promise<void> {
    await this.tabs.overview.click();
    await expect(this.overviewSection.container).toBeVisible({ timeout: 5000 });
  }

  /**
   * Switch to Logs tab
   */
  async switchToLogs(): Promise<void> {
    await this.tabs.logs.click();
    await expect(this.logsSection.container).toBeVisible({ timeout: 5000 });
  }

  /**
   * Switch to Exec tab
   */
  async switchToExec(): Promise<void> {
    await this.tabs.exec.click();
    await expect(this.execSection.container).toBeVisible({ timeout: 5000 });
  }

  /**
   * Switch to Stats tab
   */
  async switchToStats(): Promise<void> {
    await this.tabs.stats.click();
    await expect(this.statsSection.container).toBeVisible({ timeout: 5000 });
  }

  /**
   * Get overview information
   */
  async getOverviewInfo(): Promise<{
    image: string;
    command: string;
    created: string;
    ports: string;
  }> {
    await this.switchToOverview();
    return {
      image: (await this.overviewSection.image.textContent()) || '',
      command: (await this.overviewSection.command.textContent()) || '',
      created: (await this.overviewSection.created.textContent()) || '',
      ports: (await this.overviewSection.ports.textContent()) || '',
    };
  }

  /**
   * Get logs content
   */
  async getLogs(options?: {
    lines?: number;
    follow?: boolean;
    timestamps?: boolean;
  }): Promise<string> {
    await this.switchToLogs();

    if (options?.lines) {
      await this.logsSection.linesInput.fill(options.lines.toString());
    }

    if (options?.timestamps !== undefined) {
      const isChecked = await this.logsSection.timestampsToggle.isChecked().catch(() => false);
      if (isChecked !== options.timestamps) {
        await this.logsSection.timestampsToggle.click();
      }
    }

    // Wait for logs to load
    await this.page.waitForTimeout(1000);

    return (await this.logsSection.logOutput.textContent()) || '';
  }

  /**
   * Stream logs via WebSocket
   */
  async streamLogs(duration = 3000): Promise<string[]> {
    await this.switchToLogs();

    // Enable follow mode
    const isChecked = await this.logsSection.followToggle.isChecked().catch(() => false);
    if (!isChecked) {
      await this.logsSection.followToggle.click();
    }

    const logs: string[] = [];
    const startTime = Date.now();

    // Collect logs for specified duration
    while (Date.now() - startTime < duration) {
      const content = await this.logsSection.logOutput.textContent();
      if (content) {
        const lines = content.split('\n').filter((line) => line.trim());
        logs.push(...lines);
      }
      await this.page.waitForTimeout(500);
    }

    return [...new Set(logs)]; // Remove duplicates
  }

  /**
   * Clear logs display
   */
  async clearLogs(): Promise<void> {
    await this.switchToLogs();
    await this.logsSection.clearButton.click();
    await this.page.waitForTimeout(500);
  }

  /**
   * Download logs
   */
  async downloadLogs(): Promise<void> {
    await this.switchToLogs();

    // Start waiting for download before clicking
    const downloadPromise = this.page.waitForEvent('download');
    await this.logsSection.downloadButton.click();

    const download = await downloadPromise;
    await download.saveAs(`/tmp/${download.suggestedFilename()}`);
  }

  /**
   * Execute command in container
   */
  async executeCommand(
    command: string,
    options?: {
      workingDir?: string;
      user?: string;
    }
  ): Promise<string> {
    await this.switchToExec();

    await this.execSection.commandInput.fill(command);

    if (options?.workingDir) {
      await this.execSection.workingDirInput.fill(options.workingDir);
    }

    if (options?.user) {
      await this.execSection.userInput.fill(options.user);
    }

    await this.execSection.executeButton.click();

    // Wait for command execution
    await this.page.waitForTimeout(2000);

    return (await this.execSection.terminalOutput.textContent()) || '';
  }

  /**
   * Get terminal content
   */
  async getTerminalContent(): Promise<string> {
    await this.switchToExec();
    return (await this.execSection.terminalOutput.textContent()) || '';
  }

  /**
   * Clear terminal
   */
  async clearTerminal(): Promise<void> {
    await this.switchToExec();
    await this.execSection.clearTerminalButton.click();
    await this.page.waitForTimeout(500);
  }

  /**
   * Get stats data
   */
  async getStats(): Promise<{
    cpu: string;
    memory: string;
    networkIn: string;
    networkOut: string;
  }> {
    await this.switchToStats();

    // Wait for stats to load
    await this.page.waitForTimeout(2000);

    return {
      cpu: (await this.statsSection.cpuUsage.textContent()) || '',
      memory: (await this.statsSection.memoryUsage.textContent()) || '',
      networkIn: (await this.statsSection.networkIn.textContent()) || '',
      networkOut: (await this.statsSection.networkOut.textContent()) || '',
    };
  }

  /**
   * Wait for stats to be available
   */
  async waitForStats(timeout = 10000): Promise<void> {
    await this.switchToStats();

    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      const cpuText = await this.statsSection.cpuUsage.textContent();
      if (cpuText && cpuText.includes('%')) {
        return;
      }
      await this.page.waitForTimeout(500);
    }

    throw new Error('Stats not available within timeout');
  }

  /**
   * Set refresh interval for stats
   */
  async setRefreshInterval(interval: '1s' | '5s' | '10s' | '30s' | 'off'): Promise<void> {
    await this.switchToStats();
    await this.statsSection.refreshInterval.selectOption(interval);
  }

  /**
   * Pause/resume stats updates
   */
  async toggleStatsPause(): Promise<void> {
    await this.switchToStats();
    await this.statsSection.pauseButton.click();
  }

  /**
   * Wait for container to reach specific status
   */
  async waitForStatus(status: 'running' | 'stopped' | 'exited', timeout = 30000): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const currentStatus = await this.getContainerStatus();
      if (currentStatus.toLowerCase().includes(status)) {
        return;
      }
      await this.page.waitForTimeout(1000);
    }

    throw new Error(`Container did not reach status "${status}" within timeout`);
  }

  /**
   * Check if action button is available
   */
  async isActionAvailable(action: 'start' | 'stop' | 'restart' | 'delete'): Promise<boolean> {
    const button = this.actionButtons[action];
    try {
      await button.waitFor({ state: 'visible', timeout: 2000 });
      return await button.isEnabled();
    } catch {
      return false;
    }
  }

  /**
   * Get all tab names
   */
  async getTabNames(): Promise<string[]> {
    const tabs = await this.page.locator('[role="tab"], .tab').all();
    const names: string[] = [];
    for (const tab of tabs) {
      const text = await tab.textContent();
      if (text) names.push(text.trim());
    }
    return names;
  }

  /**
   * Check WebSocket connection status for logs
   */
  async isLogsWebSocketConnected(): Promise<boolean> {
    await this.switchToLogs();

    // Check for connection indicator or WebSocket state
    const indicator = this.page.locator('[data-testid="ws-status"], .ws-connected').first();
    try {
      await indicator.waitFor({ state: 'visible', timeout: 2000 });
      const text = await indicator.textContent();
      return text?.toLowerCase().includes('connected') || false;
    } catch {
      return false;
    }
  }

  /**
   * Search in logs
   */
  async searchInLogs(query: string): Promise<string[]> {
    await this.switchToLogs();
    await this.logsSection.searchInput.fill(query);
    await this.page.waitForTimeout(500);

    const content = await this.logsSection.logOutput.textContent();
    if (!content) return [];

    return content.split('\n').filter((line) => line.toLowerCase().includes(query.toLowerCase()));
  }
}
