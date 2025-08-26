import { logger } from "../services/logger.server";

/**
 * Environment Variable Security Validation
 * 
 * Validates all environment variables for security compliance
 * Ensures production-ready configuration
 */

export interface SecurityConfig {
  database: {
    url: string;
    sslMode: string;
    connectionLimit: number;
  };
  encryption: {
    key: string;
    hashSalt: string;
  };
  session: {
    secret: string;
    secure: boolean;
    sameSite: string;
  };
  shopify: {
    apiKey: string;
    apiSecret: string;
    scopes: string;
  };
  logging: {
    level: string;
    auditRetentionDays: number;
  };
  rateLimiting: {
    redisUrl?: string;
    memoryCleanupInterval: number;
  };
  whatsapp?: {
    accountSid: string;
    authToken: string;
    webhookSecret: string;
  };
}

/**
 * Validate environment variables for security compliance
 */
export function validateEnvironmentSecurity(): SecurityConfig {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Database validation
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    errors.push("DATABASE_URL is required");
  } else if (!databaseUrl.includes("ssl=true") && !databaseUrl.includes("sslmode=require")) {
    warnings.push("DATABASE_URL should enforce SSL connections");
  }

  const databaseSslMode = process.env.DATABASE_SSL_MODE || "prefer";
  if (process.env.NODE_ENV === "production" && databaseSslMode !== "require") {
    errors.push("DATABASE_SSL_MODE must be 'require' in production");
  }

  // Encryption validation
  const encryptionKey = process.env.RETURNSX_ENCRYPTION_KEY;
  if (!encryptionKey) {
    errors.push("RETURNSX_ENCRYPTION_KEY is required");
  } else if (encryptionKey.length < 32) {
    errors.push("RETURNSX_ENCRYPTION_KEY must be at least 32 characters");
  } else if (encryptionKey === "32-character-random-key-for-aes-256-encryption") {
    errors.push("RETURNSX_ENCRYPTION_KEY must not use default value");
  }

  const hashSalt = process.env.RETURNSX_HASH_SALT;
  if (!hashSalt) {
    errors.push("RETURNSX_HASH_SALT is required");
  } else if (hashSalt.length < 16) {
    errors.push("RETURNSX_HASH_SALT must be at least 16 characters");
  } else if (hashSalt === "returnsx-default-salt-change-in-production") {
    errors.push("RETURNSX_HASH_SALT must not use default value");
  }

  // Session security validation
  const sessionSecret = process.env.SESSION_SECRET;
  if (!sessionSecret) {
    errors.push("SESSION_SECRET is required");
  } else if (sessionSecret.length < 32) {
    errors.push("SESSION_SECRET must be at least 32 characters");
  }

  const sessionSecure = process.env.SESSION_SECURE;
  if (process.env.NODE_ENV === "production" && sessionSecure !== "true") {
    errors.push("SESSION_SECURE must be 'true' in production");
  }

  const sessionSameSite = process.env.SESSION_SAME_SITE || "lax";
  if (process.env.NODE_ENV === "production" && sessionSameSite !== "strict") {
    warnings.push("SESSION_SAME_SITE should be 'strict' in production");
  }

  // Shopify validation
  const shopifyApiKey = process.env.SHOPIFY_API_KEY;
  const shopifyApiSecret = process.env.SHOPIFY_API_SECRET;
  if (!shopifyApiKey || !shopifyApiSecret) {
    errors.push("SHOPIFY_API_KEY and SHOPIFY_API_SECRET are required");
  }

  const shopifyScopes = process.env.SHOPIFY_SCOPES;
  if (!shopifyScopes) {
    errors.push("SHOPIFY_SCOPES is required");
  } else {
    validateShopifyScopes(shopifyScopes, warnings);
  }

  // Logging validation
  const logLevel = process.env.LOG_LEVEL || "info";
  const validLogLevels = ["error", "warn", "info", "debug"];
  if (!validLogLevels.includes(logLevel)) {
    errors.push(`LOG_LEVEL must be one of: ${validLogLevels.join(", ")}`);
  }

  if (process.env.NODE_ENV === "production" && logLevel === "debug") {
    warnings.push("LOG_LEVEL 'debug' not recommended for production");
  }

  const auditRetentionDays = parseInt(process.env.AUDIT_LOG_RETENTION_DAYS || "2555");
  if (auditRetentionDays < 2555) { // 7 years minimum for financial compliance
    warnings.push("AUDIT_LOG_RETENTION_DAYS should be at least 2555 days (7 years) for compliance");
  }

  // Rate limiting validation
  const rateLimitRedisUrl = process.env.RATE_LIMIT_REDIS_URL;
  const memoryCleanupInterval = parseInt(process.env.RATE_LIMIT_MEMORY_CLEANUP_INTERVAL || "300000");
  
  if (process.env.NODE_ENV === "production" && !rateLimitRedisUrl) {
    warnings.push("RATE_LIMIT_REDIS_URL recommended for production deployments");
  }

  // WhatsApp validation (optional)
  let whatsappConfig: SecurityConfig['whatsapp'] | undefined;
  const twilioSid = process.env.TWILIO_ACCOUNT_SID;
  const twilioToken = process.env.TWILIO_AUTH_TOKEN;
  const whatsappSecret = process.env.WHATSAPP_WEBHOOK_SECRET;

  if (twilioSid || twilioToken || whatsappSecret) {
    if (!twilioSid || !twilioToken || !whatsappSecret) {
      warnings.push("Incomplete WhatsApp configuration - all TWILIO_* and WHATSAPP_* variables required");
    } else {
      whatsappConfig = {
        accountSid: twilioSid,
        authToken: twilioToken,
        webhookSecret: whatsappSecret
      };
    }
  }

  // Report validation results
  if (errors.length > 0) {
    logger.error("Environment validation failed", {
      component: "environmentValidation",
      errors,
      warnings
    });
    throw new Error(`Environment validation failed: ${errors.join(", ")}`);
  }

  if (warnings.length > 0) {
    logger.warn("Environment validation warnings", {
      component: "environmentValidation", 
      warnings
    });
  }

  logger.info("Environment validation passed", {
    component: "environmentValidation",
    warningCount: warnings.length,
    environment: process.env.NODE_ENV
  });

  return {
    database: {
      url: databaseUrl!,
      sslMode: databaseSslMode,
      connectionLimit: parseInt(process.env.DATABASE_CONNECTION_LIMIT || "10")
    },
    encryption: {
      key: encryptionKey!,
      hashSalt: hashSalt!
    },
    session: {
      secret: sessionSecret!,
      secure: sessionSecure === "true",
      sameSite: sessionSameSite
    },
    shopify: {
      apiKey: shopifyApiKey!,
      apiSecret: shopifyApiSecret!,
      scopes: shopifyScopes!
    },
    logging: {
      level: logLevel,
      auditRetentionDays
    },
    rateLimiting: {
      redisUrl: rateLimitRedisUrl,
      memoryCleanupInterval
    },
    whatsapp: whatsappConfig
  };
}

/**
 * Validate Shopify scopes for data protection compliance
 */
function validateShopifyScopes(scopes: string, warnings: string[]): void {
  const scopeList = scopes.split(",").map(s => s.trim());
  
  // Required scopes for ReturnsX functionality
  const requiredScopes = [
    "read_orders",
    "read_customers", 
    "read_fulfillments",
    "read_refunds"
  ];

  // Potentially risky scopes that should be avoided
  const riskyScopes = [
    "write_customers",
    "read_all_orders",
    "write_orders",
    "read_customer_payments",
    "write_customer_payments"
  ];

  for (const required of requiredScopes) {
    if (!scopeList.includes(required)) {
      warnings.push(`Missing required scope: ${required}`);
    }
  }

  for (const risky of riskyScopes) {
    if (scopeList.includes(risky)) {
      warnings.push(`Potentially unnecessary scope for data protection: ${risky}`);
    }
  }
}

/**
 * Validate production security configuration
 */
export function validateProductionSecurity(): {
  passed: boolean;
  criticalIssues: string[];
  recommendations: string[];
} {
  const criticalIssues: string[] = [];
  const recommendations: string[] = [];

  if (process.env.NODE_ENV !== "production") {
    return { passed: true, criticalIssues: [], recommendations: [] };
  }

  // Check HTTPS enforcement
  if (process.env.SESSION_SECURE !== "true") {
    criticalIssues.push("HTTPS must be enforced in production (SESSION_SECURE=true)");
  }

  // Check database security
  const dbUrl = process.env.DATABASE_URL;
  if (dbUrl && !dbUrl.includes("ssl")) {
    criticalIssues.push("Database connections must use SSL in production");
  }

  // Check for default secrets
  const defaultSecrets = [
    { key: "RETURNSX_ENCRYPTION_KEY", defaultValue: "32-character-random-key-for-aes-256-encryption" },
    { key: "RETURNSX_HASH_SALT", defaultValue: "returnsx-default-salt-change-in-production" },
    { key: "SESSION_SECRET", defaultValue: "your-session-secret-here" }
  ];

  for (const { key, defaultValue } of defaultSecrets) {
    if (process.env[key] === defaultValue) {
      criticalIssues.push(`${key} must not use default value in production`);
    }
  }

  // Security recommendations
  recommendations.push(
    "Use environment variable encryption at rest",
    "Implement secret rotation policies", 
    "Enable database connection pooling",
    "Configure distributed rate limiting with Redis",
    "Enable comprehensive monitoring and alerting",
    "Implement automated security scanning"
  );

  const passed = criticalIssues.length === 0;

  logger.info("Production security validation", {
    component: "environmentValidation",
    passed,
    criticalIssues: criticalIssues.length,
    recommendations: recommendations.length
  });

  return { passed, criticalIssues, recommendations };
}

/**
 * Generate secure random values for development
 */
export function generateSecureDefaults(): {
  encryptionKey: string;
  hashSalt: string;
  sessionSecret: string;
} {
  const crypto = require('crypto');

  return {
    encryptionKey: crypto.randomBytes(32).toString('hex'),
    hashSalt: crypto.randomBytes(32).toString('hex'),
    sessionSecret: crypto.randomBytes(32).toString('hex')
  };
}

/**
 * Check for security vulnerabilities in configuration
 */
export function performSecurityAudit(): {
  vulnerabilities: Array<{
    severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
    category: string;
    description: string;
    remediation: string;
  }>;
  score: number; // 0-100
} {
  const vulnerabilities: Array<{
    severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
    category: string;
    description: string;
    remediation: string;
  }> = [];

  // Check environment security
  if (process.env.NODE_ENV === "development" && process.env.LOG_LEVEL === "debug") {
    vulnerabilities.push({
      severity: "LOW",
      category: "Information Disclosure",
      description: "Debug logging enabled in development",
      remediation: "Disable debug logging in production"
    });
  }

  // Check for weak secrets
  const encryptionKey = process.env.RETURNSX_ENCRYPTION_KEY;
  if (encryptionKey && encryptionKey.length < 32) {
    vulnerabilities.push({
      severity: "CRITICAL",
      category: "Cryptographic Weakness",
      description: "Encryption key too short",
      remediation: "Use at least 32-character encryption key"
    });
  }

  // Check database security
  const dbUrl = process.env.DATABASE_URL;
  if (dbUrl && dbUrl.includes("password") && !dbUrl.includes("ssl")) {
    vulnerabilities.push({
      severity: "HIGH",
      category: "Data in Transit",
      description: "Database connection not encrypted",
      remediation: "Enable SSL for database connections"
    });
  }

  // Calculate security score
  const totalPoints = 100;
  const deductions = vulnerabilities.reduce((total, vuln) => {
    switch (vuln.severity) {
      case "CRITICAL": return total + 40;
      case "HIGH": return total + 20;
      case "MEDIUM": return total + 10;
      case "LOW": return total + 5;
      default: return total;
    }
  }, 0);

  const score = Math.max(0, totalPoints - deductions);

  logger.info("Security audit completed", {
    component: "environmentValidation",
    vulnerabilities: vulnerabilities.length,
    score,
    criticalIssues: vulnerabilities.filter(v => v.severity === "CRITICAL").length
  });

  return { vulnerabilities, score };
}

/**
 * Initialize and validate environment on startup
 */
export function initializeEnvironmentSecurity(): SecurityConfig {
  logger.info("Initializing environment security validation", {
    component: "environmentValidation",
    nodeEnv: process.env.NODE_ENV
  });

  try {
    // Validate basic environment
    const config = validateEnvironmentSecurity();

    // Additional production checks
    if (process.env.NODE_ENV === "production") {
      const prodCheck = validateProductionSecurity();
      if (!prodCheck.passed) {
        throw new Error(`Production security validation failed: ${prodCheck.criticalIssues.join(", ")}`);
      }
    }

    // Perform security audit
    const audit = performSecurityAudit();
    const criticalVulns = audit.vulnerabilities.filter(v => v.severity === "CRITICAL");
    
    if (criticalVulns.length > 0) {
      throw new Error(`Critical security vulnerabilities found: ${criticalVulns.map(v => v.description).join(", ")}`);
    }

    logger.info("Environment security validation completed successfully", {
      component: "environmentValidation",
      securityScore: audit.score,
      vulnerabilities: audit.vulnerabilities.length
    });

    return config;

  } catch (error) {
    logger.error("Environment security validation failed", {
      component: "environmentValidation",
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}
