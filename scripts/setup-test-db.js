#!/usr/bin/env node

/**
 * Test Database Setup Script
 * 
 * Sets up a test database for integration tests
 * Can be run manually or as part of CI/CD pipeline
 */

const { execSync } = require('child_process');
const { existsSync } = require('fs');

// Test database configuration
const TEST_DB_URL = process.env.TEST_DATABASE_URL || 'postgresql://test:test@localhost:5432/returnsx_test';

console.log('🔧 Setting up test database...');
console.log('Database URL:', TEST_DB_URL);

try {
  // Set environment for test
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = TEST_DB_URL;

  // Check if .env.test exists
  if (existsSync('.env.test')) {
    console.log('✅ Found .env.test file');
  } else {
    console.log('⚠️ No .env.test file found - using environment variables');
  }

  // Try to create database (will fail if already exists, which is fine)
  try {
    console.log('📦 Creating test database...');
    execSync(`createdb returnsx_test`, { stdio: 'pipe' });
    console.log('✅ Test database created');
  } catch (error) {
    console.log('ℹ️ Test database already exists or creation failed (this is usually fine)');
  }

  // Reset and migrate database
  console.log('🔄 Resetting database schema...');
  execSync('npx prisma migrate reset --force --skip-seed', {
    env: { ...process.env, DATABASE_URL: TEST_DB_URL },
    stdio: 'inherit'
  });

  console.log('🚀 Running migrations...');
  execSync('npx prisma migrate deploy', {
    env: { ...process.env, DATABASE_URL: TEST_DB_URL },
    stdio: 'inherit'
  });

  console.log('🔧 Generating Prisma client...');
  execSync('npx prisma generate', {
    env: { ...process.env, DATABASE_URL: TEST_DB_URL },
    stdio: 'inherit'
  });

  console.log('✅ Test database setup completed successfully!');
  console.log('');
  console.log('You can now run integration tests with:');
  console.log('npm run test:integration');

} catch (error) {
  console.error('❌ Test database setup failed:', error.message);
  console.error('');
  console.error('Make sure you have:');
  console.error('1. PostgreSQL running on localhost:5432');
  console.error('2. A "test" user with password "test"');
  console.error('3. Permission to create databases');
  console.error('');
  console.error('You can create the test user with:');
  console.error('sudo -u postgres createuser -s test');
  console.error('sudo -u postgres psql -c "ALTER USER test PASSWORD \'test\';"');
  
  process.exit(1);
}