/**
 * Lazy-loaded Components for Performance Optimization
 * 
 * Components that are loaded only when needed to reduce initial bundle size
 * and improve loading performance.
 */

import React, { Suspense, lazy, memo } from 'react';
import { BlockStack, Text, Spinner } from '@shopify/ui-extensions-react/checkout';
import { ExtensionConfig, RiskProfileResponse, CustomerData } from '../types';

// Lazy load non-critical components
const LazyRecommendationsList = lazy(() => 
  import('./RecommendationsList').then(module => ({ default: module.RecommendationsList }))
);

const LazyWhatsAppContact = lazy(() => 
  import('./WhatsAppContact').then(module => ({ default: module.WhatsAppContact }))
);

const LazyCustomerStatistics = lazy(() => 
  import('./CustomerStatistics').then(module => ({ default: module.CustomerStatistics }))
);

// Loading fallback component
const LazyLoadingFallback = memo(({ message = "Loading..." }: { message?: string }) => (
  <BlockStack spacing="tight" inlineAlignment="center">
    <Spinner size="small" />
    <Text size="small" appearance="subdued">{message}</Text>
  </BlockStack>
));

LazyLoadingFallback.displayName = 'LazyLoadingFallback';

// Error boundary for lazy components
interface LazyErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class LazyErrorBoundary extends React.Component<
  React.PropsWithChildren<{ fallback?: React.ReactNode }>,
  LazyErrorBoundaryState
> {
  constructor(props: React.PropsWithChildren<{ fallback?: React.ReactNode }>) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): LazyErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Lazy component error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <Text size="small" appearance="critical">
          Failed to load component
        </Text>
      );
    }

    return this.props.children;
  }
}

// Optimized lazy wrapper with error boundary
function withLazyLoading<P extends object>(
  LazyComponent: React.LazyExoticComponent<React.ComponentType<P>>,
  loadingMessage?: string,
  fallback?: React.ReactNode
) {
  return memo((props: P) => (
    <LazyErrorBoundary fallback={fallback}>
      <Suspense fallback={<LazyLoadingFallback message={loadingMessage} />}>
        <LazyComponent {...props} />
      </Suspense>
    </LazyErrorBoundary>
  ));
}

// Exported lazy components with optimized loading
export const OptimizedRecommendationsList = withLazyLoading(
  LazyRecommendationsList,
  "Loading recommendations...",
  <Text size="small" appearance="subdued">Recommendations unavailable</Text>
);

export const OptimizedWhatsAppContact = withLazyLoading(
  LazyWhatsAppContact,
  "Loading contact options...",
  <Text size="small" appearance="subdued">Contact options unavailable</Text>
);

export const OptimizedCustomerStatistics = withLazyLoading(
  LazyCustomerStatistics,
  "Loading statistics...",
  <Text size="small" appearance="subdued">Statistics unavailable</Text>
);

// Conditional lazy loading based on risk tier
interface ConditionalLazyComponentProps {
  riskProfile: RiskProfileResponse;
  config: ExtensionConfig;
  customerData?: CustomerData;
  onWhatsAppContact?: () => void;
}

export const ConditionalLazyComponents = memo(({
  riskProfile,
  config,
  customerData,
  onWhatsAppContact,
}: ConditionalLazyComponentProps) => {
  const shouldShowRecommendations = 
    config.show_detailed_tips && 
    riskProfile.recommendations && 
    riskProfile.recommendations.length > 0;

  const shouldShowWhatsApp = 
    config.whatsapp_enabled && 
    riskProfile.riskTier === 'HIGH_RISK' && 
    config.whatsapp_phone && 
    onWhatsAppContact;

  const shouldShowStatistics = 
    !riskProfile.isNewCustomer && 
    (riskProfile.totalOrders > 0 || riskProfile.successfulDeliveries > 0);

  return (
    <BlockStack spacing="base">
      {shouldShowStatistics && (
        <OptimizedCustomerStatistics
          riskProfile={riskProfile}
          config={config}
        />
      )}

      {shouldShowRecommendations && (
        <OptimizedRecommendationsList
          recommendations={riskProfile.recommendations!}
          riskTier={riskProfile.riskTier}
          config={config}
        />
      )}

      {shouldShowWhatsApp && (
        <OptimizedWhatsAppContact
          config={config}
          customerData={customerData}
          onContact={onWhatsAppContact}
        />
      )}
    </BlockStack>
  );
});

ConditionalLazyComponents.displayName = 'ConditionalLazyComponents';

// Intersection Observer hook for lazy loading when component comes into view
export function useIntersectionObserver(
  ref: React.RefObject<Element>,
  options: IntersectionObserverInit = {}
) {
  const [isIntersecting, setIsIntersecting] = React.useState(false);
  const [hasIntersected, setHasIntersected] = React.useState(false);

  React.useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsIntersecting(entry.isIntersecting);
        if (entry.isIntersecting && !hasIntersected) {
          setHasIntersected(true);
        }
      },
      {
        threshold: 0.1,
        rootMargin: '50px',
        ...options,
      }
    );

    observer.observe(element);

    return () => {
      observer.unobserve(element);
    };
  }, [ref, hasIntersected, options]);

  return { isIntersecting, hasIntersected };
}

// Viewport-aware lazy loading component
interface ViewportLazyComponentProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  rootMargin?: string;
  threshold?: number;
}

export const ViewportLazyComponent = memo(({
  children,
  fallback = <LazyLoadingFallback />,
  rootMargin = '50px',
  threshold = 0.1,
}: ViewportLazyComponentProps) => {
  const ref = React.useRef<HTMLDivElement>(null);
  const { hasIntersected } = useIntersectionObserver(ref, {
    rootMargin,
    threshold,
  });

  return (
    <div ref={ref}>
      {hasIntersected ? children : fallback}
    </div>
  );
});

ViewportLazyComponent.displayName = 'ViewportLazyComponent';

// Progressive enhancement wrapper
interface ProgressiveEnhancementProps {
  children: React.ReactNode;
  enhanced: React.ReactNode;
  condition: boolean;
  delay?: number;
}

export const ProgressiveEnhancement = memo(({
  children,
  enhanced,
  condition,
  delay = 0,
}: ProgressiveEnhancementProps) => {
  const [shouldEnhance, setShouldEnhance] = React.useState(!delay);

  React.useEffect(() => {
    if (delay > 0 && condition) {
      const timer = setTimeout(() => {
        setShouldEnhance(true);
      }, delay);

      return () => clearTimeout(timer);
    }
  }, [condition, delay]);

  if (condition && shouldEnhance) {
    return <>{enhanced}</>;
  }

  return <>{children}</>;
});

ProgressiveEnhancement.displayName = 'ProgressiveEnhancement';