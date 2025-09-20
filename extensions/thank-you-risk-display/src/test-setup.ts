import { vi } from 'vitest';
import '@testing-library/jest-dom';
import React from 'react';

// Mock Shopify UI Extensions
vi.mock('@shopify/ui-extensions-react/checkout', () => ({
  useOrder: vi.fn(),
  useSettings: vi.fn(),
  reactExtension: vi.fn((target, component) => component),
  BlockStack: ({ children }: any) => children,
  Text: ({ children }: any) => children,
  InlineLayout: ({ children }: any) => children,
  View: ({ children }: any) => children,
  Button: ({ children }: any) => children,
  Spinner: () => 'Loading...',
}));

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

// Mock fetch globally
global.fetch = vi.fn();

// Mock crypto.subtle for Web Crypto API
Object.defineProperty(global, 'crypto', {
  value: {
    subtle: {
      digest: vi.fn(),
    },
  },
});

// Mock TextEncoder
global.TextEncoder = class {
  encoding = 'utf-8';
  
  encode(input: string) {
    return new Uint8Array(Buffer.from(input, 'utf8'));
  }
  
  encodeInto() {
    throw new Error('encodeInto not implemented in mock');
  }
} as any;

// Mock setTimeout and clearTimeout for testing
global.setTimeout = vi.fn((fn, delay) => {
  if (typeof fn === 'function') {
    return setTimeout(fn, delay);
  }
  return 0;
}) as any;

global.clearTimeout = vi.fn((id) => {
  clearTimeout(id);
});

// Mock AbortController
global.AbortController = class {
  signal = {
    aborted: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };
  
  abort() {
    this.signal.aborted = true;
  }
} as any;