#!/usr/bin/env node
// Simple migration runner that doesn't depend on complex dependencies
const { execFileSync } = require('child_process');
const path = require('path');

try {
  console.log('Running Prisma migrations...');

  // Use the Prisma CLI directly from node_modules
  const prismaPath = path.resolve(path.join(__dirname, 'node_modules', '.bin', 'prisma'));
  if (!prismaPath.startsWith(path.resolve(__dirname))) {
    throw new Error('Invalid prisma path');
  }

  execFileSync(prismaPath, ['migrate', 'deploy'], {
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
