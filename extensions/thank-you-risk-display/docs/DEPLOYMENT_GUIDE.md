# Deployment Guide - ReturnsX Thank You Page Extension

## Overview

This guide covers the complete deployment process for the ReturnsX Thank You Page Extension, from development to production. It includes environment setup, testing procedures, and post-deployment monitoring.

## Deployment Environments

### Environment Overview

| Environment | Purpose | API Endpoint | Audience |
|-------------|---------|--------------|----------|
| Development | Local development and testing | `https://dev-api.returnsx.com/v1` | Developers |
| Staging | Pre-production testing | `https://staging-api.returnsx.com/v1` | QA Team, Merchants |
| Production | Live customer-facing | `https://api.returnsx.com/v1` | End Customers |

### Environment Configuration

#### Development Environment
```bash
# Local development setup
cd extensions/thank-you-risk-display
npm install
npm run dev

# Environment variables
RETURNSX_API_ENDPOINT=https://dev-api.returnsx.com/v1
RETURNSX_API_TOKEN=rx_dev_[token]
DEBUG_MODE=true
```

#### Staging Environment
```bash
# Staging deployment
npm run build:staging
shopify app deploy --environment=staging

# Configuration
RETURNSX_API_ENDPOINT=https://staging-api.returnsx.com/v1
RETURNSX_API_TOKEN=rx_staging_[token]
DEBUG_MODE=false
```

#### Production Environment
```bash
# Production deployment
npm run build:production
shopify app deploy --environment=production

# Configuration
RETURNSX_API_ENDPOINT=https://api.returnsx.com/v1
RETURNSX_API_TOKEN=rx_live_[token]
DEBUG_MODE=false
```

## Pre-Deployment Checklist

### Code Quality Checks

```bash
# Run all quality checks
npm run lint                 # ESLint checks
npm run typecheck           # TypeScript validation
npm run test:unit           # Unit tests
npm run test:integration    # Integration tests
npm run test:e2e           # End-to-end tests
npm run build              # Production build
```

### Security Validation

- [ ] No hardcoded API tokens or secrets
- [ ] Customer data hashing implemented correctly
- [ ] HTTPS enforced for all API calls
- [ ] Input validation and sanitization in place
- [ ] Error messages don't expose sensitive information
- [ ] Debug mode disabled in production builds

### Performance Validation

- [ ] Bundle size under 100KB compressed
- [ ] API response times under 500ms
- [ ] Extension load time under 200ms
- [ ] Memory usage optimized
- [ ] Lazy loading implemented for non-critical components

### Functionality Testing

- [ ] All risk tiers display correctly
- [ ] WhatsApp integration works on mobile and desktop
- [ ] Error handling gracefully degrades
- [ ] Configuration settings persist correctly
- [ ] Mobile responsiveness verified
- [ ] Cross-browser compatibility tested

## Deployment Process

### Step 1: Prepare Release

#### Version Management
```bash
# Update version number
npm version patch  # For bug fixes
npm version minor  # For new features
npm version major  # For breaking changes

# Update changelog
echo "## [1.2.3] - $(date +%Y-%m-%d)" >> CHANGELOG.md
echo "### Added" >> CHANGELOG.md
echo "- New feature description" >> CHANGELOG.md
```

#### Build Optimization
```bash
# Clean previous builds
rm -rf dist/
rm -rf node_modules/.cache/

# Install fresh dependencies
npm ci

# Build optimized bundle
npm run build:production

# Verify build output
ls -la dist/
du -sh dist/*
```

### Step 2: Deploy to Staging

#### Staging Deployment
```bash
# Deploy to staging environment
shopify app deploy --environment=staging

# Verify deployment
curl -X GET "https://staging-api.returnsx.com/v1/health" \
  -H "Authorization: Bearer $STAGING_API_TOKEN"
```

#### Staging Testing
```bash
# Run automated tests against staging
npm run test:staging

# Manual testing checklist
# - Place test orders with different risk profiles
# - Test WhatsApp integration
# - Verify mobile responsiveness
# - Test error scenarios
```

### Step 3: Production Deployment

#### Pre-Production Validation
```bash
# Final security scan
npm audit --audit-level=moderate

# Performance benchmark
npm run benchmark

# Configuration validation
npm run validate:config
```

#### Production Release
```bash
# Deploy to production
shopify app deploy --environment=production

# Verify production deployment
curl -X GET "https://api.returnsx.com/v1/health" \
  -H "Authorization: Bearer $PRODUCTION_API_TOKEN"

# Monitor initial deployment
npm run monitor:deployment
```

### Step 4: Post-Deployment Verification

#### Health Checks
```bash
# API connectivity test
curl -X POST "https://api.returnsx.com/v1/risk-profile" \
  -H "Authorization: Bearer $PRODUCTION_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"phone":"test_hash","orderId":"test_order"}'

# Extension availability test
# Visit test store and place order
# Verify extension appears on thank you page
```

#### Performance Monitoring
```javascript
// Monitor key metrics
const metrics = {
  apiResponseTime: '<500ms',
  extensionLoadTime: '<200ms',
  errorRate: '<1%',
  successRate: '>99%'
};

// Set up alerts for threshold breaches
```

## Configuration Management

### Environment-Specific Settings

#### Development Configuration
```json
{
  "apiEndpoint": "https://dev-api.returnsx.com/v1",
  "debugMode": true,
  "caching": {
    "enabled": false,
    "duration": 60
  },
  "performance": {
    "enableLazyLoading": false,
    "enableMemoization": false
  }
}
```

#### Production Configuration
```json
{
  "apiEndpoint": "https://api.returnsx.com/v1",
  "debugMode": false,
  "caching": {
    "enabled": true,
    "duration": 300
  },
  "performance": {
    "enableLazyLoading": true,
    "enableMemoization": true
  }
}
```

### Configuration Validation

```typescript
// Configuration validation schema
const configSchema = {
  apiEndpoint: {
    type: 'string',
    pattern: /^https:\/\/.+/,
    required: true
  },
  authToken: {
    type: 'string',
    pattern: /^rx_(live|test|dev)_[a-f0-9]{64}$/,
    required: true
  },
  debugMode: {
    type: 'boolean',
    default: false
  }
};

// Validate configuration before deployment
function validateConfig(config: ExtensionConfig): ValidationResult {
  // Implementation details
}
```

## Rollback Procedures

### Automatic Rollback Triggers

```javascript
// Conditions that trigger automatic rollback
const rollbackTriggers = {
  errorRate: 5,        // >5% error rate
  responseTime: 2000,  // >2 second response time
  availability: 95     // <95% availability
};

// Monitor these metrics and trigger rollback if thresholds exceeded
```

### Manual Rollback Process

#### Emergency Rollback
```bash
# Immediate rollback to previous version
shopify app rollback --version=previous

# Disable extension in theme customizer
# (Manual step for immediate relief)

# Verify rollback successful
curl -X GET "https://api.returnsx.com/v1/health"
```

#### Planned Rollback
```bash
# Rollback to specific version
shopify app rollback --version=1.2.2

# Update configuration if needed
shopify app configure --environment=production

# Verify functionality
npm run test:production
```

### Rollback Verification

- [ ] Extension loads without errors
- [ ] API connectivity restored
- [ ] Performance metrics within acceptable range
- [ ] No customer-facing issues reported
- [ ] Monitoring alerts cleared

## Monitoring and Alerting

### Key Performance Indicators (KPIs)

#### Technical Metrics
```javascript
const technicalKPIs = {
  availability: {
    target: 99.9,
    measurement: 'percentage uptime'
  },
  responseTime: {
    target: 500,
    measurement: 'milliseconds (95th percentile)'
  },
  errorRate: {
    target: 1,
    measurement: 'percentage of failed requests'
  },
  loadTime: {
    target: 200,
    measurement: 'milliseconds to first render'
  }
};
```

#### Business Metrics
```javascript
const businessKPIs = {
  adoption: {
    target: 80,
    measurement: 'percentage of eligible orders showing extension'
  },
  engagement: {
    target: 15,
    measurement: 'percentage of customers clicking WhatsApp'
  },
  satisfaction: {
    target: 4.5,
    measurement: 'average customer rating (1-5 scale)'
  }
};
```

### Monitoring Setup

#### Application Performance Monitoring (APM)
```javascript
// Performance monitoring integration
import { PerformanceMonitor } from './services/performanceMonitor';

// Track API calls
PerformanceMonitor.trackApiCall('risk-profile', duration, success);

// Track component renders
PerformanceMonitor.trackComponentRender('RiskAssessmentCard', renderTime);

// Track user interactions
PerformanceMonitor.trackUserInteraction('whatsapp-click', metadata);
```

#### Error Tracking
```javascript
// Error tracking setup
import { ErrorTracker } from './services/errorTracker';

// Capture exceptions
try {
  await apiClient.getRiskProfile(request);
} catch (error) {
  ErrorTracker.captureError(error, {
    component: 'RiskAssessmentCard',
    userId: hashedCustomerId,
    orderId: order.id
  });
}
```

#### Custom Dashboards
```javascript
// Dashboard metrics configuration
const dashboardConfig = {
  widgets: [
    {
      type: 'line-chart',
      title: 'API Response Time',
      metric: 'api.response_time',
      timeRange: '24h'
    },
    {
      type: 'counter',
      title: 'Total Requests',
      metric: 'api.requests.count',
      timeRange: '1h'
    },
    {
      type: 'gauge',
      title: 'Error Rate',
      metric: 'api.error_rate',
      threshold: 5
    }
  ]
};
```

### Alerting Configuration

#### Critical Alerts (Immediate Response)
```yaml
# Critical alerts configuration
alerts:
  - name: "Extension Down"
    condition: "availability < 95%"
    duration: "2m"
    channels: ["pager", "slack", "email"]
    
  - name: "High Error Rate"
    condition: "error_rate > 5%"
    duration: "5m"
    channels: ["pager", "slack"]
    
  - name: "API Timeout"
    condition: "response_time > 5000ms"
    duration: "3m"
    channels: ["slack", "email"]
```

#### Warning Alerts (Business Hours Response)
```yaml
warning_alerts:
  - name: "Performance Degradation"
    condition: "response_time > 1000ms"
    duration: "10m"
    channels: ["slack"]
    
  - name: "Low Adoption Rate"
    condition: "adoption_rate < 70%"
    duration: "1h"
    channels: ["email"]
```

## Security Considerations

### Deployment Security

#### Secure Token Management
```bash
# Use environment variables for sensitive data
export RETURNSX_API_TOKEN="rx_live_$(cat /secure/api-token)"
export SHOPIFY_API_SECRET="$(cat /secure/shopify-secret)"

# Never commit tokens to version control
echo "*.env" >> .gitignore
echo "secrets/" >> .gitignore
```

#### Access Control
```yaml
# Deployment access control
deployment_access:
  production:
    required_approvals: 2
    approved_users: ["lead-dev", "security-team"]
    restricted_hours: "09:00-17:00 UTC"
    
  staging:
    required_approvals: 1
    approved_users: ["dev-team", "qa-team"]
```

### Runtime Security

#### Content Security Policy (CSP)
```javascript
// CSP headers for extension
const cspPolicy = {
  'default-src': "'self'",
  'connect-src': "'self' https://api.returnsx.com https://wa.me",
  'script-src': "'self' 'unsafe-inline'",
  'style-src': "'self' 'unsafe-inline'",
  'img-src': "'self' data: https:",
  'font-src': "'self'"
};
```

#### Input Validation
```typescript
// Validate all inputs before processing
function validateRiskProfileRequest(request: RiskProfileRequest): boolean {
  return (
    isValidHash(request.phone) &&
    isValidHash(request.email) &&
    isValidOrderId(request.orderId)
  );
}
```

## Disaster Recovery

### Backup Procedures

#### Configuration Backup
```bash
# Backup extension configuration
shopify app config export --output=backup/config-$(date +%Y%m%d).json

# Backup theme customizer settings
# (Manual export from Shopify admin)
```

#### Code Backup
```bash
# Tag stable releases
git tag -a v1.2.3 -m "Production release 1.2.3"
git push origin v1.2.3

# Backup to multiple repositories
git remote add backup git@backup-server:returnsx/extension.git
git push backup main
```

### Recovery Procedures

#### Service Outage Recovery
```bash
# If ReturnsX API is down
# Extension automatically shows fallback content
# No manual intervention required

# Monitor service status
curl -X GET "https://status.returnsx.com/api/v2/status.json"
```

#### Extension Failure Recovery
```bash
# Disable extension immediately
# (Manual step in Shopify admin)

# Deploy previous stable version
shopify app rollback --version=v1.2.2

# Verify recovery
npm run test:production
```

#### Data Recovery
```bash
# If customer data is affected
# Contact ReturnsX support immediately
# Extension uses hashed data only - no raw PII at risk

# Verify data integrity
npm run verify:data-integrity
```

## Maintenance Procedures

### Regular Maintenance Tasks

#### Weekly Tasks
- [ ] Review performance metrics
- [ ] Check error logs
- [ ] Verify API connectivity
- [ ] Monitor resource usage

#### Monthly Tasks
- [ ] Update dependencies
- [ ] Rotate API tokens
- [ ] Review security logs
- [ ] Performance optimization review

#### Quarterly Tasks
- [ ] Security audit
- [ ] Disaster recovery test
- [ ] Documentation updates
- [ ] Staff training updates

### Maintenance Windows

#### Scheduled Maintenance
```yaml
maintenance_windows:
  weekly:
    day: "Sunday"
    time: "02:00-04:00 UTC"
    duration: "2 hours"
    
  monthly:
    day: "First Sunday"
    time: "01:00-05:00 UTC"
    duration: "4 hours"
```

#### Emergency Maintenance
```bash
# Emergency maintenance procedure
1. Assess impact and urgency
2. Notify stakeholders
3. Implement fix or rollback
4. Verify resolution
5. Post-incident review
```

## Documentation and Training

### Deployment Documentation

#### Runbooks
- [API Integration Runbook](./API_INTEGRATION_RUNBOOK.md)
- [Incident Response Runbook](./INCIDENT_RESPONSE_RUNBOOK.md)
- [Performance Tuning Guide](./PERFORMANCE_TUNING_GUIDE.md)

#### Standard Operating Procedures (SOPs)
- Deployment checklist
- Rollback procedures
- Incident escalation
- Security protocols

### Team Training

#### Developer Training
- Extension architecture overview
- Deployment process walkthrough
- Troubleshooting common issues
- Security best practices

#### Operations Training
- Monitoring and alerting
- Incident response procedures
- Performance optimization
- Customer support escalation

## Compliance and Auditing

### Compliance Requirements

#### Data Protection
- GDPR compliance verification
- Customer data handling audit
- Privacy policy updates
- Data retention compliance

#### Security Standards
- OWASP security checklist
- Penetration testing results
- Vulnerability assessments
- Security training completion

### Audit Trail

#### Deployment Audit
```json
{
  "deploymentId": "dep_20240115_001",
  "version": "1.2.3",
  "environment": "production",
  "deployedBy": "john.doe@returnsx.com",
  "timestamp": "2024-01-15T10:30:00Z",
  "approvals": [
    {
      "approver": "jane.smith@returnsx.com",
      "timestamp": "2024-01-15T09:45:00Z"
    }
  ],
  "tests": {
    "unit": "passed",
    "integration": "passed",
    "security": "passed"
  }
}
```

#### Change Management
- All changes tracked in version control
- Deployment approvals documented
- Rollback decisions recorded
- Performance impact measured

## Support and Escalation

### Support Tiers

#### Tier 1: Self-Service
- Documentation and guides
- Automated diagnostics
- Community forums
- FAQ and troubleshooting

#### Tier 2: Technical Support
- Email support (24-48 hour response)
- Configuration assistance
- Integration guidance
- Performance optimization

#### Tier 3: Engineering Support
- Critical issue escalation
- Custom development requests
- Architecture consultation
- Emergency response (24/7)

### Escalation Procedures

#### Issue Severity Levels
```yaml
severity_levels:
  critical:
    description: "Extension completely broken, affecting all customers"
    response_time: "15 minutes"
    escalation: "Immediate to engineering team"
    
  high:
    description: "Significant functionality impaired"
    response_time: "2 hours"
    escalation: "Technical support team"
    
  medium:
    description: "Minor functionality issues"
    response_time: "24 hours"
    escalation: "Standard support queue"
    
  low:
    description: "Enhancement requests, documentation"
    response_time: "72 hours"
    escalation: "Product team review"
```

## Conclusion

This deployment guide provides a comprehensive framework for safely and efficiently deploying the ReturnsX Thank You Page Extension. Following these procedures ensures:

- Reliable and secure deployments
- Minimal downtime and customer impact
- Proper monitoring and alerting
- Quick recovery from issues
- Compliance with security standards

For questions or clarification on any deployment procedures, contact the ReturnsX engineering team at engineering@returnsx.com.