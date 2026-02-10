#!/usr/bin/env node
// Simple migration runner that doesn't depend on complex dependencies
const { execSync } = require('child_process');
const path = require('path');

try {
  console.log('Running Prisma migrations...');

  // Use the Prisma CLI directly from node_modules
  const prismaPath = path.join(__dirname, 'node_modules', '.bin', 'prisma');

  execSync(`${prismaPath} migrate deploy`, {
    stdio: 'inherit',
    cwd: __dirname,
    env: process.env
  });

  console.log('Migrations completed successfully!');
  process.exit(0);
} catch (error) {
  console.error('Migration failed:', error.message);
  process.exit(1);
}
