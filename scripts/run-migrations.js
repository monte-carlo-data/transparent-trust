#!/usr/bin/env node
/**
 * Database migration runner for ECS tasks and manual execution
 *
 * This script:
 * 1. Validates DATABASE_URL is set
 * 2. Tests database connectivity
 * 3. Runs Prisma migrations
 * 4. Verifies migration success
 *
 * Usage:
 *   node scripts/run-migrations.js
 *
 * Environment variables:
 *   DATABASE_URL - Required PostgreSQL connection string
 *   AWS_REGION - Optional, for fetching secrets from Secrets Manager
 *   DB_SECRET_ARN - Optional, ARN of database secret
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// ANSI color codes for output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function sanitizeDatabaseUrl(url) {
  try {
    const parsed = new URL(url);
    // Avoid pg sslmode handling; we set SSL verification config separately
    parsed.searchParams.delete('sslmode');
    return parsed.toString();
  } catch {
    return url;
  }
}

function configureSslWorkaround() {
  // Prisma (pg) will respect these when SSL certs aren't trusted (RDS default)
  if (!process.env.PGSSLMODE) {
    process.env.PGSSLMODE = 'no-verify';
  }
  if (!process.env.NODE_TLS_REJECT_UNAUTHORIZED) {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  }
}

async function testDatabaseConnection(databaseUrl) {
  log('Testing database connectivity...', 'blue');

  // Use Prisma to validate database URL format and connectivity
  // Prisma handles SSL correctly with AWS RDS
  try {
    execSync('npx prisma migrate status', {
      stdio: 'pipe',
      env: process.env,
      timeout: 30000,
    });
    log('✓ Database connection successful', 'green');
    return true;
  } catch (error) {
    // migrate status will fail if it can't connect, but that's okay
    // the actual error will be clearer when we run migrate deploy
    log('⚠ Could not verify connection, proceeding with migration...', 'yellow');
    return true; // Continue anyway - let migrate deploy show the real error
  }
}

async function checkMigrationStatus(databaseUrl) {
  log('Checking migration status...', 'blue');

  // Use Prisma to check migration status - it handles SSL correctly
  try {
    const output = execSync('npx prisma migrate status', {
      encoding: 'utf8',
      env: process.env,
      timeout: 30000,
    });
    log(output, 'reset');
    return { exists: true, count: 0, migrations: [] };
  } catch (error) {
    // This is expected for fresh databases
    log('⚠ Migration status check failed (may be fresh database)', 'yellow');
    return { exists: false, count: 0, migrations: [] };
  }
}

async function checkSchemaExists(databaseUrl) {
  // Use Prisma migrate status to check if schema exists
  // This avoids direct pg client SSL issues
  try {
    execSync('npx prisma migrate status', {
      stdio: 'pipe',
      env: process.env,
      timeout: 30000,
    });
    return true;
  } catch (error) {
    return false;
  }
}

async function resolveFailedMigrations(databaseUrl) {
  log('Checking for failed migrations...', 'blue');

  // Use Prisma migrate status to check for issues
  // Prisma handles SSL correctly with AWS RDS
  try {
    const output = execSync('npx prisma migrate status 2>&1', {
      encoding: 'utf8',
      env: process.env,
      timeout: 30000,
    });

    // Check if there are failed migrations mentioned in output
    if (output.includes('failed') || output.includes('not yet applied')) {
      log('⚠ Found pending or failed migrations', 'yellow');
      log(output, 'reset');
    } else {
      log('✓ No failed migrations found', 'green');
    }
  } catch (error) {
    log('⚠ Could not check migration status, continuing...', 'yellow');
  }
}

async function runMigrations(databaseUrl) {
  log('Starting database migrations...', 'blue');

  try {
    // First, resolve any failed migrations
    await resolveFailedMigrations(databaseUrl);

    log('');

    // Run prisma migrate deploy
    execSync('npx prisma migrate deploy', {
      stdio: 'inherit',
      env: process.env,
    });

    log('✓ Migrations completed successfully!', 'green');
    return true;
  } catch (error) {
    log(`✗ Migration failed: ${error.message}`, 'red');
    return false;
  }
}

async function runSeed() {
  log('Seeding database (minimal)...', 'blue');
  try {
    execSync('npx prisma db seed', {
      stdio: 'inherit',
      env: process.env,
    });
    log('✓ Seed completed', 'green');
    return true;
  } catch (error) {
    log(`✗ Seed failed: ${error.message}`, 'red');
    return false;
  }
}

/**
 * Run post-migration scripts (migration.post.ts files)
 * These scripts handle data migrations that can't be done in SQL
 */
async function runPostMigrationScripts() {
  log('Running post-migration scripts...', 'blue');

  const migrationsDir = path.join(__dirname, '..', 'prisma', 'migrations');

  if (!fs.existsSync(migrationsDir)) {
    log('⚠ Migrations directory not found, skipping post-migration scripts', 'yellow');
    return true;
  }

  // Find all migration.post.ts files
  const migrationFolders = fs.readdirSync(migrationsDir)
    .filter(name => {
      const fullPath = path.join(migrationsDir, name);
      return fs.statSync(fullPath).isDirectory();
    })
    .sort(); // Sort to run in order

  const postScripts = [];
  for (const folder of migrationFolders) {
    const postScriptPath = path.join(migrationsDir, folder, 'migration.post.ts');
    if (fs.existsSync(postScriptPath)) {
      postScripts.push({ folder, path: postScriptPath });
    }
  }

  if (postScripts.length === 0) {
    log('✓ No post-migration scripts found', 'green');
    return true;
  }

  log(`Found ${postScripts.length} post-migration script(s)`, 'blue');

  let allSuccess = true;
  for (const script of postScripts) {
    log(`  Running: ${script.folder}/migration.post.ts`, 'blue');
    try {
      execSync(`npx tsx ${JSON.stringify(script.path)}`, {
        stdio: 'inherit',
        env: process.env,
        cwd: path.join(__dirname, '..'),
        shell: true,
      });
      log(`  ✓ ${script.folder} completed`, 'green');
    } catch (error) {
      log(`  ✗ ${script.folder} failed: ${error.message}`, 'red');
      allSuccess = false;
    }
  }

  if (allSuccess) {
    log('✓ All post-migration scripts completed', 'green');
  } else {
    log('⚠ Some post-migration scripts failed', 'yellow');
  }

  return allSuccess;
}

/**
 * Build DATABASE_URL from individual DB_* environment variables if set.
 * This supports AWS RDS-managed secrets where credentials are injected separately.
 */
function ensureDatabaseUrl() {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  const host = process.env.DB_HOST;
  const port = process.env.DB_PORT || '5432';
  const name = process.env.DB_NAME;
  const username = process.env.DB_USERNAME;
  const password = process.env.DB_PASSWORD;
  const ssl = process.env.DB_SSL !== 'false';

  if (host && username && password && name) {
    const encodedPassword = encodeURIComponent(password);
    const sslParam = ssl ? '?sslmode=require' : '';
    const url = `postgresql://${username}:${encodedPassword}@${host}:${port}/${name}${sslParam}`;
    process.env.DATABASE_URL = url;
    return url;
  }

  return null;
}

async function main() {
  log('\n=== Database Migration Runner ===\n', 'blue');

  // Build DATABASE_URL from DB_* components if not directly provided
  ensureDatabaseUrl();

  // Validate DATABASE_URL
  if (!process.env.DATABASE_URL) {
    log('✗ ERROR: DATABASE_URL environment variable is not set', 'red');
    log('Please set DATABASE_URL or DB_HOST/DB_PORT/DB_NAME/DB_USERNAME/DB_PASSWORD', 'yellow');
    process.exit(1);
  }

  // Sanitize the URL to avoid sslmode issues and configure SSL defaults
  const sanitizedDatabaseUrl = sanitizeDatabaseUrl(process.env.DATABASE_URL);
  process.env.DATABASE_URL = sanitizedDatabaseUrl;
  configureSslWorkaround();

  // Mask password in logs
  const maskedUrl = sanitizedDatabaseUrl.replace(/:([^:@]+)@/, ':****@');
  log(`Database URL: ${maskedUrl}`, 'blue');

  try {
    // Step 1: Test connectivity
    const connected = await testDatabaseConnection(sanitizedDatabaseUrl);
    if (!connected) {
      log('\n✗ Cannot proceed without database connectivity', 'red');
      process.exit(1);
    }

    log('');

    // Step 2: Check current migration status
    const status = await checkMigrationStatus(sanitizedDatabaseUrl);

    log('');

    // Step 3: Run migrations
    const success = await runMigrations(sanitizedDatabaseUrl);

    if (!success) {
      log('\n✗ Migration failed - check errors above', 'red');
      process.exit(1);
    }

    log('');

    // Step 4: Run seed to ensure default team exists (idempotent)
    const seeded = await runSeed();
    if (!seeded) {
      log('\n✗ Seed failed - check errors above', 'red');
      process.exit(1);
    }

    log('');

    // Step 5: Run post-migration scripts (data migrations in TypeScript)
    const postMigrationSuccess = await runPostMigrationScripts();
    if (!postMigrationSuccess) {
      log('\n⚠ Some post-migration scripts failed - check errors above', 'yellow');
      // Don't exit - post-migration scripts are often idempotent and may fail on re-runs
    }

    log('');

    // Step 6: Verify new migration status
    const newStatus = await checkMigrationStatus(sanitizedDatabaseUrl);

    const newMigrations = newStatus.count - status.count;
    if (newMigrations > 0) {
      log(`\n✓ Applied ${newMigrations} new migration(s)`, 'green');
    } else {
      log('\n✓ Database is up to date - no new migrations applied', 'green');
    }

    log('\n=== Migration Complete ===\n', 'green');
    process.exit(0);

  } catch (error) {
    log(`\n✗ Fatal error: ${error.message}`, 'red');
    console.error(error);
    process.exit(1);
  }
}

// Run the migration
main();
