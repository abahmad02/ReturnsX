import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    name: 'unit',
    include: ['**/*.unit.test.{ts,tsx}'],
    exclude: [
      '**/node_modules/**',
      '**/build/**',
      '**/dist/**',
      '**/*.integration.test.{ts,tsx}',
      '**/*.e2e.test.{ts,tsx}'
    ],
    environment: 'node',
    globals: true,
    setupFiles: ['./tests/setup/unit.setup.ts'],
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: [
        'coverage/**',
        'dist/**',
        'packages/*/test{,s}/**',
        '**/*.d.ts',
        'cypress/**',
        'test{,s}/**',
        'test{,-*}.{js,cjs,mjs,ts,tsx,jsx}',
        '**/*{.,-}test.{js,cjs,mjs,ts,tsx,jsx}',
        '**/*{.,-}spec.{js,cjs,mjs,ts,tsx,jsx}',
        '**/__tests__/**',
        '**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build}.config.*',
        '**/.{eslint,mocha,prettier}rc.{js,cjs,yml}'
      ],
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80
        }
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