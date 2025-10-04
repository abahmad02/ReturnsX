import { PrismaClient, CustomerProfile, OrderEvent, CheckoutCorrelation } from "@prisma/client";
import { performance } from "perf_hooks";

export interface CustomerLookupParams {
  phone?: string;
  email?: string;
  orderId?: string;
  checkoutToken?: string;
  shopDomain?: string;
}

export interface QueryBatch {
  type: 'customer' | 'order' | 'correlation';
  params: any;
  priority: 'high' | 'medium' | 'low';
  id: string;
}

export interface QueryResult {
  id: string;
  data: any;
  executionTime: number;
  success: boolean;
  error?: string;
}

export interface QueryMetrics {
  queryType: string;
  executionTime: number;
  recordsReturned: number;
  indexesUsed: string[];
  timestamp: number;
  success: boolean;
}

export interface SlowQueryAlert {
  query: string;
  executionTime: number;
  threshold: number;
  timestamp: number;
  params: any;
}

export class DatabaseQueryOptimizer {
  private prisma: PrismaClient;
  private queryMetrics: QueryMetrics[] = [];
  private slowQueryThreshold: number = 1000; // 1 second
  private slowQueryCallbacks: ((alert: SlowQueryAlert) => void)[] = [];
  private preparedStatements: Map<string, any> = new Map();

  constructor(prisma: PrismaClient, slowQueryThreshold: number = 1000) {
    this.prisma = prisma;
    this.slowQueryThreshold = slowQueryThreshold;
  }

  /**
   * Find customer by various identifiers with optimized queries
   */
  async findCustomerByIdentifiers(params: CustomerLookupParams): Promise<CustomerProfile | null> {
    const startTime = performance.now();
    let result: CustomerProfile | null = null;
    let queryType = 'customer_lookup';

    try {
      // Priority 1: Direct phone lookup (most common and fastest)
      if (params.phone) {
        result = await this.prisma.customerProfile.findUnique({
          where: { phone: params.phone },
          include: {
            orderEvents: {
              take: 10,
              orderBy: { createdAt: 'desc' },
              where: params.shopDomain ? { shopDomain: params.shopDomain } : undefined
            }
          }
        });
        queryType = 'customer_by_phone';
      }

      // Priority 2: Email lookup if phone not found
      if (!result && params.email) {
        result = await this.prisma.customerProfile.findFirst({
          where: { email: params.email },
          include: {
            orderEvents: {
              take: 10,
              orderBy: { createdAt: 'desc' },
              where: params.shopDomain ? { shopDomain: params.shopDomain } : undefined
            }
          }
        });
        queryType = 'customer_by_email';
      }

      // Priority 3: Lookup via checkout correlation
      if (!result && params.checkoutToken) {
        const correlation = await this.findCheckoutCorrelation(params.checkoutToken);
        if (correlation?.customerPhone) {
          result = await this.prisma.customerProfile.findUnique({
            where: { phone: correlation.customerPhone },
            include: {
              orderEvents: {
                take: 10,
                orderBy: { createdAt: 'desc' },
                where: { shopDomain: correlation.shopDomain }
              }
            }
          });
          queryType = 'customer_by_checkout_correlation';
        }
      }

      // Priority 4: Lookup via order ID (slowest, last resort)
      if (!result && params.orderId && params.shopDomain) {
        const orderEvent = await this.prisma.orderEvent.findFirst({
          where: {
            shopifyOrderId: params.orderId,
            shopDomain: params.shopDomain
          },
          include: {
            customerProfile: {
              include: {
                orderEvents: {
                  take: 10,
                  orderBy: { createdAt: 'desc' },
                  where: { shopDomain: params.shopDomain }
                }
              }
            }
          }
        });
        result = orderEvent?.customerProfile || null;
        queryType = 'customer_by_order_id';
      }

      const executionTime = performance.now() - startTime;
      this.recordQueryMetrics({
        queryType,
        executionTime,
        recordsReturned: result ? 1 : 0,
        indexesUsed: this.getExpectedIndexes(queryType),
        timestamp: Date.now(),
        success: true
      });

      if (executionTime > this.slowQueryThreshold) {
        this.alertSlowQuery({
          query: queryType,
          executionTime,
          threshold: this.slowQueryThreshold,
          timestamp: Date.now(),
          params
        });
      }

      return result;
    } catch (error) {
      const executionTime = performance.now() - startTime;
      this.recordQueryMetrics({
        queryType,
        executionTime,
        recordsReturned: 0,
        indexesUsed: [],
        timestamp: Date.now(),
        success: false
      });
      throw error;
    }
  }

  /**
   * Find order events with optimized pagination and filtering
   */
  async findOrderEvents(
    customerProfileId: string, 
    options: {
      limit?: number;
      offset?: number;
      eventTypes?: string[];
      shopDomain?: string;
      dateRange?: { start: Date; end: Date };
    } = {}
  ): Promise<OrderEvent[]> {
    const startTime = performance.now();
    const { limit = 50, offset = 0, eventTypes, shopDomain, dateRange } = options;

    try {
      const whereClause: any = {
        customerProfileId
      };

      if (eventTypes && eventTypes.length > 0) {
        whereClause.eventType = { in: eventTypes };
      }

      if (shopDomain) {
        whereClause.shopDomain = shopDomain;
      }

      if (dateRange) {
        whereClause.createdAt = {
          gte: dateRange.start,
          lte: dateRange.end
        };
      }

      const result = await this.prisma.orderEvent.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset
      });

      const executionTime = performance.now() - startTime;
      this.recordQueryMetrics({
        queryType: 'order_events_lookup',
        executionTime,
        recordsReturned: result.length,
        indexesUsed: ['idx_order_events_customer_timeline'],
        timestamp: Date.now(),
        success: true
      });

      return result;
    } catch (error) {
      const executionTime = performance.now() - startTime;
      this.recordQueryMetrics({
        queryType: 'order_events_lookup',
        executionTime,
        recordsReturned: 0,
        indexesUsed: [],
        timestamp: Date.now(),
        success: false
      });
      throw error;
    }
  }

  /**
   * Find checkout correlation with caching optimization
   */
  async findCheckoutCorrelation(checkoutToken: string): Promise<CheckoutCorrelation | null> {
    const startTime = performance.now();

    try {
      const result = await this.prisma.checkoutCorrelation.findUnique({
        where: { checkoutToken }
      });

      const executionTime = performance.now() - startTime;
      this.recordQueryMetrics({
        queryType: 'checkout_correlation_lookup',
        executionTime,
        recordsReturned: result ? 1 : 0,
        indexesUsed: ['idx_checkout_correlations_token_shop'],
        timestamp: Date.now(),
        success: true
      });

      return result;
    } catch (error) {
      const executionTime = performance.now() - startTime;
      this.recordQueryMetrics({
        queryType: 'checkout_correlation_lookup',
        executionTime,
        recordsReturned: 0,
        indexesUsed: [],
        timestamp: Date.now(),
        success: false
      });
      throw error;
    }
  }

  /**
   * Batch multiple queries for efficiency
   */
  async batchQuery(queries: QueryBatch[]): Promise<QueryResult[]> {
    const startTime = performance.now();
    const results: QueryResult[] = [];

    // Sort queries by priority
    const sortedQueries = queries.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });

    // Execute queries in parallel batches based on priority
    const highPriorityQueries = sortedQueries.filter(q => q.priority === 'high');
    const mediumPriorityQueries = sortedQueries.filter(q => q.priority === 'medium');
    const lowPriorityQueries = sortedQueries.filter(q => q.priority === 'low');

    try {
      // Execute high priority queries first
      if (highPriorityQueries.length > 0) {
        const highResults = await Promise.allSettled(
          highPriorityQueries.map(query => this.executeSingleQuery(query))
        );
        results.push(...this.processSettledResults(highResults, highPriorityQueries));
      }

      // Execute medium priority queries
      if (mediumPriorityQueries.length > 0) {
        const mediumResults = await Promise.allSettled(
          mediumPriorityQueries.map(query => this.executeSingleQuery(query))
        );
        results.push(...this.processSettledResults(mediumResults, mediumPriorityQueries));
      }

      // Execute low priority queries
      if (lowPriorityQueries.length > 0) {
        const lowResults = await Promise.allSettled(
          lowPriorityQueries.map(query => this.executeSingleQuery(query))
        );
        results.push(...this.processSettledResults(lowResults, lowPriorityQueries));
      }

      const totalExecutionTime = performance.now() - startTime;
      this.recordQueryMetrics({
        queryType: 'batch_query',
        executionTime: totalExecutionTime,
        recordsReturned: results.length,
        indexesUsed: ['multiple'],
        timestamp: Date.now(),
        success: true
      });

      return results;
    } catch (error) {
      const executionTime = performance.now() - startTime;
      this.recordQueryMetrics({
        queryType: 'batch_query',
        executionTime,
        recordsReturned: 0,
        indexesUsed: [],
        timestamp: Date.now(),
        success: false
      });
      throw error;
    }
  }

  /**
   * Execute a single query based on type
   */
  private async executeSingleQuery(query: QueryBatch): Promise<QueryResult> {
    const startTime = performance.now();

    try {
      let data: any;

      switch (query.type) {
        case 'customer':
          data = await this.findCustomerByIdentifiers(query.params);
          break;
        case 'order':
          data = await this.findOrderEvents(query.params.customerProfileId, query.params.options);
          break;
        case 'correlation':
          data = await this.findCheckoutCorrelation(query.params.checkoutToken);
          break;
        default:
          throw new Error(`Unknown query type: ${query.type}`);
      }

      return {
        id: query.id,
        data,
        executionTime: performance.now() - startTime,
        success: true
      };
    } catch (error) {
      return {
        id: query.id,
        data: null,
        executionTime: performance.now() - startTime,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Process Promise.allSettled results
   */
  private processSettledResults(
    results: PromiseSettledResult<QueryResult>[],
    queries: QueryBatch[]
  ): QueryResult[] {
    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        return {
          id: queries[index].id,
          data: null,
          executionTime: 0,
          success: false,
          error: result.reason?.message || 'Query failed'
        };
      }
    });
  }

  /**
   * Get expected indexes for query type
   */
  private getExpectedIndexes(queryType: string): string[] {
    const indexMap: Record<string, string[]> = {
      'customer_by_phone': ['idx_customer_profiles_phone_risk'],
      'customer_by_email': ['idx_customer_profiles_email_risk'],
      'customer_by_checkout_correlation': ['idx_checkout_correlations_token_shop', 'idx_customer_profiles_phone_risk'],
      'customer_by_order_id': ['idx_order_events_shopify_order_shop', 'idx_customer_profiles_phone_risk'],
      'order_events_lookup': ['idx_order_events_customer_timeline'],
      'checkout_correlation_lookup': ['idx_checkout_correlations_token_shop']
    };

    return indexMap[queryType] || [];
  }

  /**
   * Record query performance metrics
   */
  private recordQueryMetrics(metrics: QueryMetrics): void {
    this.queryMetrics.push(metrics);

    // Keep only last 1000 metrics to prevent memory issues
    if (this.queryMetrics.length > 1000) {
      this.queryMetrics = this.queryMetrics.slice(-1000);
    }
  }

  /**
   * Alert about slow queries
   */
  private alertSlowQuery(alert: SlowQueryAlert): void {
    console.warn(`Slow query detected: ${alert.query} took ${alert.executionTime}ms (threshold: ${alert.threshold}ms)`);
    
    this.slowQueryCallbacks.forEach(callback => {
      try {
        callback(alert);
      } catch (error) {
        console.error('Error in slow query callback:', error);
      }
    });
  }

  /**
   * Add callback for slow query alerts
   */
  onSlowQuery(callback: (alert: SlowQueryAlert) => void): void {
    this.slowQueryCallbacks.push(callback);
  }

  /**
   * Get query performance statistics
   */
  getQueryStats(timeWindow: number = 300000): {
    totalQueries: number;
    averageExecutionTime: number;
    slowQueries: number;
    successRate: number;
    queryTypeBreakdown: Record<string, number>;
  } {
    const cutoffTime = Date.now() - timeWindow;
    const recentMetrics = this.queryMetrics.filter(m => m.timestamp > cutoffTime);

    if (recentMetrics.length === 0) {
      return {
        totalQueries: 0,
        averageExecutionTime: 0,
        slowQueries: 0,
        successRate: 0,
        queryTypeBreakdown: {}
      };
    }

    const totalQueries = recentMetrics.length;
    const averageExecutionTime = recentMetrics.reduce((sum, m) => sum + m.executionTime, 0) / totalQueries;
    const slowQueries = recentMetrics.filter(m => m.executionTime > this.slowQueryThreshold).length;
    const successfulQueries = recentMetrics.filter(m => m.success).length;
    const successRate = successfulQueries / totalQueries;

    const queryTypeBreakdown: Record<string, number> = {};
    recentMetrics.forEach(m => {
      queryTypeBreakdown[m.queryType] = (queryTypeBreakdown[m.queryType] || 0) + 1;
    });

    return {
      totalQueries,
      averageExecutionTime,
      slowQueries,
      successRate,
      queryTypeBreakdown
    };
  }

  /**
   * Clear query metrics
   */
  clearMetrics(): void {
    this.queryMetrics = [];
  }

  /**
   * Set slow query threshold
   */
  setSlowQueryThreshold(threshold: number): void {
    this.slowQueryThreshold = threshold;
  }
}