#!/bin/bash

# Production Deployment Script for Thank You Risk Display Extension
# This script handles the complete deployment process including validation,
# building, and deployment to Shopify

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
EXTENSION_DIR="extensions/thank-you-risk-display"
CONFIG_FILE="config/production.json"
BUILD_DIR="build"
DEPLOYMENT_LOG="deployment.log"

echo -e "${GREEN}Starting production deployment for Thank You Risk Display Extension${NC}"

# Function to log messages
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$DEPLOYMENT_LOG"
}

# Function to check prerequisites
check_prerequisites() {
    log "Checking deployment prerequisites..."
    
    # Check if Shopify CLI is installed
    if ! command -v shopify &> /dev/null; then
        echo -e "${RED}Error: Shopify CLI is not installed${NC}"
        exit 1
    fi
    
    # Check if Node.js is installed
    if ! command -v node &> /dev/null; then
        echo -e "${RED}Error: Node.js is not installed${NC}"
        exit 1
    fi
    
    # Check if npm is installed
    if ! command -v npm &> /dev/null; then
        echo -e "${RED}Error: npm is not installed${NC}"
        exit 1
    fi
    
    # Check if required environment variables are set
    if [[ -z "$SHOPIFY_API_KEY" ]]; then
        echo -e "${RED}Error: SHOPIFY_API_KEY environment variable is not set${NC}"
        exit 1
    fi
    
    if [[ -z "$SHOPIFY_API_SECRET" ]]; then
        echo -e "${RED}Error: SHOPIFY_API_SECRET environment variable is not set${NC}"
        exit 1
    fi
    
    if [[ -z "$RETURNSX_API_TOKEN" ]]; then
        echo -e "${RED}Error: RETURNSX_API_TOKEN environment variable is not set${NC}"
        exit 1
    fi
    
    log "Prerequisites check passed"
}

# Function to validate configuration
validate_configuration() {
    log "Validating production configuration..."
    
    if [[ ! -f "$EXTENSION_DIR/$CONFIG_FILE" ]]; then
        echo -e "${RED}Error: Production configuration file not found${NC}"
        exit 1
    fi
    
    # Validate JSON syntax
    if ! jq empty "$EXTENSION_DIR/$CONFIG_FILE" 2>/dev/null; then
        echo -e "${RED}Error: Invalid JSON in production configuration${NC}"
        exit 1
    fi
    
    log "Configuration validation passed"
}

# Function to run tests
run_tests() {
    log "Running test suite..."
    
    cd "$EXTENSION_DIR"
    
    # Install dependencies if needed
    if [[ ! -d "node_modules" ]]; then
        npm install
    fi
    
    # Run unit tests
    npm run test:unit --run
    
    # Run integration tests
    npm run test:integration --run
    
    # Run security audit
    npm audit --audit-level moderate
    
    cd - > /dev/null
    
    log "All tests passed"
}

# Function to build extension
build_extension() {
    log "Building extension for production..."
    
    cd "$EXTENSION_DIR"
    
    # Clean previous build
    rm -rf "$BUILD_DIR"
    
    # Set production environment
    export NODE_ENV=production
    
    # Build the extension
    npm run build
    
    # Verify build output
    if [[ ! -d "$BUILD_DIR" ]]; then
        echo -e "${RED}Error: Build failed - no build directory created${NC}"
        exit 1
    fi
    
    cd - > /dev/null
    
    log "Extension build completed successfully"
}

# Function to deploy to Shopify
deploy_to_shopify() {
    log "Deploying extension to Shopify..."
    
    cd "$EXTENSION_DIR"
    
    # Deploy using Shopify CLI
    shopify app deploy --force
    
    if [[ $? -eq 0 ]]; then
        log "Extension deployed successfully to Shopify"
    else
        echo -e "${RED}Error: Deployment to Shopify failed${NC}"
        exit 1
    fi
    
    cd - > /dev/null
}

# Function to verify deployment
verify_deployment() {
    log "Verifying deployment..."
    
    # Run post-deployment health checks
    node "$EXTENSION_DIR/scripts/health-check.js"
    
    if [[ $? -eq 0 ]]; then
        log "Deployment verification passed"
    else
        echo -e "${YELLOW}Warning: Deployment verification failed${NC}"
    fi
}

# Function to setup monitoring
setup_monitoring() {
    log "Setting up production monitoring..."
    
    # Configure error monitoring
    curl -X POST "https://monitoring.returnsx.com/setup" \
        -H "Authorization: Bearer $RETURNSX_API_TOKEN" \
        -H "Content-Type: application/json" \
        -d '{
            "service": "thank-you-extension",
            "environment": "production",
            "alerting": {
                "errorRate": 0.05,
                "responseTime": 2000
            }
        }' || log "Warning: Failed to setup error monitoring"
    
    log "Monitoring setup completed"
}

# Function to cleanup
cleanup() {
    log "Cleaning up temporary files..."
    
    # Remove any temporary files created during deployment
    rm -f "$EXTENSION_DIR/temp_*"
    
    log "Cleanup completed"
}

# Main deployment process
main() {
    log "=== Starting Production Deployment ==="
    
    check_prerequisites
    validate_configuration
    run_tests
    build_extension
    deploy_to_shopify
    verify_deployment
    setup_monitoring
    cleanup
    
    echo -e "${GREEN}=== Deployment Completed Successfully ===${NC}"
    log "Deployment completed successfully"
    
    echo -e "${GREEN}Extension is now live in production!${NC}"
    echo -e "${YELLOW}Monitor the deployment at: https://monitoring.returnsx.com/dashboard${NC}"
}

# Handle script interruption
trap 'echo -e "${RED}Deployment interrupted${NC}"; cleanup; exit 1' INT TERM

# Run main function
main "$@"