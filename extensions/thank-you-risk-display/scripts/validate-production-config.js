#!/usr/bin/env node

/**
 * Production Configuration Validation Script
 * Validates that all production deployment configuration is properly set up
 */

const fs = require('fs');
const path = require('path');

// Colors for console output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

class ProductionConfigValidator {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.checks = [];
    this.extensionDir = path.join(__dirname, '..');
  }

  log(level, message) {
    const color = colors[level === 'error' ? 'red' : level === 'success' ? 'green' : level === 'warning' ? 'yellow' : 'blue'];
    console.log(`${color}[${level.toUpperCase()}] ${message}${colors.reset}`);
  }

  addCheck(name, status, message) {
    this.checks.push({ name, status, message });
    if (status === 'FAIL') {
      this.errors.push(`${name}: ${message}`);
    } else if (status === 'WARNING') {
      this.warnings.push(`${name}: ${message}`);
    }
  }

  checkFileExists(filePath, description) {
    const fullPath = path.join(this.extensionDir, filePath);
    if (fs.existsSync(fullPath)) {
      this.addCheck(description, 'PASS', `File exists: ${filePath}`);
      return true;
    } else {
      this.addCheck(description, 'FAIL', `File missing: ${filePath}`);
      return false;
    }
  }

  checkJSONFile(filePath, description) {
    const fullPath = path.join(this.extensionDir, filePath);
    if (!this.checkFileExists(filePath, description)) {
      return false;
    }

    try {
      const content = fs.readFileSync(fullPath, 'utf8');
      JSON.parse(content);
      this.addCheck(`${description} (JSON)`, 'PASS', 'Valid JSON syntax');
      return true;
    } catch (error) {
      this.addCheck(`${description} (JSON)`, 'FAIL', `Invalid JSON: ${error.message}`);
      return false;
    }
  }

  checkProductionConfig() {
    this.log('info', 'Validating production configuration...');
    
    if (!this.checkJSONFile('config/production.json', 'Production Config')) {
      return;
    }

    try {
      const configPath = path.join(this.extensionDir, 'config/production.json');
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

      // Check required sections
      const requiredSections = ['api', 'authentication', 'monitoring', 'logging', 'security'];
      requiredSections.forEach(section => {
        if (config[section]) {
          this.addCheck(`Config Section: ${section}`, 'PASS', 'Section present');
        } else {
          this.addCheck(`Config Section: ${section}`, 'FAIL', 'Section missing');
        }
      });

      // Check API configuration
      if (config.api) {
        if (config.api.baseUrl && config.api.baseUrl.startsWith('https://')) {
          this.addCheck('API Base URL', 'PASS', 'HTTPS URL configured');
        } else {
          this.addCheck('API Base URL', 'FAIL', 'Invalid or missing HTTPS URL');
        }

        if (config.api.timeout && config.api.timeout > 0) {
          this.addCheck('API Timeout', 'PASS', `Timeout set to ${config.api.timeout}ms`);
        } else {
          this.addCheck('API Timeout', 'WARNING', 'No timeout configured');
        }
      }

      // Check monitoring configuration
      if (config.monitoring) {
        const monitoringServices = ['errorReporting', 'performance', 'analytics'];
        monitoringServices.forEach(service => {
          if (config.monitoring[service] && config.monitoring[service].enabled) {
            this.addCheck(`Monitoring: ${service}`, 'PASS', 'Service enabled');
          } else {
            this.addCheck(`Monitoring: ${service}`, 'WARNING', 'Service not enabled');
          }
        });
      }

    } catch (error) {
      this.addCheck('Production Config Validation', 'FAIL', `Error reading config: ${error.message}`);
    }
  }

  checkDeploymentScripts() {
    this.log('info', 'Validating deployment scripts...');
    
    // Check bash script
    this.checkFileExists('scripts/deploy.sh', 'Bash Deployment Script');
    
    // Check PowerShell script
    this.checkFileExists('scripts/deploy.ps1', 'PowerShell Deployment Script');
    
    // Check health check script
    this.checkFileExists('scripts/health-check.js', 'Health Check Script');
    
    // Check if scripts are executable (on Unix systems)
    if (process.platform !== 'win32') {
      try {
        const deployScript = path.join(this.extensionDir, 'scripts/deploy.sh');
        const stats = fs.statSync(deployScript);
        if (stats.mode & parseInt('111', 8)) {
          this.addCheck('Deploy Script Permissions', 'PASS', 'Script is executable');
        } else {
          this.addCheck('Deploy Script Permissions', 'WARNING', 'Script may not be executable');
        }
      } catch (error) {
        this.addCheck('Deploy Script Permissions', 'WARNING', 'Could not check permissions');
      }
    }
  }

  checkCIConfiguration() {
    this.log('info', 'Validating CI/CD configuration...');
    
    this.checkFileExists('.github/workflows/deploy.yml', 'GitHub Actions Workflow');
    
    // Check workflow file structure
    const workflowPath = path.join(this.extensionDir, '.github/workflows/deploy.yml');
    if (fs.existsSync(workflowPath)) {
      const content = fs.readFileSync(workflowPath, 'utf8');
      
      // Check for required jobs
      const requiredJobs = ['test', 'security-scan', 'build', 'deploy-production'];
      requiredJobs.forEach(job => {
        if (content.includes(`${job}:`)) {
          this.addCheck(`CI Job: ${job}`, 'PASS', 'Job defined in workflow');
        } else {
          this.addCheck(`CI Job: ${job}`, 'WARNING', 'Job not found in workflow');
        }
      });

      // Check for environment secrets
      const requiredSecrets = ['SHOPIFY_API_KEY', 'SHOPIFY_API_SECRET', 'RETURNSX_API_TOKEN'];
      requiredSecrets.forEach(secret => {
        if (content.includes(`secrets.${secret}`)) {
          this.addCheck(`CI Secret: ${secret}`, 'PASS', 'Secret referenced in workflow');
        } else {
          this.addCheck(`CI Secret: ${secret}`, 'WARNING', 'Secret not referenced in workflow');
        }
      });
    }
  }

  checkMonitoringConfiguration() {
    this.log('info', 'Validating monitoring configuration...');
    
    this.checkFileExists('config/monitoring.js', 'Monitoring Service');
    this.checkFileExists('config/rate-limiting.js', 'Rate Limiting Service');
    this.checkFileExists('config/logging.js', 'Logging Service');
  }

  checkExtensionConfiguration() {
    this.log('info', 'Validating extension configuration...');
    
    this.checkFileExists('shopify.extension.toml', 'Extension Configuration');
    
    // Check extension configuration content
    const configPath = path.join(this.extensionDir, 'shopify.extension.toml');
    if (fs.existsSync(configPath)) {
      const content = fs.readFileSync(configPath, 'utf8');
      
      // Check for production-specific settings
      const productionSettings = [
        'environment',
        'enable_rate_limiting',
        'enable_monitoring_alerts',
        'log_level',
        'enable_security_headers'
      ];
      
      productionSettings.forEach(setting => {
        if (content.includes(`key = "${setting}"`)) {
          this.addCheck(`Extension Setting: ${setting}`, 'PASS', 'Production setting configured');
        } else {
          this.addCheck(`Extension Setting: ${setting}`, 'WARNING', 'Production setting not found');
        }
      });

      // Check for required capabilities
      if (content.includes('network_access = true')) {
        this.addCheck('Network Access', 'PASS', 'Network access enabled');
      } else {
        this.addCheck('Network Access', 'FAIL', 'Network access not enabled');
      }

      // Check target configuration
      if (content.includes('target = "purchase.thank-you.block.render"')) {
        this.addCheck('Extension Target', 'PASS', 'Correct target configured');
      } else {
        this.addCheck('Extension Target', 'FAIL', 'Incorrect or missing target');
      }
    }
  }

  checkEnvironmentTemplate() {
    this.log('info', 'Validating environment configuration...');
    
    this.checkFileExists('.env.production.example', 'Environment Template');
    
    // Check for required environment variables in template
    const envPath = path.join(this.extensionDir, '.env.production.example');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      
      const requiredVars = [
        'SHOPIFY_API_KEY',
        'SHOPIFY_API_SECRET',
        'RETURNSX_API_TOKEN',
        'ENCRYPTION_KEY',
        'JWT_SECRET',
        'NODE_ENV'
      ];
      
      requiredVars.forEach(envVar => {
        if (content.includes(`${envVar}=`)) {
          this.addCheck(`Environment Variable: ${envVar}`, 'PASS', 'Variable template present');
        } else {
          this.addCheck(`Environment Variable: ${envVar}`, 'WARNING', 'Variable template missing');
        }
      });
    }
  }

  checkPackageConfiguration() {
    this.log('info', 'Validating package configuration...');
    
    if (!this.checkJSONFile('package.json', 'Package Configuration')) {
      return;
    }

    try {
      const packagePath = path.join(this.extensionDir, 'package.json');
      const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));

      // Check for required scripts
      const requiredScripts = ['build', 'test:unit', 'test:integration', 'deploy', 'health-check'];
      requiredScripts.forEach(script => {
        if (packageJson.scripts && packageJson.scripts[script]) {
          this.addCheck(`NPM Script: ${script}`, 'PASS', 'Script defined');
        } else {
          this.addCheck(`NPM Script: ${script}`, 'WARNING', 'Script not defined');
        }
      });

      // Check for required dependencies
      const requiredDeps = ['@shopify/ui-extensions', '@shopify/ui-extensions-react', 'react'];
      requiredDeps.forEach(dep => {
        if (packageJson.dependencies && packageJson.dependencies[dep]) {
          this.addCheck(`Dependency: ${dep}`, 'PASS', 'Dependency present');
        } else {
          this.addCheck(`Dependency: ${dep}`, 'FAIL', 'Required dependency missing');
        }
      });

    } catch (error) {
      this.addCheck('Package Configuration Validation', 'FAIL', `Error reading package.json: ${error.message}`);
    }
  }

  checkDocumentation() {
    this.log('info', 'Validating documentation...');
    
    this.checkFileExists('PRODUCTION_DEPLOYMENT_SUMMARY.md', 'Deployment Summary');
    this.checkFileExists('README.md', 'README Documentation');
    
    // Check for docs directory
    const docsDir = path.join(this.extensionDir, 'docs');
    if (fs.existsSync(docsDir)) {
      this.addCheck('Documentation Directory', 'PASS', 'Docs directory exists');
      
      // Check for key documentation files
      const docFiles = [
        'MERCHANT_SETUP_GUIDE.md',
        'API_CONFIGURATION_GUIDE.md',
        'TROUBLESHOOTING_GUIDE.md',
        'DEPLOYMENT_GUIDE.md'
      ];
      
      docFiles.forEach(docFile => {
        const docPath = path.join(docsDir, docFile);
        if (fs.existsSync(docPath)) {
          this.addCheck(`Documentation: ${docFile}`, 'PASS', 'Documentation file exists');
        } else {
          this.addCheck(`Documentation: ${docFile}`, 'WARNING', 'Documentation file missing');
        }
      });
    } else {
      this.addCheck('Documentation Directory', 'WARNING', 'Docs directory not found');
    }
  }

  generateReport() {
    this.log('info', 'Generating validation report...');
    
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        total: this.checks.length,
        passed: this.checks.filter(c => c.status === 'PASS').length,
        failed: this.checks.filter(c => c.status === 'FAIL').length,
        warnings: this.checks.filter(c => c.status === 'WARNING').length
      },
      checks: this.checks,
      errors: this.errors,
      warnings: this.warnings
    };

    // Write report to file
    const reportPath = path.join(this.extensionDir, 'production-config-validation-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    return report;
  }

  printSummary(report) {
    console.log('\n' + '='.repeat(60));
    console.log(`${colors.blue}PRODUCTION CONFIGURATION VALIDATION SUMMARY${colors.reset}`);
    console.log('='.repeat(60));
    
    console.log(`Timestamp: ${report.timestamp}`);
    console.log(`Total Checks: ${report.summary.total}`);
    console.log(`${colors.green}Passed: ${report.summary.passed}${colors.reset}`);
    console.log(`${colors.red}Failed: ${report.summary.failed}${colors.reset}`);
    console.log(`${colors.yellow}Warnings: ${report.summary.warnings}${colors.reset}`);
    console.log('');
    
    // Print failed checks
    if (report.errors.length > 0) {
      console.log(`${colors.red}FAILED CHECKS:${colors.reset}`);
      report.errors.forEach(error => console.log(`  ${colors.red}✗${colors.reset} ${error}`));
      console.log('');
    }
    
    // Print warnings
    if (report.warnings.length > 0) {
      console.log(`${colors.yellow}WARNINGS:${colors.reset}`);
      report.warnings.forEach(warning => console.log(`  ${colors.yellow}⚠${colors.reset} ${warning}`));
      console.log('');
    }
    
    console.log('='.repeat(60));
  }

  async run() {
    this.log('info', 'Starting production configuration validation...');
    
    try {
      // Run all validation checks
      this.checkProductionConfig();
      this.checkDeploymentScripts();
      this.checkCIConfiguration();
      this.checkMonitoringConfiguration();
      this.checkExtensionConfiguration();
      this.checkEnvironmentTemplate();
      this.checkPackageConfiguration();
      this.checkDocumentation();
      
      // Generate and display report
      const report = this.generateReport();
      this.printSummary(report);
      
      // Exit with appropriate code
      if (report.summary.failed > 0) {
        this.log('error', 'Production configuration validation failed');
        process.exit(1);
      } else if (report.summary.warnings > 0) {
        this.log('warning', 'Production configuration validation completed with warnings');
        process.exit(0);
      } else {
        this.log('success', 'All production configuration checks passed');
        process.exit(0);
      }
      
    } catch (error) {
      this.log('error', `Validation failed: ${error.message}`);
      process.exit(1);
    }
  }
}

// Run validation if called directly
if (require.main === module) {
  const validator = new ProductionConfigValidator();
  validator.run();
}

module.exports = ProductionConfigValidator;