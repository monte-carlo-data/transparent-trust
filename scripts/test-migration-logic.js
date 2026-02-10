#!/usr/bin/env node
/**
 * Test script to validate migration resolution logic
 * Run with: node scripts/test-migration-logic.js
 */

// Mock pg Client for testing
class MockClient {
  constructor(config) {
    this.config = config;
    this.connected = false;
  }

  async connect() {
    this.connected = true;
  }

  async query(sql) {
    // Simulate different scenarios based on test mode
    const mode = process.env.TEST_MODE || 'no_failed';

    if (sql.includes('_prisma_migrations')) {
      if (mode === 'has_failed') {
        return {
          rows: [
            {
              migration_name: '20251228020000_owner_constraints',
              started_at: new Date('2026-01-02T21:29:07.612Z'),
              finished_at: null,
              rolled_back_at: null
            }
          ]
        };
      } else if (mode === 'has_rolled_back') {
        return {
          rows: [
            {
              migration_name: '20251228030000_some_migration',
              started_at: new Date('2026-01-02T22:00:00.000Z'),
              finished_at: new Date('2026-01-02T22:00:05.000Z'),
              rolled_back_at: new Date('2026-01-02T22:01:00.000Z')
            }
          ]
        };
      } else {
        return { rows: [] };
      }
    }

    return { rows: [] };
  }

  async end() {
    this.connected = false;
  }
}

// Colors for output
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

// The function we're testing (simplified version)
async function resolveFailedMigrations(client) {
  log('Checking for failed migrations...', 'blue');

  try {
    await client.connect();

    const result = await client.query(`
      SELECT migration_name, started_at, finished_at, rolled_back_at
      FROM "_prisma_migrations"
      WHERE (started_at IS NOT NULL AND finished_at IS NULL)
         OR rolled_back_at IS NOT NULL
      ORDER BY started_at DESC
    `);

    await client.end();

    if (result.rows.length === 0) {
      log('✓ No failed migrations found', 'green');
      return { found: false, migrations: [] };
    }

    log(`Found ${result.rows.length} failed migration(s)`, 'yellow');

    for (const row of result.rows) {
      log(`  - ${row.migration_name}`, 'yellow');
      log(`    Started: ${row.started_at}`, 'reset');
      log(`    Finished: ${row.finished_at || 'NULL (incomplete)'}`, 'reset');
      log(`    Rolled back: ${row.rolled_back_at || 'NULL'}`, 'reset');
    }

    return { found: true, migrations: result.rows };
  } catch (error) {
    await client.end().catch(() => {});
    throw error;
  }
}

// Test runner
async function runTests() {
  log('\n=== Testing Migration Resolution Logic ===\n', 'blue');

  let passed = 0;
  let failed = 0;

  // Test 1: No failed migrations
  log('Test 1: No failed migrations', 'blue');
  process.env.TEST_MODE = 'no_failed';
  try {
    const client = new MockClient({});
    const result = await resolveFailedMigrations(client);
    if (!result.found && result.migrations.length === 0) {
      log('✓ PASSED\n', 'green');
      passed++;
    } else {
      log('✗ FAILED - Expected no migrations\n', 'red');
      failed++;
    }
  } catch (error) {
    log(`✗ FAILED - ${error.message}\n`, 'red');
    failed++;
  }

  // Test 2: Has failed migration (incomplete)
  log('Test 2: Has failed migration (started but not finished)', 'blue');
  process.env.TEST_MODE = 'has_failed';
  try {
    const client = new MockClient({});
    const result = await resolveFailedMigrations(client);
    if (result.found && result.migrations.length === 1 &&
        result.migrations[0].migration_name === '20251228020000_owner_constraints') {
      log('✓ PASSED\n', 'green');
      passed++;
    } else {
      log('✗ FAILED - Expected to find the failed migration\n', 'red');
      failed++;
    }
  } catch (error) {
    log(`✗ FAILED - ${error.message}\n`, 'red');
    failed++;
  }

  // Test 3: Has rolled back migration
  log('Test 3: Has rolled back migration', 'blue');
  process.env.TEST_MODE = 'has_rolled_back';
  try {
    const client = new MockClient({});
    const result = await resolveFailedMigrations(client);
    if (result.found && result.migrations.length === 1 &&
        result.migrations[0].rolled_back_at !== null) {
      log('✓ PASSED\n', 'green');
      passed++;
    } else {
      log('✗ FAILED - Expected to find the rolled back migration\n', 'red');
      failed++;
    }
  } catch (error) {
    log(`✗ FAILED - ${error.message}\n`, 'red');
    failed++;
  }

  // Summary
  log('=== Test Summary ===', 'blue');
  log(`Passed: ${passed}`, 'green');
  log(`Failed: ${failed}`, failed > 0 ? 'red' : 'green');

  process.exit(failed > 0 ? 1 : 0);
}

runTests();
