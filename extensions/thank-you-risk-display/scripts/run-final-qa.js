#!/usr/bin/env node

/**
 * Final QA Test Runner
 * 
 * Executes comprehensive integration testing and quality assurance
 * for the Thank You Page Extension before production deployment.
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// ANSI color codes for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

class QATestRunner {
  constructor() {
    this.results = {
      passed: 0,
      failed: 0,
      skipped: 0,
      suites: []
    };
    this.startTime = Date.now();
  }

  log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
  }

  logHeader(message) {
    this.log('\n' + '='.repeat(60), 'cyan');
    this.log(`  ${message}`, 'bright');
    this.log('='.repeat(60), 'cyan');
  }

  logSuccess(message) {
    this.log(`✅ ${message}`, 'green');
  }

  logError(message) {
    this.log(`❌ ${message}`, 'red');
  }

  logWarning(message) {
    this.log(`⚠️  ${message}`, 'yellow');
  }

  logInfo(message) {
    this.log(`ℹ️  ${message}`, 'blue');
  }

  async runCommand(command, options = {}) {
    return new Promise((resolve, reject) => {
      this.logInfo(`Running: ${command}`);
      
      const child = spawn('npm', ['run', command], {
        stdio: 'pipe',
        shell: true,
        ...options
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve({ stdout, stderr, code });
        } else {
          reject({ stdout, stderr, code });
        }
      });
    });
  }

  async runVitest(testPattern, description) {
    try {
      this.logInfo(`Running ${description}...`);
      
      const result = await this.runCommand(`test -- ${testPattern} --run --reporter=json`);
      const testResults = JSON.parse(result.stdout.split('\n').find(line => line.startsWith('{')));
      
      this.results.suites.push({
        name: description,
        passed: testResults.numPassedTests || 0,
        failed: testResults.numFailedTests || 0,
        skipped: testResults.numPendingTests || 0,
        duration: testResults.testResults?.[0]?.perfStats?.end - testResults.testResults?.[0]?.perfStats?.start || 0
      });

      this.results.passed += testResults.numPassedTests || 0;
      this.results.failed += testResults.numFailedTests || 0;
      this.results.skipped += testResults.numPendingTests || 0;

      if (testResults.numFailedTests > 0) {
        this.logError(`${description} - ${testResults.numFailedTests} tests failed`);
        return false;
      } else {
        this.logSuccess(`${description} - All ${testResults.numPassedTests} tests passed`);
        return true;
      }
    } catch (error) {
      this.logError(`${description} - Test execution failed: ${error.message}`);
      this.results.failed += 1;
      return false;
    }
  }

  async checkPrerequisites() {
    this.logHeader('Checking Prerequisites');

    const checks = [
      {
        name: 'Node.js version',
        check: () => {
          const version = process.version;
          const majorVersion = parseInt(version.slice(1).split('.')[0]);
          return majorVersion >= 18;
        },
        message: 'Node.js 18+ required'
      },
      {
        name: 'Package dependencies',
        check: () => fs.existsSync(path.join(__dirname, '../node_modules')),
        message: 'Run npm install first'
      },
      {
        name: 'Test files exist',
        check: () => {
          const testFiles = [
            '../tests/integration/final-qa-suite.test.ts',
            '../tests/performance/load-testing.test.ts',
            '../tests/security/compliance-validation.test.ts',
            '../tests/compatibility/cross-platform.test.ts'
          ];
          return testFiles.every(file => fs.existsSync(path.join(__dirname, file)));
        },
        message: 'Test files are missing'
      },
      {
        name: 'Extension source files',
        check: () => {
          const sourceFiles = [
            '../src/Checkout.tsx',
            '../src/components/RiskAssessmentCard.tsx',
            '../src/services/apiClient.ts'
          ];
          return sourceFiles.every(file => fs.existsSync(path.join(__dirname, file)));
        },
        message: 'Extension source files are missing'
      }
    ];

    let allChecksPassed = true;

    for (const check of checks) {
      try {
        if (check.check()) {
          this.logSuccess(check.name);
        } else {
          this.logError(`${check.name} - ${check.message}`);
          allChecksPassed = false;
        }
      } catch (error) {
        this.logError(`${check.name} - Error: ${error.message}`);
        allChecksPassed = false;
      }
    }

    return allChecksPassed;
  }

  async runIntegrationTests() {
    this.logHeader('Running Integration Tests');

    const testSuites = [
      {
        pattern: 'tests/integration/final-qa-suite.test.ts',
        description: 'Comprehensive Integration Suite'
      },
      {
        pattern: 'tests/compatibility/cross-platform.test.ts',
        description: 'Cross-Platform Compatibility'
      }
    ];

    let allPassed = true;

    for (const suite of testSuites) {
      const passed = await this.runVitest(suite.pattern, suite.description);
      if (!passed) {
        allPassed = false;
      }
    }

    return allPassed;
  }

  async runPerformanceTests() {
    this.logHeader('Running Performance Tests');

    const passed = await this.runVitest(
      'tests/performance/load-testing.test.ts',
      'Load Testing and Performance Validation'
    );

    return passed;
  }

  async runSecurityTests() {
    this.logHeader('Running Security and Compliance Tests');

    const passed = await this.runVitest(
      'tests/security/compliance-validation.test.ts',
      'Security and Privacy Compliance'
    );

    return passed;
  }

  async runE2ETests() {
    this.logHeader('Running End-to-End Tests');

    try {
      // Check if Playwright is available
      if (!fs.existsSync(path.join(__dirname, '../node_modules/@playwright/test'))) {
        this.logWarning('Playwright not installed - skipping E2E tests');
        return true;
      }

      this.logInfo('Running Playwright E2E tests...');
      
      // Run E2E tests if they exist
      const e2eTestPath = path.join(__dirname, '../tests/e2e');
      if (fs.existsSync(e2eTestPath)) {
        const result = await this.runCommand('test:e2e');
        this.logSuccess('E2E tests completed successfully');
        return true;
      } else {
        this.logWarning('No E2E tests found - skipping');
        return true;
      }
    } catch (error) {
      this.logError(`E2E tests failed: ${error.message}`);
      return false;
    }
  }

  async validateConfiguration() {
    this.logHeader('Validating Configuration');

    const configChecks = [
      {
        name: 'Extension configuration',
        check: () => {
          const configPath = path.join(__dirname, '../shopify.extension.toml');
          if (!fs.existsSync(configPath)) return false;
          
          const config = fs.readFileSync(configPath, 'utf8');
          return config.includes('purchase.thank-you.block.render');
        },
        message: 'Extension configuration is invalid'
      },
      {
        name: 'Package.json validity',
        check: () => {
          const packagePath = path.join(__dirname, '../package.json');
          if (!fs.existsSync(packagePath)) return false;
          
          try {
            const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
            return pkg.name && pkg.version && pkg.dependencies;
          } catch {
            return false;
          }
        },
        message: 'Package.json is invalid'
      },
      {
        name: 'TypeScript configuration',
        check: () => {
          const tsconfigPath = path.join(__dirname, '../tsconfig.json');
          return fs.existsSync(tsconfigPath);
        },
        message: 'TypeScript configuration missing'
      }
    ];

    let allValid = true;

    for (const check of configChecks) {
      try {
        if (check.check()) {
          this.logSuccess(check.name);
        } else {
          this.logError(`${check.name} - ${check.message}`);
          allValid = false;
        }
      } catch (error) {
        this.logError(`${check.name} - Error: ${error.message}`);
        allValid = false;
      }
    }

    return allValid;
  }

  async generateReport() {
    this.logHeader('Generating QA Report');

    const endTime = Date.now();
    const duration = endTime - this.startTime;

    const report = {
      timestamp: new Date().toISOString(),
      duration: duration,
      summary: {
        totalTests: this.results.passed + this.results.failed + this.results.skipped,
        passed: this.results.passed,
        failed: this.results.failed,
        skipped: this.results.skipped,
        successRate: this.results.passed / (this.results.passed + this.results.failed) * 100
      },
      suites: this.results.suites,
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        memory: process.memoryUsage()
      }
    };

    // Save report to file
    const reportPath = path.join(__dirname, '../qa-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    // Display summary
    this.log('\n📊 QA Test Summary:', 'bright');
    this.log(`   Total Tests: ${report.summary.totalTests}`);
    this.log(`   Passed: ${report.summary.passed}`, 'green');
    this.log(`   Failed: ${report.summary.failed}`, report.summary.failed > 0 ? 'red' : 'reset');
    this.log(`   Skipped: ${report.summary.skipped}`, 'yellow');
    this.log(`   Success Rate: ${report.summary.successRate.toFixed(1)}%`);
    this.log(`   Duration: ${(duration / 1000).toFixed(2)}s`);
    this.log(`   Report saved to: ${reportPath}`, 'blue');

    return report;
  }

  async run() {
    this.logHeader('Final QA Testing Suite');
    this.logInfo('Starting comprehensive quality assurance testing...');

    try {
      // Check prerequisites
      const prerequisitesPassed = await this.checkPrerequisites();
      if (!prerequisitesPassed) {
        this.logError('Prerequisites check failed. Please fix the issues and try again.');
        process.exit(1);
      }

      // Validate configuration
      const configValid = await this.validateConfiguration();
      if (!configValid) {
        this.logError('Configuration validation failed.');
        process.exit(1);
      }

      // Run test suites
      const integrationPassed = await this.runIntegrationTests();
      const performancePassed = await this.runPerformanceTests();
      const securityPassed = await this.runSecurityTests();
      const e2ePassed = await this.runE2ETests();

      // Generate report
      const report = await this.generateReport();

      // Determine overall result
      const allTestsPassed = integrationPassed && performancePassed && securityPassed && e2ePassed;

      if (allTestsPassed) {
        this.logHeader('🎉 QA Testing Completed Successfully!');
        this.logSuccess('All tests passed. Extension is ready for production deployment.');
        process.exit(0);
      } else {
        this.logHeader('❌ QA Testing Failed');
        this.logError('Some tests failed. Please review the results and fix the issues.');
        process.exit(1);
      }

    } catch (error) {
      this.logError(`QA testing failed with error: ${error.message}`);
      console.error(error.stack);
      process.exit(1);
    }
  }
}

// Run the QA suite if this script is executed directly
if (require.main === module) {
  const runner = new QATestRunner();
  runner.run().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = QATestRunner;