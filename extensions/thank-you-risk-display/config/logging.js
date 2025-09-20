/**
 * Production Logging Configuration
 * Implements structured logging with sanitization and remote shipping
 */

const config = require('./production.json');

class ProductionLogger {
  constructor() {
    this.config = config.logging;
    this.logBuffer = [];
    this.isInitialized = false;
    this.sessionId = this.generateSessionId();
    
    // Log levels
    this.levels = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3
    };
    
    this.currentLevel = this.levels[this.config.level] || this.levels.info;
  }

  /**
   * Initialize logger
   */
  initialize() {
    if (this.isInitialized) return;

    // Setup periodic log shipping
    setInterval(() => {
      this.shipLogs();
    }, 30000); // Ship logs every 30 seconds

    // Ship logs on page unload
    window.addEventListener('beforeunload', () => {
      this.shipLogs(true);
    });

    // Override console methods in production
    if (this.config.format === 'json') {
      this.overrideConsole();
    }

    this.isInitialized = true;
    this.info('Production logger initialized', { sessionId: this.sessionId });
  }

  /**
   * Generate unique session ID
   */
  generateSessionId() {
    return 'sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  /**
   * Override console methods for structured logging
   */
  overrideConsole() {
    const originalConsole = { ...console };

    console.error = (...args) => {
      this.error(args[0], { args: args.slice(1) });
      originalConsole.error(...args);
    };

    console.warn = (...args) => {
      this.warn(args[0], { args: args.slice(1) });
      originalConsole.warn(...args);
    };

    console.info = (...args) => {
      this.info(args[0], { args: args.slice(1) });
      originalConsole.info(...args);
    };

    console.log = (...args) => {
      this.info(args[0], { args: args.slice(1) });
      originalConsole.log(...args);
    };

    console.debug = (...args) => {
      this.debug(args[0], { args: args.slice(1) });
      originalConsole.debug(...args);
    };
  }

  /**
   * Create structured log entry
   */
  createLogEntry(level, message, metadata = {}) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message: this.sanitizeMessage(message),
      metadata: this.sanitizeMetadata(metadata),
      service: 'thank-you-extension',
      environment: 'production',
      version: process.env.npm_package_version || '1.0.0',
      sessionId: this.sessionId,
      url: window.location.href,
      userAgent: navigator.userAgent,
      ...(level === 'error' && this.config.includeStackTrace && metadata.stack && {
        stack: this.sanitizeStackTrace(metadata.stack)
      })
    };

    return logEntry;
  }

  /**
   * Sanitize log message
   */
  sanitizeMessage(message) {
    if (typeof message !== 'string') {
      message = String(message);
    }

    if (!this.config.sanitizeData) {
      return message;
    }

    // Remove potential PII patterns
    const piiPatterns = [
      /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, // Credit card numbers
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, // Email addresses
      /\b\+?[\d\s\-\(\)]{10,}\b/g, // Phone numbers
      /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, // IP addresses
      /\b[A-Za-z0-9]{32,}\b/g // Long tokens/hashes
    ];

    let sanitized = message;
    piiPatterns.forEach(pattern => {
      sanitized = sanitized.replace(pattern, '[REDACTED]');
    });

    return sanitized;
  }

  /**
   * Sanitize metadata object
   */
  sanitizeMetadata(metadata) {
    if (!metadata || typeof metadata !== 'object') {
      return metadata;
    }

    if (!this.config.sanitizeData) {
      return metadata;
    }

    const sanitized = {};
    const sensitiveKeys = [
      'password', 'token', 'secret', 'key', 'auth', 'authorization',
      'phone', 'email', 'address', 'ssn', 'credit', 'card'
    ];

    for (const [key, value] of Object.entries(metadata)) {
      const lowerKey = key.toLowerCase();
      const isSensitive = sensitiveKeys.some(sensitive => lowerKey.includes(sensitive));

      if (isSensitive) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof value === 'string') {
        sanitized[key] = this.sanitizeMessage(value);
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeMetadata(value);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  /**
   * Sanitize stack trace
   */
  sanitizeStackTrace(stack) {
    if (!stack || !this.config.sanitizeData) {
      return stack;
    }

    // Remove file paths that might contain sensitive information
    return stack.replace(/\/[^\s]+\//g, '/[PATH]/');
  }

  /**
   * Check if log level should be processed
   */
  shouldLog(level) {
    return this.levels[level] <= this.currentLevel;
  }

  /**
   * Add log entry to buffer
   */
  addToBuffer(logEntry) {
    this.logBuffer.push(logEntry);

    // Limit buffer size
    if (this.logBuffer.length > 1000) {
      this.logBuffer.shift();
    }

    // Ship immediately for error logs
    if (logEntry.level === 'error') {
      this.shipLogs();
    }
  }

  /**
   * Error level logging
   */
  error(message, metadata = {}) {
    if (!this.shouldLog('error')) return;

    const logEntry = this.createLogEntry('error', message, metadata);
    this.addToBuffer(logEntry);
  }

  /**
   * Warning level logging
   */
  warn(message, metadata = {}) {
    if (!this.shouldLog('warn')) return;

    const logEntry = this.createLogEntry('warn', message, metadata);
    this.addToBuffer(logEntry);
  }

  /**
   * Info level logging
   */
  info(message, metadata = {}) {
    if (!this.shouldLog('info')) return;

    const logEntry = this.createLogEntry('info', message, metadata);
    this.addToBuffer(logEntry);
  }

  /**
   * Debug level logging
   */
  debug(message, metadata = {}) {
    if (!this.shouldLog('debug')) return;

    const logEntry = this.createLogEntry('debug', message, metadata);
    this.addToBuffer(logEntry);
  }

  /**
   * Ship logs to remote destination
   */
  async shipLogs(synchronous = false) {
    if (this.logBuffer.length === 0) return;

    const logs = this.logBuffer.splice(0);
    const payload = {
      logs,
      metadata: {
        service: 'thank-you-extension',
        environment: 'production',
        timestamp: new Date().toISOString(),
        count: logs.length
      }
    };

    try {
      if (synchronous && navigator.sendBeacon) {
        // Use sendBeacon for synchronous sending on page unload
        const data = JSON.stringify(payload);
        navigator.sendBeacon(this.config.destination, data);
      } else {
        // Use fetch for normal log shipping
        await fetch(this.config.destination, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.RETURNSX_API_TOKEN}`
          },
          body: JSON.stringify(payload)
        });
      }
    } catch (error) {
      // If shipping fails, put logs back in buffer
      this.logBuffer.unshift(...logs);
      
      // Use console.error directly to avoid infinite loop
      if (typeof console !== 'undefined' && console.error) {
        console.error('Failed to ship logs:', error);
      }
    }
  }

  /**
   * Create performance log
   */
  logPerformance(operation, duration, metadata = {}) {
    this.info(`Performance: ${operation}`, {
      type: 'performance',
      operation,
      duration,
      ...metadata
    });
  }

  /**
   * Create API call log
   */
  logAPICall(method, url, status, duration, metadata = {}) {
    const level = status >= 400 ? 'error' : status >= 300 ? 'warn' : 'info';
    
    this[level](`API Call: ${method} ${url}`, {
      type: 'api_call',
      method,
      url: this.sanitizeMessage(url),
      status,
      duration,
      ...metadata
    });
  }

  /**
   * Create user action log
   */
  logUserAction(action, metadata = {}) {
    this.info(`User Action: ${action}`, {
      type: 'user_action',
      action,
      ...metadata
    });
  }

  /**
   * Create security event log
   */
  logSecurityEvent(event, severity = 'warn', metadata = {}) {
    this[severity](`Security Event: ${event}`, {
      type: 'security_event',
      event,
      severity,
      ...metadata
    });
  }

  /**
   * Create business event log
   */
  logBusinessEvent(event, metadata = {}) {
    this.info(`Business Event: ${event}`, {
      type: 'business_event',
      event,
      ...metadata
    });
  }

  /**
   * Get logger status
   */
  getStatus() {
    return {
      initialized: this.isInitialized,
      level: this.config.level,
      bufferSize: this.logBuffer.length,
      sessionId: this.sessionId,
      config: {
        destination: this.config.destination,
        format: this.config.format,
        sanitizeData: this.config.sanitizeData
      }
    };
  }

  /**
   * Flush all logs immediately
   */
  async flush() {
    await this.shipLogs();
  }

  /**
   * Set log level
   */
  setLevel(level) {
    if (this.levels[level] !== undefined) {
      this.currentLevel = this.levels[level];
      this.config.level = level;
      this.info(`Log level changed to: ${level}`);
    }
  }
}

// Create global logger instance
const logger = new ProductionLogger();

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => logger.initialize());
} else {
  logger.initialize();
}

// Export for use in extension
window.ReturnsXLogger = logger;

module.exports = ProductionLogger;