#!/usr/bin/env node

/**
 * Production Health Check Script
 * Verifies that the extension is properly deployed and functioning
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// Configuration
const CONFIG_PATH = path.join(__dirname, '../config/production.json');
const HEALTH_CHECK_TIMEOUT = 10000;
const MAX_RETRIES = 3;

// Colors for console output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

class HealthChecker {
  constructor() {
    this.config = this.loadConfig();
    this.results = [];
  }

  loadConfig() {
    try {
      const configData = fs.readFileSync(CONFIG_PATH, 'utf8');
      return JSON.parse(configData);
    } catch (error) {
      this.log('error', `Failed to load configuration: ${error.message}`);
      process.exit(1);
    }
  }

  log(level, message) {
    const timestamp = new Date().toISOString();
    const color = colors[level === 'error' ? 'red' : level === 'success' ? 'green' : level === 'warning' ? 'yellow' : 'blue'];
    console.log(`${color}[${timestamp}] ${level.toUpperCase()}: ${message}${colors.reset}`);
  }

  async makeRequest(url, options = {}) {
    return new Promise((resolve, reject) => {
      const request = https.request(url, {
        timeout: HEALTH_CHECK_TIMEOUT,
        ...options
      }, (response) => {
        let data = '';
        response.on('data', chunk => data += chunk);
        response.on('end', () => {
          resolve({
            statusCode: response.statusCode,
            headers: response.headers,
            data: data
          });
        });
      });

      request.on('error', reject);
      request.on('timeout', () => {
        request.destroy();
        reject(new Error('Request timeout'));
      });

      if (options.body) {
        request.write(options.body);
      }
      
      request.end();
    });
  }

  async checkApiEndpoint() {
    this.log('info', 'Checking API endpoint connectivity...');
    
    try {
      const response = await this.makeRequest(`${this.config.api.baseUrl}/health`, {
        method: 'GET',
        headers: {
          'User-Agent': 'ReturnsX-Extension-HealthCheck/1.0'
        }
      });

      if (response.statusCode === 200) {
        this.results.push({ check: 'API Endpoint', status: 'PASS', message: 'API is accessible' });
        this.log('success', 'API endpoint is healthy');
        return true;
      } else {
        this.results.push({ check: 'API Endpoint', status: 'FAIL', message: `HTTP ${response.statusCode}` });
        this.log('error', `API endpoint returned status ${response.statusCode}`);
        return false;
      }
    } catch (error) {
      this.results.push({ check: 'API Endpoint', status: 'FAIL', message: error.message });
      this.log('error', `API endpoint check failed: ${error.message}`);
      return false;
    }
  }

  async checkAuthentication() {
    this.log('info', 'Checking authentication endpoint...');
    
    try {
      const response = await this.makeRequest(this.config.authentication.tokenEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'ReturnsX-Extension-HealthCheck/1.0'
        },
        body: JSON.stringify({
          grant_type: 'client_credentials',
          client_id: 'health-check'
        })
      });

      if (response.statusCode === 200 || response.statusCode === 401) {
        // 401 is expected for health check without valid credentials
        this.results.push({ check: 'Authentication', status: 'PASS', message: 'Auth endpoint is responsive' });
        this.log('success', 'Authentication endpoint is healthy');
        return true;
      } else {
        this.results.push({ check: 'Authentication', status: 'FAIL', message: `HTTP ${response.statusCode}` });
        this.log('error', `Authentication endpoint returned status ${response.statusCode}`);
        return false;
      }
    } catch (error) {
      this.results.push({ check: 'Authentication', status: 'FAIL', message: error.message });
      this.log('error', `Authentication check failed: ${error.message}`);
      return false;
    }
  }

  async checkMonitoringEndpoints() {
    this.log('info', 'Checking monitoring endpoints...');
    
    const endpoints = [
      { name: 'Error Reporting', url: this.config.monitoring.errorReporting.endpoint },
      { name: 'Performance Monitoring', url: this.config.monitoring.performance.endpoint },
      { name: 'Analytics', url: this.config.monitoring.analytics.endpoint }
    ];

    let allHealthy = true;

    for (const endpoint of endpoints) {
      try {
        const response = await this.makeRequest(`${endpoint.url}/health`, {
          method: 'GET',
          headers: {
            'User-Agent': 'ReturnsX-Extension-HealthCheck/1.0'
          }
        });

        if (response.statusCode === 200 || response.statusCode === 404) {
          // 404 is acceptable for monitoring endpoints that might not have health checks
          this.results.push({ check: endpoint.name, status: 'PASS', message: 'Endpoint is accessible' });
          this.log('success', `${endpoint.name} endpoint is healthy`);
        } else {
          this.results.push({ check: endpoint.name, status: 'FAIL', message: `HTTP ${response.statusCode}` });
          this.log('warning', `${endpoint.name} endpoint returned status ${response.statusCode}`);
          allHealthy = false;
        }
      } catch (error) {
        this.results.push({ check: endpoint.name, status: 'FAIL', message: error.message });
        this.log('warning', `${endpoint.name} check failed: ${error.message}`);
        allHealthy = false;
      }
    }

    return allHealthy;
  }

  async checkExtensionConfiguration() {
    this.log('info', 'Validating extension configuration...');
    
    try {
      // Check required configuration sections
      const requiredSections = ['api', 'authentication', 'monitoring', 'logging', 'security'];
      const missingSections = requiredSections.filter(section => !this.config[section]);
      
      if (missingSections.length > 0) {
        this.results.push({ 
          check: 'Configuration', 
          status: 'FAIL', 
          message: `Missing sections: ${missingSections.join(', ')}` 
        });
        this.log('error', `Configuration missing required sections: ${missingSections.join(', ')}`);
        return false;
      }

      // Check environment variables
      const requiredEnvVars = ['SHOPIFY_API_KEY', 'SHOPIFY_API_SECRET', 'RETURNSX_API_TOKEN'];
      const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
      
      if (missingEnvVars.length > 0) {
        this.results.push({ 
          check: 'Environment Variables', 
          status: 'FAIL', 
          message: `Missing variables: ${missingEnvVars.join(', ')}` 
        });
        this.log('error', `Missing environment variables: ${missingEnvVars.join(', ')}`);
        return false;
      }

      this.results.push({ check: 'Configuration', status: 'PASS', message: 'All required configuration present' });
      this.results.push({ check: 'Environment Variables', status: 'PASS', message: 'All required variables set' });
      this.log('success', 'Configuration validation passed');
      return true;
    } catch (error) {
      this.results.push({ check: 'Configuration', status: 'FAIL', message: error.message });
      this.log('error', `Configuration validation failed: ${error.message}`);
      return false;
    }
  }

  async checkExtensionFiles() {
    this.log('info', 'Checking extension files...');
    
    const requiredFiles = [
      'shopify.extension.toml',
      'build/index.js',
      'build/index.css',
      'package.json'
    ];

    const extensionDir = path.join(__dirname, '..');
    let allFilesPresent = true;

    for (const file of requiredFiles) {
      const filePath = path.join(extensionDir, file);
      if (fs.existsSync(filePath)) {
        this.log('success', `Found required file: ${file}`);
      } else {
        this.log('error', `Missing required file: ${file}`);
        allFilesPresent = false;
      }
    }

    if (allFilesPresent) {
      this.results.push({ check: 'Extension Files', status: 'PASS', message: 'All required files present' });
      return true;
    } else {
      this.results.push({ check: 'Extension Files', status: 'FAIL', message: 'Missing required files' });
      return false;
    }
  }

  generateReport() {
    this.log('info', 'Generating health check report...');
    
    const report = {
      timestamp: new Date().toISOString(),
      environment: 'production',
      extension: 'thank-you-risk-display',
      version: process.env.npm_package_version || '1.0.0',
      results: this.results,
      summary: {
        total: this.results.length,
        passed: this.results.filter(r => r.status === 'PASS').length,
        failed: this.results.filter(r => r.status === 'FAIL').length,
        warnings: this.results.filter(r => r.status === 'WARNING').length
      }
    };

    // Write report to file
    const reportPath = path.join(__dirname, '../health-check-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    this.log('info', `Health check report saved to: ${reportPath}`);
    return report;
  }

  printSummary(report) {
    console.log('\n' + '='.repeat(60));
    console.log(`${colors.blue}HEALTH CHECK SUMMARY${colors.reset}`);
    console.log('='.repeat(60));
    
    console.log(`Extension: ${report.extension}`);
    console.log(`Version: ${report.version}`);
    console.log(`Environment: ${report.environment}`);
    console.log(`Timestamp: ${report.timestamp}`);
    console.log('');
    
    console.log(`Total Checks: ${report.summary.total}`);
    console.log(`${colors.green}Passed: ${report.summary.passed}${colors.reset}`);
    console.log(`${colors.red}Failed: ${report.summary.failed}${colors.reset}`);
    console.log(`${colors.yellow}Warnings: ${report.summary.warnings}${colors.reset}`);
    console.log('');
    
    // Print detailed results
    this.results.forEach(result => {
      const statusColor = result.status === 'PASS' ? colors.green : 
                         result.status === 'FAIL' ? colors.red : colors.yellow;
      console.log(`${statusColor}${result.status}${colors.reset} - ${result.check}: ${result.message}`);
    });
    
    console.log('='.repeat(60));
  }

  async run() {
    this.log('info', 'Starting production health check...');
    
    try {
      // Run all health checks
      await this.checkExtensionConfiguration();
      await this.checkExtensionFiles();
      await this.checkApiEndpoint();
      await this.checkAuthentication();
      await this.checkMonitoringEndpoints();
      
      // Generate and display report
      const report = this.generateReport();
      this.printSummary(report);
      
      // Exit with appropriate code
      const hasFailures = report.summary.failed > 0;
      if (hasFailures) {
        this.log('error', 'Health check completed with failures');
        process.exit(1);
      } else {
        this.log('success', 'All health checks passed');
        process.exit(0);
      }
      
    } catch (error) {
      this.log('error', `Health check failed: ${error.message}`);
      process.exit(1);
    }
  }
}

// Run health check if called directly
if (require.main === module) {
  const healthChecker = new HealthChecker();
  healthChecker.run();
}

module.exports = HealthChecker;