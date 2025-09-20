# Production Deployment Script for Thank You Risk Display Extension (PowerShell)
# This script handles the complete deployment process including validation,
# building, and deployment to Shopify

param(
    [string]$Environment = "production",
    [switch]$SkipTests = $false,
    [switch]$Force = $false
)

# Configuration
$ExtensionDir = "extensions/thank-you-risk-display"
$ConfigFile = "config/production.json"
$BuildDir = "build"
$DeploymentLog = "deployment.log"

# Colors for output
$Red = "Red"
$Green = "Green"
$Yellow = "Yellow"

Write-Host "Starting production deployment for Thank You Risk Display Extension" -ForegroundColor $Green

# Function to log messages
function Write-Log {
    param([string]$Message)
    $Timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $LogEntry = "$Timestamp - $Message"
    Write-Host $LogEntry
    Add-Content -Path $DeploymentLog -Value $LogEntry
}

# Function to check prerequisites
function Test-Prerequisites {
    Write-Log "Checking deployment prerequisites..."
    
    # Check if Shopify CLI is installed
    try {
        $null = Get-Command shopify -ErrorAction Stop
    } catch {
        Write-Host "Error: Shopify CLI is not installed" -ForegroundColor $Red
        exit 1
    }
    
    # Check if Node.js is installed
    try {
        $null = Get-Command node -ErrorAction Stop
    } catch {
        Write-Host "Error: Node.js is not installed" -ForegroundColor $Red
        exit 1
    }
    
    # Check if npm is installed
    try {
        $null = Get-Command npm -ErrorAction Stop
    } catch {
        Write-Host "Error: npm is not installed" -ForegroundColor $Red
        exit 1
    }
    
    # Check if required environment variables are set
    $RequiredEnvVars = @("SHOPIFY_API_KEY", "SHOPIFY_API_SECRET", "RETURNSX_API_TOKEN")
    foreach ($EnvVar in $RequiredEnvVars) {
        if (-not $env:$EnvVar) {
            Write-Host "Error: $EnvVar environment variable is not set" -ForegroundColor $Red
            exit 1
        }
    }
    
    Write-Log "Prerequisites check passed"
}

# Function to validate configuration
function Test-Configuration {
    Write-Log "Validating production configuration..."
    
    $ConfigPath = Join-Path $ExtensionDir $ConfigFile
    if (-not (Test-Path $ConfigPath)) {
        Write-Host "Error: Production configuration file not found" -ForegroundColor $Red
        exit 1
    }
    
    # Validate JSON syntax
    try {
        $null = Get-Content $ConfigPath | ConvertFrom-Json
    } catch {
        Write-Host "Error: Invalid JSON in production configuration" -ForegroundColor $Red
        exit 1
    }
    
    Write-Log "Configuration validation passed"
}

# Function to run tests
function Invoke-Tests {
    if ($SkipTests) {
        Write-Log "Skipping tests as requested"
        return
    }
    
    Write-Log "Running test suite..."
    
    Push-Location $ExtensionDir
    
    try {
        # Install dependencies if needed
        if (-not (Test-Path "node_modules")) {
            npm install
            if ($LASTEXITCODE -ne 0) {
                throw "npm install failed"
            }
        }
        
        # Run unit tests
        npm run test:unit -- --run
        if ($LASTEXITCODE -ne 0) {
            throw "Unit tests failed"
        }
        
        # Run integration tests
        npm run test:integration -- --run
        if ($LASTEXITCODE -ne 0) {
            throw "Integration tests failed"
        }
        
        # Run security audit
        npm audit --audit-level moderate
        if ($LASTEXITCODE -ne 0) {
            Write-Host "Warning: Security audit found issues" -ForegroundColor $Yellow
        }
        
        Write-Log "All tests passed"
    } catch {
        Write-Host "Error: Test execution failed - $_" -ForegroundColor $Red
        exit 1
    } finally {
        Pop-Location
    }
}

# Function to build extension
function Build-Extension {
    Write-Log "Building extension for production..."
    
    Push-Location $ExtensionDir
    
    try {
        # Clean previous build
        if (Test-Path $BuildDir) {
            Remove-Item -Recurse -Force $BuildDir
        }
        
        # Set production environment
        $env:NODE_ENV = "production"
        
        # Build the extension
        npm run build
        if ($LASTEXITCODE -ne 0) {
            throw "Build failed"
        }
        
        # Verify build output
        if (-not (Test-Path $BuildDir)) {
            throw "Build failed - no build directory created"
        }
        
        Write-Log "Extension build completed successfully"
    } catch {
        Write-Host "Error: Build failed - $_" -ForegroundColor $Red
        exit 1
    } finally {
        Pop-Location
    }
}

# Function to deploy to Shopify
function Deploy-ToShopify {
    Write-Log "Deploying extension to Shopify..."
    
    Push-Location $ExtensionDir
    
    try {
        # Deploy using Shopify CLI
        if ($Force) {
            shopify app deploy --force
        } else {
            shopify app deploy
        }
        
        if ($LASTEXITCODE -eq 0) {
            Write-Log "Extension deployed successfully to Shopify"
        } else {
            throw "Deployment to Shopify failed"
        }
    } catch {
        Write-Host "Error: Deployment to Shopify failed - $_" -ForegroundColor $Red
        exit 1
    } finally {
        Pop-Location
    }
}

# Function to verify deployment
function Test-Deployment {
    Write-Log "Verifying deployment..."
    
    try {
        # Run post-deployment health checks
        Push-Location $ExtensionDir
        node scripts/health-check.js
        
        if ($LASTEXITCODE -eq 0) {
            Write-Log "Deployment verification passed"
        } else {
            Write-Host "Warning: Deployment verification failed" -ForegroundColor $Yellow
        }
    } catch {
        Write-Host "Warning: Deployment verification failed - $_" -ForegroundColor $Yellow
    } finally {
        Pop-Location
    }
}

# Function to setup monitoring
function Initialize-Monitoring {
    Write-Log "Setting up production monitoring..."
    
    try {
        $MonitoringPayload = @{
            service = "thank-you-extension"
            environment = "production"
            alerting = @{
                errorRate = 0.05
                responseTime = 2000
            }
        } | ConvertTo-Json
        
        $Headers = @{
            "Authorization" = "Bearer $env:RETURNSX_API_TOKEN"
            "Content-Type" = "application/json"
        }
        
        Invoke-RestMethod -Uri "https://monitoring.returnsx.com/setup" -Method Post -Body $MonitoringPayload -Headers $Headers
        Write-Log "Monitoring setup completed"
    } catch {
        Write-Log "Warning: Failed to setup monitoring - $_"
    }
}

# Function to cleanup
function Clear-TempFiles {
    Write-Log "Cleaning up temporary files..."
    
    try {
        # Remove any temporary files created during deployment
        Get-ChildItem -Path $ExtensionDir -Filter "temp_*" | Remove-Item -Force
        Write-Log "Cleanup completed"
    } catch {
        Write-Log "Warning: Cleanup failed - $_"
    }
}

# Main deployment process
function Start-Deployment {
    Write-Log "=== Starting Production Deployment ==="
    
    try {
        Test-Prerequisites
        Test-Configuration
        Invoke-Tests
        Build-Extension
        Deploy-ToShopify
        Test-Deployment
        Initialize-Monitoring
        Clear-TempFiles
        
        Write-Host "=== Deployment Completed Successfully ===" -ForegroundColor $Green
        Write-Log "Deployment completed successfully"
        
        Write-Host "Extension is now live in production!" -ForegroundColor $Green
        Write-Host "Monitor the deployment at: https://monitoring.returnsx.com/dashboard" -ForegroundColor $Yellow
    } catch {
        Write-Host "Deployment failed: $_" -ForegroundColor $Red
        Clear-TempFiles
        exit 1
    }
}

# Handle script interruption
trap {
    Write-Host "Deployment interrupted" -ForegroundColor $Red
    Clear-TempFiles
    exit 1
}

# Run main function
Start-Deployment