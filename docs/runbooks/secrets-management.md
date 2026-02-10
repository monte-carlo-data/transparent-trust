# Secrets Management Runbook

## Overview

This runbook covers credential handling, rotation schedules, and emergency response for compromised secrets.

**Owner:** Security / Platform team

---

## Secret Inventory

| Secret | Location | Rotation Frequency | Last Rotated |
|--------|----------|-------------------|--------------|
| `DATABASE_URL` | Vercel env vars | Quarterly | [Update] |
| `ANTHROPIC_API_KEY` | Vercel env vars | Quarterly | [Update] |
| `NEXTAUTH_SECRET` | Vercel env vars | Annually | [Update] |
| `ENCRYPTION_KEY` | Vercel env vars | Annually | [Update] |
| `GOOGLE_CLIENT_SECRET` | Vercel + Google Cloud | Annually | [Update] |
| `UPSTASH_REDIS_REST_TOKEN` | Vercel + Upstash | Quarterly | [Update] |

---

## Routine Rotation Procedure

### 1. Generate New Secret
```bash
# For NEXTAUTH_SECRET or ENCRYPTION_KEY (32 bytes, base64)
openssl rand -base64 32

# For general tokens
openssl rand -hex 32
```

### 2. Update in Provider
- **Anthropic:** https://console.anthropic.com/settings/keys
- **Google OAuth:** https://console.cloud.google.com/apis/credentials
- **Upstash:** https://console.upstash.com
- **Database:** Update via your hosting provider

### 3. Update Environment Variables
```bash
# Vercel
vercel env rm SECRET_NAME production
vercel env add SECRET_NAME production
# Paste new value when prompted

# Redeploy to apply
vercel --prod
```

### 4. Verify
- [ ] Application starts successfully
- [ ] Auth flow works
- [ ] API calls succeed
- [ ] No errors in logs

### 5. Revoke Old Secret
- Remove old key from provider dashboard
- Confirm old key returns 401/403

---

## Emergency: Compromised Secret Response

### Immediate Actions (within 15 minutes)

1. **Revoke the compromised credential immediately**
   ```bash
   # Don't wait - revoke first, fix later
   ```

2. **Generate and deploy new credential**
   ```bash
   # Generate new secret
   NEW_SECRET=$(openssl rand -base64 32)

   # Update in Vercel
   vercel env rm COMPROMISED_SECRET production
   echo "$NEW_SECRET" | vercel env add COMPROMISED_SECRET production

   # Redeploy
   vercel --prod
   ```

3. **Search for exposure**
   ```bash
   # Check git history
   git log -p --all -S 'COMPROMISED_VALUE' -- .

   # Check for accidental commits
   gitleaks detect --source . --verbose
   ```

4. **Document the incident**
   - What was exposed?
   - How was it exposed?
   - What's the blast radius?

### If Database Credentials Compromised

1. **Immediately** rotate database password
2. Check audit logs for unauthorized access
3. Review recent queries for data exfiltration
4. Consider notifying affected users if data accessed

### If API Keys Compromised (Anthropic, etc.)

1. Revoke key in provider dashboard
2. Check usage/billing for unauthorized calls
3. Generate new key
4. Update all environments using the key

### If Auth Secrets Compromised (NEXTAUTH_SECRET)

1. Rotate immediately - this invalidates all sessions
2. Users will need to re-authenticate
3. Monitor for unusual auth patterns

---

## Preventing Secret Exposure

### In Code
- Never commit secrets to git
- Use `.env.local` for local development (in `.gitignore`)
- Use environment variables, not config files

### In CI/CD
- Use GitHub Secrets for workflow variables
- Never echo secrets in logs
- Use `--silent` flags where possible

### Git Protection
- Gitleaks runs on every PR (see `.github/workflows/secret-detection.yml`)
- Pre-commit hooks can catch secrets locally:
  ```bash
  # Install pre-commit
  pip install pre-commit

  # Add to .pre-commit-config.yaml
  repos:
    - repo: https://github.com/gitleaks/gitleaks
      rev: v8.18.0
      hooks:
        - id: gitleaks
  ```

---

## Related Runbooks

- [Incident Response](./incident-response.md)
- [Deployment](./deploy.md)
