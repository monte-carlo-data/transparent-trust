#!/usr/bin/env node
// Database initialization script
const { execFileSync } = require('child_process');
const path = require('path');

try {
  console.log('Initializing database...');

  // Use prisma db push to create all tables including _prisma_migrations
  const prismaPath = path.resolve(path.join(__dirname, 'node_modules', '.bin', 'prisma'));
  if (!prismaPath.startsWith(path.resolve(__dirname))) {
    throw new Error('Invalid prisma path');
  }

  console.log('Pushing schema to database...');
  execFileSync(prismaPath, ['db', 'push', '--skip-generate'], {
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
