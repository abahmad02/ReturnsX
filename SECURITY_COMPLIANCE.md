# ReturnsX Security & Compliance Guide

This document provides comprehensive security guidelines and compliance frameworks for deploying and operating ReturnsX in production environments.

## Table of Contents

1. [Environmental Security](#environmental-security)
2. [API Security](#api-security)
3. [Data Protection & Privacy](#data-protection--privacy)
4. [Role-Based Access Control](#role-based-access-control)
5. [Audit & Monitoring](#audit--monitoring)
6. [Rate Limiting & DoS Protection](#rate-limiting--dos-protection)
7. [GDPR & Local Compliance](#gdpr--local-compliance)
8. [Production Deployment](#production-deployment)
9. [Incident Response](#incident-response)
10. [Compliance Checklist](#compliance-checklist)

## Environmental Security

### Environment Variables Management

#### Required Security Environment Variables

```env
# Database Security
DATABASE_URL="postgresql://username:strong_password@host:5432/returnsx_production"
DATABASE_SSL_MODE="require"
DATABASE_CONNECTION_LIMIT="10"

# Encryption & Hashing
RETURNSX_ENCRYPTION_KEY="32-character-random-key-for-aes-256-encryption"
RETURNSX_HASH_SALT="unique-salt-for-pii-hashing-sha256-operations"

# Shopify App Security
SHOPIFY_API_KEY="your_shopify_api_key"
SHOPIFY_API_SECRET="your_shopify_api_secret"
SHOPIFY_SCOPES="read_orders,read_customers,read_fulfillments,read_refunds"

# Session Security
SESSION_SECRET="32-character-random-session-secret-key"
SESSION_SECURE="true"  # HTTPS only in production
SESSION_SAME_SITE="strict"

# Logging & Monitoring
LOG_LEVEL="info"  # info, warn, error for production
AUDIT_LOG_RETENTION_DAYS="2555"  # 7 years for financial compliance

# Rate Limiting
RATE_LIMIT_REDIS_URL="redis://localhost:6379"  # For distributed rate limiting
RATE_LIMIT_MEMORY_CLEANUP_INTERVAL="300000"   # 5 minutes

# WhatsApp Security (if enabled)
TWILIO_ACCOUNT_SID="your_secure_twilio_sid"
TWILIO_AUTH_TOKEN="your_secure_twilio_token"
WHATSAPP_WEBHOOK_SECRET="webhook-signature-verification-secret"
```

#### Environment Variable Security Best Practices

1. **Never Commit Secrets**: Use `.env.local` for development, never commit to version control
2. **Rotation Policy**: Rotate all secrets every 90 days minimum
3. **Strong Generation**: Use cryptographically secure random generators
4. **Access Control**: Limit environment variable access to necessary personnel only
5. **Encryption at Rest**: Store environment variables encrypted in production systems

#### Secret Management in Production

```bash
# Example using AWS Secrets Manager
aws secretsmanager create-secret \
  --name "returnsx/production/database" \
  --description "ReturnsX Production Database URL" \
  --secret-string '{"DATABASE_URL":"postgresql://..."}'

# Example using Docker Secrets
echo "your_encryption_key" | docker secret create returnsx_encryption_key -

# Example using Kubernetes Secrets
kubectl create secret generic returnsx-secrets \
  --from-literal=DATABASE_URL="postgresql://..." \
  --from-literal=RETURNSX_ENCRYPTION_KEY="..."
```

### Infrastructure Security

#### Network Security
- **HTTPS Only**: All traffic must use TLS 1.2+
- **Firewall Rules**: Restrict access to database and Redis to application servers only
- **VPC Isolation**: Deploy in private subnets with controlled internet access
- **DDoS Protection**: Use CloudFlare, AWS Shield, or similar

#### Database Security
- **Connection Encryption**: Always use SSL/TLS for database connections
- **Access Controls**: Use dedicated database users with minimal required permissions
- **Backup Encryption**: Encrypt all database backups
- **Regular Updates**: Keep database software updated with security patches

## API Security

### Authentication & Authorization

ReturnsX implements multi-layered security:

1. **Shopify OAuth**: Primary authentication via Shopify App Bridge
2. **Role-Based Access Control**: Granular permissions based on user roles
3. **Session Management**: Secure session handling with appropriate timeouts
4. **API Rate Limiting**: Comprehensive rate limiting across all endpoints

#### Role Hierarchy

```
STORE_OWNER (Full Access)
├── ORDER_MANAGER (Customer Management, Analytics)
├── SUPPORT_AGENT (WhatsApp Communication)
├── SHIPPER (Delivery Information)
└── VIEWER (Read-Only Dashboard)
```

### Rate Limiting Configuration

| Endpoint Type | Window | Limit | Use Case |
|---------------|--------|-------|----------|
| Authentication | 15 min | 5 requests | Prevent brute force |
| Customer Profile | 1 min | 30 requests | Normal operations |
| WhatsApp API | 1 min | 10 requests | Prevent spam |
| Webhook Processing | 1 min | 100 requests | Handle Shopify traffic |
| Bulk Operations | 1 hour | 5 requests | Prevent abuse |
| Data Export | 24 hours | 3 requests | Privacy protection |

### Request Validation

All API endpoints implement:
- Input sanitization and validation
- SQL injection prevention (using Prisma ORM)
- Cross-site scripting (XSS) protection
- CSRF protection via SameSite cookies

## Data Protection & Privacy

### PII Handling Strategy

ReturnsX implements **Privacy by Design**:

#### Data Minimization
- **Only Necessary Data**: Store only customer identifiers required for risk assessment
- **Hashed Storage**: All PII stored as SHA-256 hashes with unique salts
- **No Raw PII**: Raw phone numbers, emails, addresses never stored
- **Limited Retention**: Automatic data purging based on retention policies

#### Hashing Implementation
```typescript
// Customer phone numbers
const phoneHash = createSecureHash(`${SALT}:${normalizedPhone}`);

// SHA-256 with salt ensures:
// - One-way encryption (irreversible)
// - Consistent identification
// - Privacy protection
// - Compliance with data protection laws
```

#### Data Flow Security
1. **Ingress**: Raw PII → Immediate hashing → Secure storage
2. **Processing**: Hash-based operations only
3. **Egress**: Hashed identifiers only, never raw PII
4. **Logging**: Partial hashes only for audit trails

### Secure Communication

#### WhatsApp Integration Security
- **No PII in Messages**: Customer identifiers hashed in logs
- **Secure Templates**: Pre-approved message templates only
- **Audit Trail**: All communications logged for compliance
- **Rate Limiting**: Prevent spam and abuse

#### API Communication
- **TLS 1.2+ Only**: All API communication encrypted
- **Certificate Pinning**: Verify server certificates
- **Request Signing**: HMAC verification for webhooks
- **No Sensitive Data in URLs**: All sensitive data in request bodies

## Role-Based Access Control

### Permission Matrix

| Permission | Store Owner | Order Manager | Support Agent | Shipper | Viewer |
|------------|-------------|---------------|---------------|---------|--------|
| View Customers | ✅ | ✅ | ✅ | ✅ | ✅ |
| Manage Customers | ✅ | ✅ | ❌ | ❌ | ❌ |
| Apply Overrides | ✅ | ✅ | ❌ | ❌ | ❌ |
| Risk Analytics | ✅ | ✅ | ❌ | ✅ | ✅ |
| Risk Configuration | ✅ | ❌ | ❌ | ❌ | ❌ |
| WhatsApp Messages | ✅ | ✅ | ✅ | ❌ | ❌ |
| System Management | ✅ | ❌ | ❌ | ❌ | ❌ |
| Audit Logs | ✅ | ✅ | ❌ | ❌ | ❌ |
| Data Export | ✅ | ❌ | ❌ | ❌ | ❌ |

### Implementation Example

```typescript
// Route protection with role-based access
export const loader = withPermissions([Permission.VIEW_CUSTOMERS])(
  async (request: Request, userSession: UserSession) => {
    // Only users with VIEW_CUSTOMERS permission can access
    const customers = await getCustomerProfiles();
    
    // Filter data based on user role
    return filterCustomerDataByRole(customers, userSession);
  }
);
```

## Audit & Monitoring

### Comprehensive Audit Logging

All significant events are logged with:
- **User Context**: User ID, role, session information
- **Action Details**: What was done, when, and why
- **Resource Information**: What data was accessed or modified
- **Request Context**: IP address, user agent, request details
- **Outcome**: Success/failure with error details

#### Critical Events for Audit

1. **Authentication Events**
   - User login/logout
   - Failed authentication attempts
   - Session timeouts

2. **Data Access Events**
   - Customer profile views
   - Risk score calculations
   - Manual overrides applied

3. **System Events**
   - Configuration changes
   - Webhook processing
   - Data exports

4. **Communication Events**
   - WhatsApp messages sent/received
   - Risk assessments performed
   - Checkout enforcement triggered

### Monitoring & Alerting

#### Real-Time Security Monitoring

```typescript
// Example security event detection
if (failedLoginAttempts > 5) {
  await auditSecurityEvent(
    "BRUTE_FORCE_ATTEMPT",
    "Multiple failed login attempts detected",
    shopDomain,
    userId,
    ipAddress,
    { attemptCount: failedLoginAttempts },
    "CRITICAL"
  );
}
```

#### Key Metrics to Monitor
- Failed authentication rates
- API error rates and response times
- Rate limit violations
- Data access patterns
- Security event frequency

## Rate Limiting & DoS Protection

### Multi-Layer Protection

1. **Application Layer**: Custom rate limiting middleware
2. **Infrastructure Layer**: Load balancer and CDN protection
3. **Database Layer**: Connection pooling and query optimization

### Rate Limiting Strategies

#### Adaptive Rate Limiting
```typescript
// Different limits for different user types
const rateLimitConfig = {
  store_owner: { windowMs: 60000, maxRequests: 100 },
  order_manager: { windowMs: 60000, maxRequests: 50 },
  support_agent: { windowMs: 60000, maxRequests: 30 },
  viewer: { windowMs: 60000, maxRequests: 20 }
};
```

#### Distributed Rate Limiting
For production deployments:
- Use Redis for shared rate limiting state
- Implement sliding window algorithms
- Configure graceful degradation

## GDPR & Local Compliance

### Pakistan Data Protection Laws

#### Personal Data Protection Act (PDPA) - Emerging Legislation
Pakistan is developing comprehensive data protection legislation similar to GDPR:

1. **Data Processing Principles**
   - Lawfulness, fairness, and transparency
   - Purpose limitation
   - Data minimization
   - Accuracy
   - Storage limitation
   - Security
   - Accountability

2. **Individual Rights** (Expected)
   - Right to information
   - Right of access
   - Right to rectification
   - Right to erasure
   - Right to restrict processing
   - Right to data portability

#### ReturnsX Compliance Strategy

**Current Implementation:**
- ✅ Data minimization (hashed PII only)
- ✅ Purpose limitation (COD risk assessment only)
- ✅ Security measures (encryption, access controls)
- ✅ Audit logging (accountability)

**Future-Proof Features:**
- ✅ Data export functionality (portability rights)
- ✅ Retention policies (storage limitation)
- ✅ Access controls (data subject requests)

### GDPR Compliance

#### Article 25: Data Protection by Design

ReturnsX implements privacy by design:

1. **Pseudonymization**: All customer identifiers hashed
2. **Data Minimization**: Only necessary data collected
3. **Purpose Limitation**: Data used only for stated purpose
4. **Storage Limitation**: Automatic retention policy enforcement
5. **Technical Safeguards**: Encryption, access controls, audit logs

#### Article 32: Security of Processing

Technical and organizational measures:

1. **Encryption**: TLS 1.2+ transport, AES-256 storage
2. **Access Controls**: Role-based permissions
3. **Audit Logging**: Comprehensive event tracking
4. **Incident Response**: Security event detection and response
5. **Regular Testing**: Security assessment procedures

#### Article 35: Data Protection Impact Assessment (DPIA)

**Processing Activities Requiring DPIA:**
- Automated risk profiling of customers
- Processing of personal data for credit assessment
- Large-scale monitoring of customer behavior

**DPIA Outcome for ReturnsX:**
- **Low Risk**: Due to hash-only storage and purpose limitation
- **Appropriate Safeguards**: Implemented technical measures
- **Consultation**: Regular review with data protection experts

### Data Subject Rights Implementation

#### Right of Access (Article 15)
```typescript
export async function exportCustomerData(phoneHash: string): Promise<CustomerDataExport> {
  return {
    personalData: {
      identifier: phoneHash, // Hashed only
      riskTier: profile.riskTier,
      riskScore: profile.riskScore,
      dataProcessed: "COD risk assessment"
    },
    processingPurpose: "Cash-on-delivery risk evaluation",
    legalBasis: "Legitimate interest (fraud prevention)",
    retentionPeriod: "7 years (financial compliance)",
    dataSource: "Shopify order data",
    recipients: "Internal processing only"
  };
}
```

#### Right to Erasure (Article 17)
```typescript
export async function deleteCustomerData(phoneHash: string, reason: string): Promise<void> {
  // Anonymize rather than delete for risk model integrity
  await anonymizeCustomerProfile(phoneHash);
  
  await auditDataRetention(
    "CUSTOMER_DATA_DELETED",
    phoneHash,
    reason,
    "GDPR_RIGHT_TO_ERASURE"
  );
}
```

## Production Deployment

### Security Checklist

#### Pre-Deployment Security Review

- [ ] All environment variables encrypted and secured
- [ ] Database connections use SSL/TLS
- [ ] Application uses HTTPS only
- [ ] Rate limiting configured and tested
- [ ] Audit logging enabled and monitored
- [ ] Role-based access control implemented
- [ ] Input validation on all endpoints
- [ ] Error handling doesn't leak information
- [ ] Security headers configured
- [ ] Dependency vulnerability scan completed

#### Infrastructure Security

```yaml
# Example Docker security configuration
version: '3.8'
services:
  returnsx-app:
    image: returnsx:latest
    read_only: true
    cap_drop:
      - ALL
    cap_add:
      - NET_BIND_SERVICE
    user: "1001:1001"
    security_opt:
      - no-new-privileges:true
    environment:
      - NODE_ENV=production
    secrets:
      - database_url
      - encryption_key
      - shopify_secret
```

#### Database Security Configuration

```sql
-- Create dedicated application user
CREATE USER returnsx_app WITH PASSWORD 'strong_random_password';

-- Grant minimal required permissions
GRANT CONNECT ON DATABASE returnsx_production TO returnsx_app;
GRANT USAGE ON SCHEMA public TO returnsx_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO returnsx_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO returnsx_app;

-- Revoke unnecessary permissions
REVOKE CREATE ON SCHEMA public FROM returnsx_app;
```

### Monitoring & Alerting Setup

#### Security Monitoring Dashboards

1. **Authentication Metrics**
   - Login success/failure rates
   - Session duration patterns
   - Geographic login distribution

2. **API Security Metrics**
   - Rate limit violations by endpoint
   - Error rates and types
   - Response time anomalies

3. **Data Access Patterns**
   - Customer profile access frequency
   - Manual override frequency
   - Data export requests

#### Alert Configuration

```yaml
# Example Prometheus alerts
groups:
  - name: returnsx_security
    rules:
      - alert: HighFailedLoginRate
        expr: rate(returnsx_failed_logins_total[5m]) > 0.1
        for: 2m
        labels:
          severity: warning
        annotations:
          summary: "High failed login rate detected"
          
      - alert: RateLimitViolation
        expr: rate(returnsx_rate_limit_exceeded_total[1m]) > 1
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Rate limit violations detected"
```

## Incident Response

### Security Incident Classification

#### Severity Levels

1. **Critical (P0)**
   - Data breach or unauthorized access
   - System compromise
   - Widespread service disruption

2. **High (P1)**
   - Authentication bypass
   - Privilege escalation
   - DoS attacks

3. **Medium (P2)**
   - Rate limit violations
   - Failed authentication attempts
   - Configuration issues

4. **Low (P3)**
   - Audit log anomalies
   - Performance degradation
   - Non-critical security warnings

### Incident Response Procedures

#### Immediate Response (0-30 minutes)

1. **Detection & Assessment**
   - Monitor security alerts
   - Assess scope and impact
   - Classify incident severity

2. **Containment**
   - Isolate affected systems
   - Block malicious traffic
   - Preserve forensic evidence

3. **Communication**
   - Notify incident response team
   - Inform stakeholders as appropriate
   - Document all actions

#### Investigation & Recovery (30 minutes - 24 hours)

1. **Forensic Analysis**
   - Analyze audit logs
   - Identify attack vectors
   - Assess data impact

2. **Recovery Planning**
   - Develop remediation plan
   - Test recovery procedures
   - Implement fixes

3. **Monitoring**
   - Enhanced monitoring
   - Validation of fixes
   - Continued threat assessment

#### Post-Incident Activities (24-72 hours)

1. **Documentation**
   - Complete incident report
   - Lessons learned analysis
   - Update procedures

2. **Regulatory Notification**
   - GDPR breach notification (72 hours)
   - Local authority notification
   - Customer notification (if required)

## Compliance Checklist

### Daily Operations

- [ ] Monitor security alerts and logs
- [ ] Review failed authentication attempts
- [ ] Check rate limiting effectiveness
- [ ] Validate backup integrity
- [ ] Update security documentation

### Weekly Reviews

- [ ] Audit user access permissions
- [ ] Review data retention compliance
- [ ] Check certificate expiration dates
- [ ] Analyze security metrics trends
- [ ] Update threat intelligence

### Monthly Assessments

- [ ] Vulnerability scanning
- [ ] Penetration testing (quarterly)
- [ ] Access control review
- [ ] Incident response testing
- [ ] Compliance gap analysis

### Annual Compliance

- [ ] Full security audit
- [ ] Data protection impact assessment
- [ ] Business continuity testing
- [ ] Staff security training
- [ ] Policy and procedure updates

## Security Contact Information

### Incident Reporting
- **Security Email**: security@returnsx.com
- **Emergency Phone**: +92-XXX-XXXXXXX
- **PGP Key**: Available on website

### Compliance Queries
- **Privacy Officer**: privacy@returnsx.com
- **Legal Counsel**: legal@returnsx.com
- **Data Protection**: dpo@returnsx.com

### External Resources
- **Pakistan Telecommunications Authority**: https://www.pta.gov.pk
- **EU GDPR Resources**: https://gdpr.eu
- **OWASP Security Guidelines**: https://owasp.org

---

**Document Version**: 1.0  
**Last Updated**: 2024  
**Next Review**: Annual  
**Classification**: Internal Use Only 