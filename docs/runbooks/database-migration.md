# Database Migration Helper

A guide for resolving Prisma migration issues and managing database schema changes.

## Overview

This runbook covers common database migration scenarios, focusing on schema drift detection and resolution strategies. The application uses AWS RDS PostgreSQL as its primary database backend.

## AWS RDS-Specific Considerations

**Important:** When working with RDS, never drop the schema in production. Always use migrations instead:

```bash
# ✅ For RDS (production-safe)
npx prisma migrate deploy

# ❌ Never use in RDS
npx prisma migrate reset  # This would delete all data!
```

**Development with RDS:**
If you have access to a dev RDS instance, you can safely test migrations:
```bash
export DATABASE_URL="postgresql://user:password@rds-dev.xxxxx.us-east-1.rds.amazonaws.com:5432/database"
npx prisma migrate deploy  # Test migration
```

## Common Scenarios

### 1. Schema Drift Detection

**Problem**: Prisma detects that the database schema doesn't match the migration history.

**Symptoms**:
```bash
npx prisma migrate dev
# Error: Drift detected: Your database schema is not in sync with your migration history
```

**Cause**: Using `prisma db push` during development applies changes directly to the database without creating migration files, causing the migration history to fall out of sync.

---

### 2. Checking Migration Status

**Check if migrations are in sync**:
```bash
npx prisma migrate status
```

**Expected output when in sync**:
```
Database schema is up to date!
```

**Expected output when drift exists**:
```
Drift detected: Your database schema is not in sync with your migration history
```

---

### 3. Resolution Strategies

#### Option A: Reset Migrations (Development Only)

**Use when**: Working in local development with disposable data.

**⚠️ WARNING**: This will **PERMANENTLY DELETE ALL DATA** in the database.

**Steps**:
1. Ensure you're working on a local development database (check `DATABASE_URL` in `.env`)
2. Run the reset command:
   ```bash
   PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION="yes" npx prisma migrate reset --force
   ```
3. If seed file is missing (optional):
   - This is normal if you don't have a seed file
   - The migration will still complete successfully
4. Sync any remaining schema changes:
   ```bash
   npx prisma db push --accept-data-loss
   ```
5. Verify status:
   ```bash
   npx prisma migrate status
   ```

**What this does**:
- Drops all tables
- Recreates the database
- Applies all migrations in order
- Generates a fresh Prisma Client

---

#### Option B: Create Baseline Migration

**Use when**: You need to preserve existing data or working in a shared environment.

**Steps**:
1. Create a new migration that captures current state:
   ```bash
   npx prisma migrate dev --name baseline_current_state
   ```
2. Review the generated migration file in `prisma/migrations/`
3. Apply the migration:
   ```bash
   npx prisma migrate deploy
   ```

**What this does**:
- Creates a migration file matching current database state
- Preserves all existing data
- Brings migration history in sync with database

---

#### Option C: Continue with `db push` (Quick Iteration)

**Use when**: Rapidly iterating on schema changes during early development.

**Steps**:
```bash
npx prisma db push --accept-data-loss
```

**Pros**:
- Fast iteration
- No migration files to manage
- Simple workflow

**Cons**:
- No migration history
- Difficult to track changes over time
- Not suitable for production deployments
- Requires manual migration creation later

**When to switch**: Once your schema stabilizes, switch to `prisma migrate dev` to create proper migration files.

---

## Development Workflow

### Quick Iteration Phase (Early Development)

Use `db push` for rapid schema changes:
```bash
# 1. Modify schema.prisma
# 2. Apply changes
npx prisma db push --accept-data-loss

# 3. Generate Prisma Client
npx prisma generate
```

### Stable Schema Phase (Pre-Production)

Switch to proper migrations:
```bash
# 1. Modify schema.prisma
# 2. Create migration
npx prisma migrate dev --name descriptive_change_name

# 3. Commit migration files to git
git add prisma/migrations/
git commit -m "Add migration: descriptive_change_name"
```

---

## Troubleshooting

### Error: "Environment is non-interactive"

**Problem**: Claude Code runs in non-interactive mode, but `prisma migrate dev` requires interaction.

**Solution**: Run the command directly in your terminal, or use `db push` instead:
```bash
npx prisma db push --accept-data-loss
```

### Error: "Cannot find module 'prisma/seed.js'"

**Problem**: Prisma tries to run a seed file after migrations but it doesn't exist.

**Solution**: This is harmless if you don't need seeding. To fix:
1. Create a seed file (optional), or
2. Remove the seed configuration from `package.json` or `prisma.config.ts`

### Error: "Data loss warning"

**Problem**: Schema change would remove data (e.g., removing enum value, adding unique constraint).

**Solutions**:
- Use `--accept-data-loss` flag if safe (empty database, development)
- Manually migrate data before applying schema change
- Split migration into multiple steps (migrate data, then change schema)

---

## Checking for Schema Drift

### Compare schema to database:
```bash
npx prisma migrate diff \
  --from-schema-datamodel ./prisma/schema.prisma \
  --to-schema-datasource ./prisma/schema.prisma \
  --script
```

**Expected output when in sync**:
```sql
-- This is an empty migration.
```

**If drift exists**: You'll see SQL statements showing the differences.

---

## Production Deployment

**Never use `db push` in production**. Always use migrations:

```bash
# Deploy pending migrations
npx prisma migrate deploy

# Verify status
npx prisma migrate status
```

---

## Best Practices

1. **Use migrations for production**: Always create migration files for production deployments
2. **Commit migration files**: Include `prisma/migrations/` in version control
3. **Test migrations**: Test migration on staging before production
4. **Descriptive names**: Use clear migration names: `add_user_roles`, `create_audit_log`
5. **One change per migration**: Keep migrations focused and atomic
6. **Review generated SQL**: Always review migration files before applying
7. **Backup before major changes**: Create database backups before large schema changes

---

## Quick Reference

| Task | Command |
|------|---------|
| Check migration status | `npx prisma migrate status` |
| Create migration | `npx prisma migrate dev --name change_name` |
| Apply migrations | `npx prisma migrate deploy` |
| Reset database (dev only) | `npx prisma migrate reset --force` |
| Quick sync (dev only) | `npx prisma db push --accept-data-loss` |
| Check for drift | `npx prisma migrate diff --from-schema-datamodel ./prisma/schema.prisma --to-schema-datasource ./prisma/schema.prisma --script` |

---

## Related Documentation

- [Prisma Migrate Docs](https://www.prisma.io/docs/concepts/components/prisma-migrate)
- [Deploy Runbook](./deploy.md)
- [Rollback Runbook](./rollback.md)
