// Main extension entry point
export { default } from './Checkout';

// Types
export * from './types';

// Components
export { ErrorBoundary, useErrorHandler } from './components/ErrorBoundary';

// Hooks
export { useExtensionConfig } from './hooks/useExtensionConfig';
export { useCustomerData } from './hooks/useCustomerData';