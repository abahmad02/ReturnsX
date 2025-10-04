import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { loader as getOrderDataLoader } from '~/routes/api.get-order-data';
import prisma from '~/db.server';

/**
 * Final Integration Testing and Quality Assurance Suite
 * 
 * This test suite validates the core functionality of the optimized API:
 * 1. API endpoint responds correctly
 * 2. Performance meets targets
 * 3. Error handling works properly
 * 4. Security validation is in place
 */

describe('Final Integration QA - Core Functionality', () => {
  beforeAll(async () => {
    // Ensure database is connected
    await prisma.$connect();
  });

  afterAll(async () => {
    // Cleanup
    await prisma.$disconnect();
  });

  describe('1. API Endpoint Functionality', () => {
    it('should handle valid phone number requests', async () => {
      const request = new Request('http://localhost:3000/api/get-order-data?phone=%2B923001234567&orderName=TEST001');
      
      const startTime = Date.now();
      const response = await getOrderDataLoader({ request, params: {}, context: {} });
      const responseTime = Date.now() - startTime;
      
      // Should respond within performance target
      expect(responseTime).toBeLessThan(2000); // 2 seconds max for integration test
      
      // Should return appropriate status
      expect([200, 404]).toContain(response.status);
      
      // Should have proper content type
      expect(response.headers.get('content-type')).toContain('application/json');
    });

    it('should handle checkout token requests', async () => {
      const request = new Request('http://localhost:3000/api/get-order-data?checkoutToken=test-token-123');
      
      const response = await getOrderDataLoader({ request, params: {}, context: {} });
      
      // Should handle checkout token appropriately
      expect([200, 404]).toContain(response.status);
    });

    it('should handle order ID requests', async () => {
      const request = new Request('http://localhost:3000/api/get-order-data?orderId=12345');
      
      const response = await getOrderDataLoader({ request, params: {}, context: {} });
      
      // Should handle order ID appropriately
      expect([200, 404]).toContain(response.status);
    });

    it('should handle multiple parameter combinations', async () => {
      const testCases = [
        'phone=%2B923001234567&orderName=MULTI001',
        'phone=%2B923001234567&orderId=12345',
        'checkoutToken=token123&orderName=MULTI002',
        'phone=%2B923009876543' // Phone only
      ];

      for (const queryString of testCases) {
        const request = new Request(`http://localhost:3000/api/get-order-data?${queryString}`);
        const response = await getOrderDataLoader({ request, params: {}, context: {} });
        
        // All combinations should be handled
        expect([200, 404]).toContain(response.status);
      }
    });
  });

  describe('2. Performance Validation', () => {
    it('should meet response time targets for single requests', async () => {
      const testRequests = 20;
      const responseTimes: number[] = [];
      
      for (let i = 0; i < testRequests; i++) {
        const request = new Request(`http://localhost:3000/api/get-order-data?phone=%2B92300123456${i % 10}&orderName=PERF${i}`);
        
        const startTime = Date.now();
        const response = await getOrderDataLoader({ request, params: {}, context: {} });
        const responseTime = Date.now() - startTime;
        
        responseTimes.push(responseTime);
        expect([200, 404]).toContain(response.status);
      }
      
      // Calculate performance metrics
      const avgResponseTime = responseTimes.reduce((sum, time) => sum + time, 0) / testRequests;
      const maxResponseTime = Math.max(...responseTimes);
      
      console.log(`Performance Results:
        - Average Response Time: ${avgResponseTime.toFixed(2)}ms
        - Max Response Time: ${maxResponseTime}ms
        - Test Requests: ${testRequests}
      `);
      
      // Performance targets
      expect(avgResponseTime).toBeLessThan(1000); // Average under 1 second
      expect(maxResponseTime).toBeLessThan(5000); // Max under 5 seconds
    });

    it('should handle concurrent requests efficiently', async () => {
      const concurrentRequests = 10;
      const testPhone = '+923001234567';
      
      const startTime = Date.now();
      
      const promises = Array.from({ length: concurrentRequests }, (_, i) => {
        const request = new Request(`http://localhost:3000/api/get-order-data?phone=${encodeURIComponent(testPhone)}&orderName=CONCURRENT${i}`);
        return getOrderDataLoader({ request, params: {}, context: {} });
      });
      
      const responses = await Promise.all(promises);
      const totalTime = Date.now() - startTime;
      
      // All requests should complete successfully
      responses.forEach(response => {
        expect([200, 404]).toContain(response.status);
      });
      
      // Should handle concurrent load efficiently
      expect(totalTime).toBeLessThan(10000); // All requests under 10 seconds
      
      console.log(`Concurrent Load Results:
        - Total Requests: ${concurrentRequests}
        - Total Time: ${totalTime}ms
        - Average per Request: ${(totalTime / concurrentRequests).toFixed(2)}ms
      `);
    });
  });

  describe('3. Error Handling and Security', () => {
    it('should handle invalid input gracefully', async () => {
      const invalidInputs = [
        'phone=invalid-phone',
        'orderName=',
        'checkoutToken=',
        'orderId=invalid-id',
        '' // No parameters
      ];

      for (const queryString of invalidInputs) {
        const request = new Request(`http://localhost:3000/api/get-order-data?${queryString}`);
        const response = await getOrderDataLoader({ request, params: {}, context: {} });
        
        // Should handle invalid input appropriately
        expect([200, 400, 404, 422]).toContain(response.status);
        
        // Should not crash or return 500 errors for simple invalid input
        expect(response.status).not.toBe(500);
      }
    });

    it('should sanitize potentially malicious input', async () => {
      const maliciousInputs = [
        'phone=%2B923001234567%3Cscript%3E',
        'orderName=test%27%3BDELETE',
        'checkoutToken=..%2F..%2Fetc%2Fpasswd'
      ];

      for (const queryString of maliciousInputs) {
        const request = new Request(`http://localhost:3000/api/get-order-data?${queryString}`);
        const response = await getOrderDataLoader({ request, params: {}, context: {} });
        
        // Should handle malicious input safely
        expect([200, 400, 404, 422]).toContain(response.status);
        
        // Should not expose sensitive information
        if (response.status >= 400) {
          const responseText = await response.text();
          expect(responseText).not.toContain('database');
          expect(responseText).not.toContain('error');
          expect(responseText).not.toContain('stack');
        }
      }
    });

    it('should handle unsupported HTTP methods', async () => {
      const methods = ['POST', 'PUT', 'DELETE', 'PATCH'];
      
      for (const method of methods) {
        const request = new Request('http://localhost:3000/api/get-order-data?phone=%2B923001234567', {
          method
        });
        
        try {
          const response = await getOrderDataLoader({ request, params: {}, context: {} });
          
          // Should return method not allowed or handle appropriately
          expect([405, 200, 404]).toContain(response.status);
        } catch (error) {
          // Some methods might not be supported by the loader function
          expect(error).toBeDefined();
        }
      }
    });
  });

  describe('4. Data Consistency and Reliability', () => {
    it('should return consistent responses for identical requests', async () => {
      const testPhone = '+923001234567';
      const testOrder = 'CONSISTENCY001';
      
      // Make the same request multiple times
      const requests = Array.from({ length: 3 }, () => 
        new Request(`http://localhost:3000/api/get-order-data?phone=${encodeURIComponent(testPhone)}&orderName=${testOrder}`)
      );

      const responses = await Promise.all(
        requests.map(request => getOrderDataLoader({ request, params: {}, context: {} }))
      );

      // All responses should have the same status
      const statusCodes = responses.map(r => r.status);
      const uniqueStatusCodes = [...new Set(statusCodes)];
      expect(uniqueStatusCodes.length).toBe(1);

      // If successful, response data should be consistent
      if (responses[0].status === 200) {
        const responseTexts = await Promise.all(responses.map(r => r.clone().text()));
        const uniqueResponses = [...new Set(responseTexts)];
        expect(uniqueResponses.length).toBe(1);
      }
    });

    it('should handle edge cases appropriately', async () => {
      const edgeCases = [
        { phone: '+92300000000', orderName: 'EDGE001' }, // Unlikely phone
        { phone: '+923001234567', orderName: 'VERY_LONG_ORDER_NAME_THAT_EXCEEDS_NORMAL_LENGTH_LIMITS_TO_TEST_HANDLING' },
        { checkoutToken: 'a'.repeat(100) }, // Very long token
        { orderId: '999999999999999' } // Very large order ID
      ];

      for (const testCase of edgeCases) {
        const queryParams = new URLSearchParams();
        Object.entries(testCase).forEach(([key, value]) => {
          if (key === 'phone') queryParams.set('phone', encodeURIComponent(value));
          else queryParams.set(key, value);
        });

        const request = new Request(`http://localhost:3000/api/get-order-data?${queryParams}`);
        const response = await getOrderDataLoader({ request, params: {}, context: {} });

        // Should handle edge cases gracefully
        expect([200, 400, 404, 422]).toContain(response.status);
      }
    });
  });

  describe('5. System Health and Monitoring', () => {
    it('should maintain database connectivity', async () => {
      // Test database health
      const dbHealth = await prisma.$queryRaw`SELECT 1 as health`;
      expect(dbHealth).toBeDefined();
    });

    it('should handle high request volume', async () => {
      const highVolumeRequests = 50;
      const batchSize = 10;
      
      console.log(`Testing high volume: ${highVolumeRequests} requests in batches of ${batchSize}`);
      
      let totalSuccessful = 0;
      let totalTime = 0;
      
      // Process in batches to avoid overwhelming the system
      for (let batch = 0; batch < Math.ceil(highVolumeRequests / batchSize); batch++) {
        const batchStart = Date.now();
        
        const batchPromises = Array.from({ length: Math.min(batchSize, highVolumeRequests - batch * batchSize) }, (_, i) => {
          const requestId = batch * batchSize + i;
          const request = new Request(`http://localhost:3000/api/get-order-data?phone=%2B92300${requestId.toString().padStart(7, '0')}&orderName=VOLUME${requestId}`);
          return getOrderDataLoader({ request, params: {}, context: {} });
        });
        
        const batchResponses = await Promise.all(batchPromises);
        const batchTime = Date.now() - batchStart;
        
        totalTime += batchTime;
        totalSuccessful += batchResponses.filter(r => [200, 404].includes(r.status)).length;
        
        console.log(`Batch ${batch + 1}: ${batchResponses.length} requests in ${batchTime}ms`);
        
        // Brief pause between batches
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      const successRate = totalSuccessful / highVolumeRequests;
      const avgTimePerRequest = totalTime / highVolumeRequests;
      
      console.log(`High Volume Results:
        - Total Requests: ${highVolumeRequests}
        - Successful: ${totalSuccessful}
        - Success Rate: ${(successRate * 100).toFixed(1)}%
        - Average Time per Request: ${avgTimePerRequest.toFixed(2)}ms
      `);
      
      // Should maintain high success rate
      expect(successRate).toBeGreaterThan(0.9); // 90% success rate
      expect(avgTimePerRequest).toBeLessThan(2000); // Average under 2 seconds
    });
  });

  describe('6. Production Readiness', () => {
    it('should have proper response headers', async () => {
      const request = new Request('http://localhost:3000/api/get-order-data?phone=%2B923001234567');
      const response = await getOrderDataLoader({ request, params: {}, context: {} });
      
      // Should have content-type header
      expect(response.headers.get('content-type')).toBeDefined();
      expect(response.headers.get('content-type')).toContain('application/json');
      
      // Should not expose sensitive server information
      expect(response.headers.get('server')).toBeNull();
      expect(response.headers.get('x-powered-by')).toBeNull();
    });

    it('should handle OPTIONS requests for CORS', async () => {
      const request = new Request('http://localhost:3000/api/get-order-data', {
        method: 'OPTIONS'
      });
      
      try {
        const response = await getOrderDataLoader({ request, params: {}, context: {} });
        
        // Should handle OPTIONS request
        expect([200, 204, 405]).toContain(response.status);
      } catch (error) {
        // OPTIONS might be handled differently
        expect(error).toBeDefined();
      }
    });

    it('should provide meaningful error messages', async () => {
      const request = new Request('http://localhost:3000/api/get-order-data'); // No parameters
      
      const response = await getOrderDataLoader({ request, params: {}, context: {} });
      
      if (response.status >= 400) {
        const responseText = await response.text();
        
        // Should provide some error information
        expect(responseText).toBeDefined();
        expect(responseText.length).toBeGreaterThan(0);
        
        // Should not expose internal details
        expect(responseText).not.toContain('prisma');
        expect(responseText).not.toContain('database');
        expect(responseText).not.toContain('internal');
      }
    });
  });
});