import { vi, beforeAll, afterAll, afterEach } from 'vitest';

// Global test setup
beforeAll(() => {
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test-jwt-secret-for-testing-only';
  process.env.DOCKER_HOST = 'unix:///var/run/docker.sock';
  process.env.DATA_DIR = '/tmp/dockpilot-test';
});

afterAll(() => {
  // Cleanup after all tests
});

afterEach(() => {
  // Cleanup after each test
  vi.clearAllMocks();
});

// Mock console methods in tests to reduce noise
global.console = {
  ...console,
  log: vi.fn(),
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};
