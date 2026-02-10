# Incident Response Runbook

## Overview

This runbook guides the team through identifying, containing, and resolving production incidents.

**Owner:** On-call engineer / Incident Commander

---

## Severity Levels

| Level | Description | Response Time | Examples |
|-------|-------------|---------------|----------|
| **SEV1** | Service down, data breach | Immediate | App completely unavailable, security breach |
| **SEV2** | Major feature broken | < 1 hour | Chat not working, auth failing |
| **SEV3** | Minor feature degraded | < 4 hours | Slow responses, non-critical errors |
| **SEV4** | Cosmetic / low impact | Next business day | UI glitches, minor bugs |

---

## Initial Triage (First 15 minutes)

### 1. Acknowledge and Communicate
- [ ] Acknowledge the alert
- [ ] Create incident channel (Slack: `#incident-YYYY-MM-DD-brief-desc`)
- [ ] Post initial status: "Investigating [symptom]. Impact: [user-facing effect]"

### 2. Gather Information
- [ ] Check error logs: Vercel dashboard or `vercel logs`
- [ ] Check database: `npx prisma studio` or direct PostgreSQL access
- [ ] Check external services: Anthropic API status, auth provider status
- [ ] Review recent deployments: `git log --oneline -10`

### 3. Assess Scope
- What percentage of users affected?
- Which features are impacted?
- When did it start? (correlate with deployments)

---

## Containment Actions

### If caused by recent deployment:
```bash
# Rollback to previous deployment in Vercel
vercel rollback

# Or revert commit and redeploy
git revert HEAD
git push origin main
```

### If caused by external service (Claude API):
- Enable degraded mode messaging to users
- Check https://status.anthropic.com

### If caused by database issues:
```bash
# Check connection
npx prisma db pull

# Check for locks or long queries
# Connect to PostgreSQL and run:
# SELECT * FROM pg_stat_activity WHERE state = 'active';
```

### If security incident:
- [ ] Immediately rotate compromised credentials
- [ ] Revoke affected API keys
- [ ] Follow `docs/runbooks/secrets-management.md`
- [ ] Document timeline for post-mortem

---

## Communication Templates

### Initial Update
```
[INVESTIGATING] We're aware of issues with [feature].
Users may experience [symptom].
We're actively investigating and will provide updates every 30 minutes.
```

### Resolution Update
```
[RESOLVED] The issue with [feature] has been resolved.
Root cause: [brief explanation]
Duration: [start time] to [end time]
We apologize for any inconvenience.
```

---

## Post-Incident

### Within 24 hours:
- [ ] Write post-mortem document
- [ ] Identify root cause
- [ ] List contributing factors
- [ ] Define action items with owners and due dates

### Post-Mortem Template
```markdown
## Incident: [Title]
**Date:** YYYY-MM-DD
**Duration:** X hours Y minutes
**Severity:** SEV[1-4]
**Author:** [Name]

### Summary
[1-2 sentence summary]

### Timeline
- HH:MM - [Event]
- HH:MM - [Event]

### Root Cause
[Detailed explanation]

### Impact
- Users affected: [number/percentage]
- Features impacted: [list]

### Action Items
| Action | Owner | Due Date | Status |
|--------|-------|----------|--------|
| [Task] | @name | YYYY-MM-DD | Open |

### Lessons Learned
- What went well
- What could be improved
```

---

## Escalation Contacts

| Role | Contact | When to Escalate |
|------|---------|------------------|
| Primary On-Call | [Update] | First responder |
| Secondary On-Call | [Update] | If primary unavailable |
| Engineering Lead | [Update] | SEV1/SEV2 incidents |
| Security Lead | [Update] | Security incidents |

---

## Related Runbooks

- [Secrets Management](./secrets-management.md)
- [Deployment](./deploy.md)
- [Rollback](./rollback.md)
