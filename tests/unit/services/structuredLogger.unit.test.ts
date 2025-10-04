import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { structuredLogger, LOG_LEVELS } from '../../../app/services/structuredLogger.server';

describe('StructuredLogger', () => {
  beforeEach(() => {
    structuredLogger.clearLogBuffer();
    structuredLogger.setDebugMode(true);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('generateRequestId', () => {
    it('should generate unique request IDs', () => {
      const id1 = structuredLogger.generateRequestId();
      const id2 = structuredLogger.generateRequestId();
      
      expect(id1).toBeDefined();
      expect(id2).toBeDefined();
      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^[0-9a-f-]{36}$/); // UUID format
    });
  });

  describe('logging methods', () => {
    it('should log debug messages when debug mode is enabled', () => {
      const consoleSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
      
      structuredLogger.debug('Test debug message', { testParam: 'value' });
      
      expect(consoleSpy).toHaveBeenCalled();
      const logBuffer = structuredLogger.getLogBuffer();
      expect(logBuffer).toHaveLength(1);
      expect(logBuffer[0].level).toBe(LOG_LEVELS.DEBUG);
      expect(logBuffer[0].message).toBe('Test debug message');
    });

    it('should log info messages', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      structuredLogger.info('Test info message', { requestId: 'test-123' });
      
      expect(consoleSpy).toHaveBeenCalled();
      const logBuffer = structuredLogger.getLogBuffer();
      expect(logBuffer).toHaveLength(1);
      expect(logBuffer[0].level).toBe(LOG_LEVELS.INFO);
      expect(logBuffer[0].context.requestId).toBe('test-123');
    });

    it('should log warning messages', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      structuredLogger.warn('Test warning message');
      
      expect(consoleSpy).toHaveBeenCalled();
      const logBuffer = structuredLogger.getLogBuffer();
      expect(logBuffer).toHaveLength(1);
      expect(logBuffer[0].level).toBe(LOG_LEVELS.WARN);
    });

    it('should log error messages', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      structuredLogger.error('Test error message', { errorCode: 'E001' });
      
      expect(consoleSpy).toHaveBeenCalled();
      const logBuffer = structuredLogger.getLogBuffer();
      expect(logBuffer).toHaveLength(1);
      expect(logBuffer[0].level).toBe(LOG_LEVELS.ERROR);
      expect(logBuffer[0].context.errorCode).toBe('E001');
    });
  });

  describe('parameter sanitization', () => {
    it('should sanitize sensitive parameters', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      structuredLogger.info('Test with sensitive data', {
        parameters: {
          password: 'secret123',
          token: 'abc123token',
          normalParam: 'safe-value'
        }
      });
      
      const logBuffer = structuredLogger.getLogBuffer();
      expect(logBuffer[0].parameters.password).toBe('[REDACTED]');
      expect(logBuffer[0].parameters.token).toBe('[REDACTED]');
      expect(logBuffer[0].parameters.normalParam).toBe('safe-value');
    });

    it('should mask phone numbers', () => {
      structuredLogger.info('Test with phone', {
        parameters: {
          customerPhone: '+1234567890',
          shortPhone: '123'
        }
      });
      
      const logBuffer = structuredLogger.getLogBuffer();
      expect(logBuffer[0].parameters.customerPhone).toBe('***7890');
      expect(logBuffer[0].parameters.shortPhone).toBe('[MASKED]');
    });

    it('should mask email addresses', () => {
      structuredLogger.info('Test with email', {
        parameters: {
          customerEmail: 'user@example.com',
          invalidEmail: 'not-an-email'
        }
      });
      
      const logBuffer = structuredLogger.getLogBuffer();
      expect(logBuffer[0].parameters.customerEmail).toBe('us***@example.com');
      expect(logBuffer[0].parameters.invalidEmail).toBe('not-an-email'); // Not masked if invalid format
    });
  });

  describe('API request logging', () => {
    it('should log API requests with proper structure', () => {
      const requestId = 'test-request-123';
      const method = 'GET';
      const endpoint = '/api/test';
      const parameters = { param1: 'value1' };
      const userAgent = 'Test Agent';
      const ipAddress = '127.0.0.1';
      
      structuredLogger.logApiRequest(
        requestId,
        method,
        endpoint,
        parameters,
        userAgent,
        ipAddress
      );
      
      const logBuffer = structuredLogger.getLogBuffer();
      expect(logBuffer).toHaveLength(1);
      
      const log = logBuffer[0];
      expect(log.requestId).toBe(requestId);
      expect(log.method).toBe(method);
      expect(log.endpoint).toBe(endpoint);
      expect(log.parameters).toEqual(parameters);
      expect(log.userAgent).toBe(userAgent);
      expect(log.ipAddress).toBe(ipAddress);
      expect(log.message).toBe('API Request Started');
    });

    it('should log API responses with metrics', () => {
      const requestId = 'test-request-123';
      const status = 200;
      const processingTime = 150;
      const responseSize = 1024;
      const cacheHit = true;
      const queryCount = 2;
      
      structuredLogger.logApiResponse(
        requestId,
        status,
        processingTime,
        responseSize,
        cacheHit,
        queryCount
      );
      
      const logBuffer = structuredLogger.getLogBuffer();
      expect(logBuffer).toHaveLength(1);
      
      const log = logBuffer[0];
      expect(log.requestId).toBe(requestId);
      expect(log.responseStatus).toBe(status);
      expect(log.processingTime).toBe(processingTime);
      expect(log.responseSize).toBe(responseSize);
      expect(log.cacheHit).toBe(cacheHit);
      expect(log.queryCount).toBe(queryCount);
      expect(log.level).toBe(LOG_LEVELS.INFO);
      expect(log.message).toBe('API Request Completed');
    });

    it('should log failed API responses as errors', () => {
      const requestId = 'test-request-123';
      const status = 500;
      const processingTime = 5000;
      const responseSize = 256;
      const cacheHit = false;
      const queryCount = 1;
      const errorMessage = 'Database connection failed';
      
      structuredLogger.logApiResponse(
        requestId,
        status,
        processingTime,
        responseSize,
        cacheHit,
        queryCount,
        errorMessage
      );
      
      const logBuffer = structuredLogger.getLogBuffer();
      expect(logBuffer).toHaveLength(1);
      
      const log = logBuffer[0];
      expect(log.level).toBe(LOG_LEVELS.ERROR);
      expect(log.message).toBe('API Request Failed');
      expect(log.errorMessage).toBe(errorMessage);
    });
  });

  describe('performance metrics logging', () => {
    it('should log performance metrics', () => {
      const requestId = 'test-request-123';
      const metrics = {
        responseTime: 200,
        queryTime: 50,
        cacheHit: true,
        memoryUsage: 1024 * 1024 * 100 // 100MB
      };
      
      structuredLogger.logPerformanceMetrics(requestId, metrics);
      
      const logBuffer = structuredLogger.getLogBuffer();
      expect(logBuffer).toHaveLength(1);
      
      const log = logBuffer[0];
      expect(log.requestId).toBe(requestId);
      expect(log.message).toBe('Performance Metrics');
      expect(log.context.responseTime).toBe(metrics.responseTime);
      expect(log.context.queryTime).toBe(metrics.queryTime);
      expect(log.context.cacheHit).toBe(metrics.cacheHit);
      expect(log.context.memoryUsage).toBe(metrics.memoryUsage);
    });
  });

  describe('buffer management', () => {
    it('should maintain buffer size limit', () => {
      // Fill buffer beyond limit
      for (let i = 0; i < 1100; i++) {
        structuredLogger.info(`Message ${i}`);
      }
      
      const logBuffer = structuredLogger.getLogBuffer();
      expect(logBuffer.length).toBeLessThanOrEqual(1000);
      
      // Should keep the most recent messages
      const lastMessage = logBuffer[logBuffer.length - 1];
      expect(lastMessage.message).toBe('Message 1099');
    });

    it('should clear buffer when requested', () => {
      structuredLogger.info('Test message 1');
      structuredLogger.info('Test message 2');
      
      expect(structuredLogger.getLogBuffer()).toHaveLength(2);
      
      structuredLogger.clearLogBuffer();
      
      expect(structuredLogger.getLogBuffer()).toHaveLength(0);
    });
  });

  describe('debug mode', () => {
    it('should not log debug messages when debug mode is disabled', () => {
      const consoleSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
      
      structuredLogger.setDebugMode(false);
      structuredLogger.debug('Debug message');
      
      expect(consoleSpy).not.toHaveBeenCalled();
      
      // But should still add to buffer
      const logBuffer = structuredLogger.getLogBuffer();
      expect(logBuffer).toHaveLength(1);
    });

    it('should include detailed context in debug mode', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      structuredLogger.setDebugMode(true);
      structuredLogger.info('Test message', {
        endpoint: '/api/test',
        method: 'GET',
        processingTime: 100
      });
      
      expect(consoleSpy).toHaveBeenCalled();
      const logCall = consoleSpy.mock.calls[0][0];
      const logData = JSON.parse(logCall);
      
      expect(logData.endpoint).toBe('/api/test');
      expect(logData.method).toBe('GET');
      expect(logData.processingTime).toBe(100);
    });

    it('should check debug mode status', () => {
      structuredLogger.setDebugMode(true);
      expect(structuredLogger.isDebugMode()).toBe(true);
      
      structuredLogger.setDebugMode(false);
      expect(structuredLogger.isDebugMode()).toBe(false);
    });
  });

  describe('log format', () => {
    it('should include timestamp in ISO format', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      structuredLogger.info('Test message');
      
      const logCall = consoleSpy.mock.calls[0][0];
      const logData = JSON.parse(logCall);
      
      expect(logData.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    it('should include proper log level formatting', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      structuredLogger.error('Error message');
      
      const logCall = consoleSpy.mock.calls[0][0];
      const logData = JSON.parse(logCall);
      
      expect(logData.level).toBe('ERROR');
    });

    it('should include request ID in all logs', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      structuredLogger.info('Test message', { requestId: 'custom-id' });
      
      const logCall = consoleSpy.mock.calls[0][0];
      const logData = JSON.parse(logCall);
      
      expect(logData.requestId).toBe('custom-id');
    });
  });
});