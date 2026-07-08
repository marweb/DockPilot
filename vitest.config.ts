import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['services/*/tests/**/*.{test,spec}.{ts,tsx}'],
    exclude: [
      '**/node_modules/**',
      'dist/**',
      '.turbo/**',
      'apps/**',
      'tests/**',
    ],
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'dist/',
        'tests/',
        'apps/',
        '**/*.d.ts',
        '**/*.config.{ts,js}',
        '**/types/**',
      ],
      thresholds: {
        global: {
          branches: 70,
          functions: 70,
          lines: 70,
          statements: 70,
        },
      },
    },
    testTimeout: 10000,
    hookTimeout: 10000,
    pool: 'threads',
    singleThread: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
      '@dockpilot/types': path.resolve(__dirname, './packages/types/src'),
    },
  },
});
