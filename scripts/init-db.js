#!/usr/bin/env node
// Database initialization script
const { execSync } = require('child_process');
const path = require('path');

try {
  console.log('Initializing database...');

  // Use prisma db push to create all tables including _prisma_migrations
  const prismaPath = path.join(__dirname, 'node_modules', '.bin', 'prisma');

  console.log('Pushing schema to database...');
  execSync(`${prismaPath} db push --skip-generate`, {
    stdio: 'inherit',
    cwd: __dirname,
    env: process.env
  });

  console.log('Database initialized successfully!');
  process.exit(0);
} catch (error) {
  console.error('Database initialization failed:', error.message);
  process.exit(1);
}
