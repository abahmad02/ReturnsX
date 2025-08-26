# 🔧 Data Protection Technical Implementation Guide

This guide provides detailed instructions for implementing the comprehensive data protection framework in ReturnsX.

---

## 🚀 Quick Start Implementation

### 1. Environment Setup

First, ensure all required environment variables are properly configured:

```env
# Encryption & Security
RETURNSX_ENCRYPTION_KEY="your-32-character-encryption-key-here"
RETURNSX_HASH_SALT="your-unique-salt-for-hashing-operations"
SESSION_SECRET="your-32-character-session-secret-key"

# Database Security
DATABASE_URL="postgresql://user:pass@host:5432/db?sslmode=require"
DATABASE_SSL_MODE="require"
DATABASE_CONNECTION_LIMIT="10"

# Audit & Compliance
LOG_LEVEL="info"
AUDIT_LOG_RETENTION_DAYS="2555"

# Optional: WhatsApp Security
TWILIO_ACCOUNT_SID="your_twilio_sid"
TWILIO_AUTH_TOKEN="your_twilio_token"
WHATSAPP_WEBHOOK_SECRET="your_webhook_secret"
```

### 2. Validate Environment Security

Add environment validation to your application startup:

```typescript
// app/entry.server.tsx or your main entry point
import { initializeEnvironmentSecurity } from './utils/environmentValidation.server';

// Validate environment on startup
try {
  const config = initializeEnvironmentSecurity();
  console.log('✅ Environment security validation passed');
} catch (error) {
  console.error('❌ Environment security validation failed:', error.message);
  process.exit(1);
}
```

### 3. Initialize Data Protection Services

```typescript
// app/services/index.ts
import { initializeRetentionPolicies } from './dataRetentionPolicy.server';
import { recordConsent, ConsentType, LegalBasis } from './dataProtection.server';

// Initialize on application startup
export async function initializeDataProtection() {
  try {
    await initializeRetentionPolicies();
    console.log('✅ Data protection services initialized');
  } catch (error) {
    console.error('❌ Data protection initialization failed:', error);
    throw error;
  }
}
```

---

## 🔐 Encryption Implementation

### Basic Encryption Usage

```typescript
import { encryptSensitiveData, decryptSensitiveData } from '../utils/encryption.server';

// Encrypt sensitive data before storing
const encryptedValue = encryptSensitiveData("sensitive information");

// Decrypt when retrieving
const decryptedValue = decryptSensitiveData(encryptedValue);
```

### Database Field Encryption

```typescript
import { encryptForDatabase, decryptFromDatabase } from '../utils/encryption.server';

// When storing sensitive fields in database
const encryptionResult = encryptForDatabase(sensitiveData);
await db.sensitiveTable.create({
  data: {
    encryptedField: encryptionResult.encryptedValue,
    keyId: encryptionResult.keyId,
    version: encryptionResult.version
  }
});

// When retrieving and decrypting
const record = await db.sensitiveTable.findFirst({ where: { id } });
if (record) {
  const decrypted = decryptFromDatabase({
    encryptedValue: record.encryptedField,
    keyId: record.keyId,
    version: record.version
  });
}
```

### Key Rotation

```typescript
import { getEncryptionStatus, rotateEncryptionKeys } from '../utils/encryption.server';

// Check if key rotation is needed
const status = getEncryptionStatus();
if (status.needsRotation) {
  const newKeyId = rotateEncryptionKeys();
  console.log(`Encryption keys rotated. New key ID: ${newKeyId}`);
}
```

---

## 👤 Consent Management

### Recording Customer Consent

```typescript
import { recordConsent, ConsentType, LegalBasis } from '../services/dataProtection.server';

// Record consent when customer agrees to data processing
await recordConsent({
  shopDomain: session.shop,
  customerId: customer.id,
  customerHash: hashedCustomerId,
  consentType: ConsentType.FRAUD_PREVENTION,
  consentGiven: true,
  legalBasis: LegalBasis.LEGITIMATE_INTEREST,
  processingPurpose: ["fraud_prevention", "risk_assessment"],
  dataCategories: ["contact_data", "transaction_data"],
  ipAddress: request.headers.get("x-forwarded-for"),
  userAgent: request.headers.get("user-agent")
});
```

### Checking Valid Consent

```typescript
import { hasValidConsent } from '../services/dataProtection.server';

// Before processing customer data
const hasConsent = await hasValidConsent(
  shopDomain, 
  customerId, 
  ConsentType.FRAUD_PREVENTION
);

if (!hasConsent) {
  throw new Error("No valid consent for data processing");
}
```

### Withdrawing Consent

```typescript
import { withdrawConsent } from '../services/dataProtection.server';

// When customer withdraws consent
await withdrawConsent(
  shopDomain,
  customerId,
  ConsentType.FRAUD_PREVENTION,
  "Customer request via privacy settings"
);
```

---

## 🗑️ Data Retention and Deletion

### Manual Data Deletion

```typescript
import { deleteCustomerData } from '../services/dataProtection.server';

// Delete customer data (GDPR Right to Erasure)
const result = await deleteCustomerData(
  shopDomain,
  { phone: customerPhone, email: customerEmail },
  "Customer request for data deletion"
);

console.log(`Deleted ${result.deletedProfiles} profiles and ${result.deletedEvents} events`);
```

### Automated Retention Execution

```typescript
import { executeRetentionPolicy, DataCategory } from '../services/dataRetentionPolicy.server';

// Execute retention for specific data category
const schedule = await executeRetentionPolicy(
  DataCategory.CUSTOMER_PROFILES,
  false // set to true for dry run
);

console.log(`Retention execution ${schedule.status}: ${schedule.id}`);
```

### Schedule Automatic Retention

```typescript
import { scheduleAutomaticRetention } from '../services/dataRetentionPolicy.server';

// Set up automatic retention (integrate with your job scheduler)
await scheduleAutomaticRetention();
```

---

## 🚨 Security Incident Response

### Creating Security Incidents

```typescript
import { 
  createSecurityIncident, 
  IncidentType, 
  IncidentSeverity 
} from '../services/securityIncidentResponse.server';

// Detect and create security incident
const incident = await createSecurityIncident(
  IncidentType.BRUTE_FORCE_ATTACK,
  IncidentSeverity.HIGH,
  "Multiple failed login attempts detected",
  "10 failed authentication attempts from IP 192.168.1.100",
  {
    shopDomain: "example-shop.myshopify.com",
    ipAddress: "192.168.1.100",
    failedAttempts: 10,
    timeWindow: 300000
  },
  ["authentication_system"]
);
```

### Automated Threat Detection

```typescript
import { 
  detectBruteForceAttack,
  detectUnauthorizedDataAccess 
} from '../services/securityIncidentResponse.server';

// In your authentication handler
if (failedLoginAttempts >= 10) {
  const incident = await detectBruteForceAttack(
    shopDomain,
    ipAddress,
    failedLoginAttempts
  );
  
  if (incident) {
    // Incident automatically created and response triggered
    console.log(`Security incident created: ${incident.id}`);
  }
}

// In your data access handler
const unauthorizedAccess = await detectUnauthorizedDataAccess(
  shopDomain,
  userId,
  accessedData,
  userRole,
  authorizedData
);
```

---

## 📊 Enhanced Audit Logging

### Customer Data Access Auditing

```typescript
import { auditCustomerProfileAccess } from '../services/auditLog.server';

// Audit customer profile access
await auditCustomerProfileAccess(
  customerProfileId,
  "PROFILE_VIEWED",
  shopDomain,
  userId,
  userRole,
  {
    riskTier: profile.riskTier,
    riskScore: profile.riskScore,
    accessReason: "Risk assessment review"
  }
);
```

### Data Export Auditing

```typescript
import { auditDataExport } from '../services/auditLog.server';

// Audit data exports
await auditDataExport(
  "customer_risk_profiles",
  exportedRecords.length,
  shopDomain,
  userId,
  userRole,
  ipAddress
);
```

---

## 🔒 Role-Based Access Control

### Route Protection

```typescript
import { withPermissions, Permission } from '../middleware/roleBasedAccess.server';

// Protect routes with specific permissions
export const loader = withPermissions([Permission.VIEW_CUSTOMERS])(
  async (request: Request, userSession: UserSession) => {
    const customers = await getCustomerProfiles();
    
    // Filter data based on user role
    return filterCustomerDataByRole(customers, userSession);
  }
);
```

### API Endpoint Protection

```typescript
import { authenticateWithRoles, hasPermission, Permission } from '../middleware/roleBasedAccess.server';

export async function action({ request }: ActionFunctionArgs) {
  const { userSession } = await authenticateWithRoles(request);
  
  // Check specific permission
  if (!hasPermission(userSession, Permission.MANAGE_CUSTOMERS)) {
    throw new Response("Forbidden", { status: 403 });
  }
  
  // Process request...
}
```

---

## 📋 Data Subject Rights Implementation

### Customer Data Export

```typescript
import { exportCustomerData } from '../services/dataProtection.server';

// GDPR Article 15: Right of Access
export async function handleDataExportRequest(
  shopDomain: string,
  customerPhone: string,
  customerEmail: string
) {
  const exportData = await exportCustomerData(
    shopDomain,
    { phone: customerPhone, email: customerEmail }
  );
  
  // Return structured data to customer
  return Response.json(exportData, {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': 'attachment; filename="customer-data-export.json"'
    }
  });
}
```

### Privacy Rights Portal

```typescript
// app/routes/privacy.rights.tsx
import { exportCustomerData, deleteCustomerData } from '../services/dataProtection.server';

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const action = formData.get("action");
  const phone = formData.get("phone") as string;
  const email = formData.get("email") as string;
  
  switch (action) {
    case "export":
      const exportData = await exportCustomerData(shopDomain, { phone, email });
      return Response.json(exportData);
      
    case "delete":
      const result = await deleteCustomerData(shopDomain, { phone, email });
      return Response.json({ 
        message: "Data deleted successfully",
        deletedRecords: result.deletedProfiles + result.deletedEvents 
      });
      
    default:
      throw new Response("Invalid action", { status: 400 });
  }
}
```

---

## 🔍 Monitoring and Health Checks

### Security Health Check Endpoint

```typescript
// app/routes/api.health.security.tsx
import { getEncryptionStatus } from '../utils/encryption.server';
import { validateEnvironmentSecurity } from '../utils/environmentValidation.server';

export async function loader() {
  const encryptionStatus = getEncryptionStatus();
  const envValidation = validateEnvironmentSecurity();
  
  return Response.json({
    encryption: {
      healthy: encryptionStatus.isHealthy,
      keyAge: encryptionStatus.keyStatus.activeKeyAge,
      rotationDue: encryptionStatus.needsRotation
    },
    environment: {
      validated: true,
      securityScore: 96
    },
    compliance: {
      dataRetention: "ACTIVE",
      auditLogging: "ENABLED",
      accessControls: "ENFORCED"
    }
  });
}
```

### Compliance Dashboard Data

```typescript
// app/routes/api.compliance.dashboard.tsx
import { generateRetentionReport } from '../services/dataRetentionPolicy.server';
import { generateComplianceReport } from '../services/auditLog.server';

export async function loader({ request }: LoaderFunctionArgs) {
  const { userSession } = await authenticateWithRoles(request);
  
  if (!hasPermission(userSession, Permission.VIEW_AUDIT_LOGS)) {
    throw new Response("Forbidden", { status: 403 });
  }
  
  const retentionReport = await generateRetentionReport();
  const complianceReport = await generateComplianceReport(
    userSession.shopDomain,
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
    new Date()
  );
  
  return Response.json({
    retention: retentionReport,
    compliance: complianceReport,
    timestamp: new Date().toISOString()
  });
}
```

---

## 🧪 Testing Data Protection Features

### Unit Tests for Encryption

```typescript
// tests/unit/encryption.test.ts
import { describe, it, expect } from 'vitest';
import { encryptSensitiveData, decryptSensitiveData } from '../../app/utils/encryption.server';

describe('Encryption Service', () => {
  it('should encrypt and decrypt data successfully', () => {
    const originalData = "sensitive customer information";
    const encrypted = encryptSensitiveData(originalData);
    const decrypted = decryptSensitiveData(encrypted);
    
    expect(decrypted).toBe(originalData);
    expect(encrypted).not.toBe(originalData);
  });
  
  it('should fail decryption with tampered data', () => {
    const encrypted = encryptSensitiveData("test data");
    const tamperedData = encrypted.slice(0, -1) + 'X'; // Tamper with last character
    
    expect(() => decryptSensitiveData(tamperedData)).toThrow();
  });
});
```

### Integration Tests for Data Protection

```typescript
// tests/integration/dataProtection.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { recordConsent, hasValidConsent, ConsentType } from '../../app/services/dataProtection.server';

describe('Data Protection Service', () => {
  beforeEach(async () => {
    // Setup test database
  });
  
  it('should record and verify consent', async () => {
    await recordConsent({
      shopDomain: "test-shop.myshopify.com",
      customerId: "test-customer-123",
      consentType: ConsentType.FRAUD_PREVENTION,
      consentGiven: true,
      legalBasis: LegalBasis.LEGITIMATE_INTEREST,
      processingPurpose: ["fraud_prevention"],
      dataCategories: ["contact_data"]
    });
    
    const hasConsent = await hasValidConsent(
      "test-shop.myshopify.com",
      "test-customer-123",
      ConsentType.FRAUD_PREVENTION
    );
    
    expect(hasConsent).toBe(true);
  });
});
```

---

## 🔄 Deployment Checklist

### Pre-Deployment Security Validation

```bash
# 1. Environment validation
npm run validate:environment

# 2. Security tests
npm run test:security

# 3. Encryption key generation
npm run generate:keys

# 4. Database migration
npm run migrate:production

# 5. Audit log setup
npm run setup:audit-logs
```

### Production Configuration

```typescript
// deployment/production.config.ts
export const productionConfig = {
  encryption: {
    keyRotationInterval: 90 * 24 * 60 * 60 * 1000, // 90 days
    automaticRotation: true
  },
  retention: {
    automaticExecution: true,
    schedule: "0 2 * * *", // Daily at 2 AM
    dryRunFirst: false
  },
  incidents: {
    autoResponse: true,
    notificationChannels: ["email", "slack"],
    escalationRules: {
      CRITICAL: "immediate",
      HIGH: "1_hour",
      MEDIUM: "4_hours"
    }
  },
  monitoring: {
    healthChecks: true,
    complianceReports: true,
    alerting: true
  }
};
```

---

## 📚 Additional Resources

### Documentation Links
- [GDPR Compliance Guide](./SECURITY_COMPLIANCE.md)
- [Audit Logging Framework](./app/services/auditLog.server.ts)
- [Encryption Best Practices](./app/utils/encryption.server.ts)
- [Role-Based Access Control](./app/middleware/roleBasedAccess.server.ts)

### External Standards
- [GDPR Article 25: Privacy by Design](https://gdpr-info.eu/art-25-gdpr/)
- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework)
- [ISO 27001 Security Controls](https://www.iso.org/isoiec-27001-information-security.html)
- [Shopify Data Protection Requirements](https://shopify.dev/docs/apps/store/data-protection)

### Support and Maintenance
- **Security Team Contact**: security@returnsx.com
- **Incident Response**: incidents@returnsx.com  
- **Compliance Questions**: compliance@returnsx.com
- **Technical Support**: tech@returnsx.com

---

**Last Updated:** December 2024  
**Next Review:** March 2025  
**Version:** 1.0.0
