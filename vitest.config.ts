import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup/vitest.setup.ts'],
    include: ['**/*.{test,spec}.{ts,tsx}'],
    exclude: [
      '**/node_modules/**',
      '**/build/**',
      '**/dist/**'
    ],
    testTimeout: 30000,
    hookTimeout: 30000
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