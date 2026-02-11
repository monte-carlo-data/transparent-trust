# Rollback Runbook

## Overview

This runbook covers procedures for rolling back to a previous deployment when issues are detected in production.

**Owner:** On-call engineer

---

## When to Rollback

Rollback immediately if:
- Application is down or returning 500 errors
- Critical feature is broken (auth, chat, data access)
- Security vulnerability introduced
- Data corruption occurring

Consider rollback if:
- Significant performance degradation
- High error rate in logs
- User-facing bugs affecting many users

---

## Rollback Methods

### Method 1: Vercel Dashboard (Fastest)

1. Go to [Vercel Dashboard](https://vercel.com)
2. Select your project
3. Go to "Deployments" tab
4. Find the last known good deployment
5. Click the three dots menu → "Promote to Production"

### Method 2: Vercel CLI

```bash
# List recent deployments
vercel ls

# Rollback to specific deployment
vercel rollback [deployment-url]

# Or rollback to previous deployment
vercel rollback
```

### Method 3: Git Revert (If code fix needed)

```bash
# Identify the bad commit
git log --oneline -10

# Revert the commit
git revert <commit-hash>

# Push to trigger new deployment
git push origin main
```

---

## Rollback Checklist

### Before Rolling Back

- [ ] Confirm the issue is caused by the new deployment
- [ ] Note the current deployment URL for reference
- [ ] Notify team in incident channel

### After Rolling Back

- [ ] Verify application is working
- [ ] Check logs for errors
- [ ] Run smoke tests (see [Deploy Runbook](./deploy.md))
- [ ] Update incident channel with status

---

## Database Rollback Considerations

**Warning:** Code rollback does NOT rollback database migrations.

### If migration is backward-compatible:
- Rollback code normally
- Old code should work with new schema

### If migration is NOT backward-compatible:
- You may need to manually revert the migration
- **This is risky** - consult with team before proceeding

```bash
# Check migration status
npx prisma migrate status

# Manually revert (DANGEROUS - may cause data loss)
# Only do this if you understand the consequences
npx prisma migrate resolve --rolled-back <migration-name>
```

### Best Practice
- Make migrations backward-compatible when possible
- Deploy schema changes separately from code changes
- Use feature flags for risky changes

---

## Rollback Scenarios

### Scenario 1: Bad Code Deploy

**Symptoms:** New feature is broken, errors in logs
**Action:** Rollback via Vercel dashboard
**Recovery:** Fix code, test, redeploy

### Scenario 2: Environment Variable Issue

**Symptoms:** "Missing environment variable" errors
**Action:**
1. Check Vercel env vars
2. Add/fix missing variable
3. Redeploy (rollback may not help)

### Scenario 3: Database Migration Failure

**Symptoms:** Database errors, missing columns
**Action:**
1. Check migration status: `npx prisma migrate status`
2. If migration partially applied, may need manual intervention
3. Contact database admin if unsure

### Scenario 4: External Service Failure

**Symptoms:** Claude API errors, auth provider issues
**Action:**
1. Check external service status pages
2. Rollback won't help - wait for service recovery
3. Consider enabling degraded mode

---

## Post-Rollback

1. **Investigate root cause** - Don't just rollback and forget
2. **Document in incident report** - What went wrong?
3. **Fix and test** - Ensure the fix is tested before redeploying
4. **Add tests** - Prevent regression

---

## Emergency Contacts

| Role | Contact | Responsibility |
|------|---------|----------------|
| On-Call Engineer | [Update] | First responder |
| Engineering Lead | [Update] | Escalation |
| Database Admin | [Update] | Migration issues |

---

## Related Runbooks

- [Deployment](./deploy.md)
- [Incident Response](./incident-response.md)
