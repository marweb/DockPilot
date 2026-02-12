/**
 * Global teardown for E2E tests
 * Runs once after all test suites complete
 */

import * as fs from 'fs';
import * as path from 'path';
import { chromium } from '@playwright/test';
import { adminUser, generateMockTokens } from '../fixtures/users';

/**
 * Teardown report interface
 */
interface TeardownReport {
  endTime: string;
  duration: number;
  cleanup: {
    containersDeleted: number;
    volumesDeleted: number;
    networksDeleted: number;
    imagesCleaned: number;
  };
  results: {
    totalTests: number;
    passed: number;
    failed: number;
    skipped: number;
    duration: number;
  };
  artifacts: {
    screenshots: number;
    videos: number;
    traces: number;
  };
}

/**
 * Read test results from Playwright output
 */
async function readTestResults(): Promise<TeardownReport['results']> {
  const results: TeardownReport['results'] = {
    totalTests: 0,
    passed: 0,
    failed: 0,
    skipped: 0,
    duration: 0,
  };

  try {
    // Try to read JUnit XML results
    const junitPath = 'test-results/junit-e2e.xml';
    if (fs.existsSync(junitPath)) {
      const junitContent = fs.readFileSync(junitPath, 'utf-8');

      // Parse basic stats from JUnit XML
      const testsMatch = junitContent.match(/tests="(\d+)"/);
      const failuresMatch = junitContent.match(/failures="(\d+)"/);
      const skippedMatch = junitContent.match(/skipped="(\d+)"/);
      const timeMatch = junitContent.match(/time="([\d.]+)"/);

      if (testsMatch) results.totalTests = parseInt(testsMatch[1], 10);
      if (failuresMatch) results.failed = parseInt(failuresMatch[1], 10);
      if (skippedMatch) results.skipped = parseInt(skippedMatch[1], 10);
      if (timeMatch) results.duration = parseFloat(timeMatch[1]);

      results.passed = results.totalTests - results.failed - results.skipped;
    }

    // Alternative: count screenshot/video files
    if (fs.existsSync('test-results')) {
      const entries = fs.readdirSync('test-results', { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const files = fs.readdirSync(path.join('test-results', entry.name));
          results.totalTests += files.length;
        }
      }
    }
  } catch (error) {
    console.warn('Failed to read test results:', error);
  }

  return results;
}

/**
 * Count artifact files
 */
function countArtifacts(): TeardownReport['artifacts'] {
  const artifacts: TeardownReport['artifacts'] = {
    screenshots: 0,
    videos: 0,
    traces: 0,
  };

  const dirs = {
    screenshots: 'test-results/screenshots',
    videos: 'test-results/videos',
    traces: 'test-results/traces',
  };

  for (const [type, dir] of Object.entries(dirs)) {
    if (fs.existsSync(dir)) {
      try {
        const files = fs.readdirSync(dir);
        artifacts[type as keyof typeof artifacts] = files.length;
      } catch {
        // Ignore errors
      }
    }
  }

  return artifacts;
}

/**
 * Clean up test containers
 */
async function cleanupContainers(baseUrl: string): Promise<number> {
  let deletedCount = 0;

  try {
    const tokens = generateMockTokens(adminUser);

    // Get all containers
    const response = await fetch(`${baseUrl}/api/containers`, {
      headers: {
        Authorization: `Bearer ${tokens.accessToken}`,
      },
    });

    if (!response.ok) {
      console.warn('Could not fetch containers for cleanup');
      return deletedCount;
    }

    const result = await response.json();
    const containers = result.data || [];

    // Find test containers
    const testContainersToDelete = containers.filter(
      (c: any) =>
        c.labels?.['test-suite'] === 'e2e' ||
        c.name?.startsWith('test-') ||
        c.name?.startsWith('compose-') ||
        c.name?.includes('e2e-test')
    );

    console.log(`\nFound ${testContainersToDelete.length} containers to delete`);

    // Delete test containers
    for (const container of testContainersToDelete) {
      try {
        const deleteResponse = await fetch(`${baseUrl}/api/containers/${container.id}?force=true`, {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${tokens.accessToken}`,
          },
        });

        if (deleteResponse.ok || deleteResponse.status === 404) {
          deletedCount++;
          console.log(`  ✓ Deleted: ${container.name}`);
        } else {
          console.warn(`  ✗ Failed to delete: ${container.name}`);
        }
      } catch (error) {
        console.warn(`  ✗ Error deleting ${container.name}:`, error);
      }
    }
  } catch (error) {
    console.warn('Error during container cleanup:', error);
  }

  return deletedCount;
}

/**
 * Clean up test volumes
 */
async function cleanupVolumes(baseUrl: string): Promise<number> {
  let deletedCount = 0;

  try {
    const tokens = generateMockTokens(adminUser);

    const response = await fetch(`${baseUrl}/api/volumes`, {
      headers: {
        Authorization: `Bearer ${tokens.accessToken}`,
      },
    });

    if (!response.ok) return deletedCount;

    const result = await response.json();
    const volumes = result.data || [];

    const testVolumes = volumes.filter(
      (v: any) => v.name?.startsWith('test-') || v.labels?.['test-suite'] === 'e2e'
    );

    console.log(`\nFound ${testVolumes.length} volumes to delete`);

    for (const volume of testVolumes) {
      try {
        await fetch(`${baseUrl}/api/volumes/${volume.name}`, {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${tokens.accessToken}`,
          },
        });
        deletedCount++;
        console.log(`  ✓ Deleted volume: ${volume.name}`);
      } catch (error) {
        console.warn(`  ✗ Failed to delete volume: ${volume.name}`);
      }
    }
  } catch (error) {
    console.warn('Error during volume cleanup:', error);
  }

  return deletedCount;
}

/**
 * Clean up test networks
 */
async function cleanupNetworks(baseUrl: string): Promise<number> {
  let deletedCount = 0;

  try {
    const tokens = generateMockTokens(adminUser);

    const response = await fetch(`${baseUrl}/api/networks`, {
      headers: {
        Authorization: `Bearer ${tokens.accessToken}`,
      },
    });

    if (!response.ok) return deletedCount;

    const result = await response.json();
    const networks = result.data || [];

    const testNetworks = networks.filter(
      (n: any) =>
        n.name?.startsWith('test-') ||
        n.name?.startsWith('compose-') ||
        n.labels?.['test-suite'] === 'e2e'
    );

    console.log(`\nFound ${testNetworks.length} networks to delete`);

    for (const network of testNetworks) {
      try {
        await fetch(`${baseUrl}/api/networks/${network.id}`, {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${tokens.accessToken}`,
          },
        });
        deletedCount++;
        console.log(`  ✓ Deleted network: ${network.name}`);
      } catch (error) {
        console.warn(`  ✗ Failed to delete network: ${network.name}`);
      }
    }
  } catch (error) {
    console.warn('Error during network cleanup:', error);
  }

  return deletedCount;
}

/**
 * Prune unused Docker images
 */
async function pruneImages(baseUrl: string): Promise<number> {
  let cleanedCount = 0;

  try {
    const tokens = generateMockTokens(adminUser);

    // Prune dangling images
    const response = await fetch(`${baseUrl}/api/images/prune`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokens.accessToken}`,
      },
    });

    if (response.ok) {
      const result = await response.json();
      cleanedCount = result.data?.deleted || 0;
      console.log(`\nPruned ${cleanedCount} unused images`);
    }
  } catch (error) {
    console.warn('Error during image prune:', error);
  }

  return cleanedCount;
}

/**
 * Clean up temporary files
 */
function cleanupTempFiles(): void {
  const tempDirs = ['playwright/.auth'];

  for (const dir of tempDirs) {
    if (fs.existsSync(dir)) {
      try {
        const files = fs.readdirSync(dir);
        for (const file of files) {
          fs.unlinkSync(path.join(dir, file));
        }
        console.log(`Cleaned temp files in: ${dir}`);
      } catch (error) {
        console.warn(`Failed to clean ${dir}:`, error);
      }
    }
  }
}

/**
 * Generate final report
 */
function generateTeardownReport(report: TeardownReport): void {
  const reportPath = 'test-results/reports/teardown-report.json';

  try {
    // Ensure directory exists
    const dir = path.dirname(reportPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log('\nTeardown report saved:', reportPath);
  } catch (error) {
    console.warn('Failed to save teardown report:', error);
  }

  // Also log summary to console
  console.log('\n========================================');
  console.log('   E2E Test Summary');
  console.log('========================================');
  console.log(`\nTest Results:`);
  console.log(`  Total: ${report.results.totalTests}`);
  console.log(`  Passed: ${report.results.passed}`);
  console.log(`  Failed: ${report.results.failed}`);
  console.log(`  Skipped: ${report.results.skipped}`);
  console.log(`  Duration: ${(report.results.duration / 1000).toFixed(2)}s`);

  console.log(`\nCleanup Summary:`);
  console.log(`  Containers deleted: ${report.cleanup.containersDeleted}`);
  console.log(`  Volumes deleted: ${report.cleanup.volumesDeleted}`);
  console.log(`  Networks deleted: ${report.cleanup.networksDeleted}`);
  console.log(`  Images pruned: ${report.cleanup.imagesCleaned}`);

  console.log(`\nArtifacts Generated:`);
  console.log(`  Screenshots: ${report.artifacts.screenshots}`);
  console.log(`  Videos: ${report.artifacts.videos}`);
  console.log(`  Traces: ${report.artifacts.traces}`);
  console.log('\n========================================');
}

/**
 * Main teardown function
 */
async function globalTeardown(): Promise<void> {
  console.log('\n========================================');
  console.log('   E2E Global Teardown - DockPilot');
  console.log('========================================\n');

  const baseUrl = process.env.E2E_BASE_URL || 'http://localhost:3000';
  const startTime = Date.now();

  // Read test results
  console.log('Reading test results...');
  const testResults = await readTestResults();

  // Count artifacts
  console.log('Counting artifacts...');
  const artifacts = countArtifacts();

  // Cleanup
  const cleanup = {
    containersDeleted: 0,
    volumesDeleted: 0,
    networksDeleted: 0,
    imagesCleaned: 0,
  };

  try {
    // Clean up containers
    console.log('\nCleaning up test containers...');
    cleanup.containersDeleted = await cleanupContainers(baseUrl);

    // Clean up volumes
    console.log('\nCleaning up test volumes...');
    cleanup.volumesDeleted = await cleanupVolumes(baseUrl);

    // Clean up networks
    console.log('\nCleaning up test networks...');
    cleanup.networksDeleted = await cleanupNetworks(baseUrl);

    // Prune images
    console.log('\nPruning unused images...');
    cleanup.imagesCleaned = await pruneImages(baseUrl);
  } catch (error) {
    console.error('Error during cleanup:', error);
  }

  // Clean up temp files
  console.log('\nCleaning up temporary files...');
  cleanupTempFiles();

  // Generate report
  const endTime = new Date().toISOString();
  const report: TeardownReport = {
    endTime,
    duration: Date.now() - startTime,
    cleanup,
    results: testResults,
    artifacts,
  };

  generateTeardownReport(report);

  console.log('\n========================================');
  console.log('   Global Teardown Complete');
  console.log('========================================\n');
}

export default globalTeardown;
