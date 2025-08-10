import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    name: 'integration',
    include: ['**/*.integration.test.{ts,tsx}'],
    exclude: [
      '**/node_modules/**',
      '**/build/**',
      '**/dist/**',
      '**/*.unit.test.{ts,tsx}',
      '**/*.e2e.test.{ts,tsx}'
    ],
    environment: 'node',
    globals: true,
    setupFiles: ['./tests/setup/integration.setup.ts'],
    testTimeout: 30000, // Longer timeout for integration tests
    hookTimeout: 30000,
    pool: 'forks', // Run tests in separate processes for isolation
    poolOptions: {
      forks: {
        singleFork: true // Use single fork for database consistency
      }
    }
  },
  resolve: {
    alias: {
      '~': resolve(__dirname, './app'),
      '@': resolve(__dirname, './'),
    }
  },
  define: {
    'process.env.NODE_ENV': '"test"'
  }
}); 