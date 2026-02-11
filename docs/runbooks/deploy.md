# Deployment Runbook

## Overview

This runbook covers deployment procedures for the Transparent RFP Copilot application to AWS using Terraform and ECS/Fargate.

**Owner:** Engineering team

**Access:** Application is deployed on internal ALB with Tailscale-only access (no public internet).

---

## Deployment Environments

| Environment | Domain | Terraform Path | Auto-deploy |
|-------------|--------|----------------|-------------|
| Production | `transparent-trust.prod.example.com` | `infrastructure/env/prod` | Manual |
| Development | `transparent-trust.dev.example.com` | `infrastructure/env/dev` | Manual |

**Access Requirement:** Tailscale VPN connected to VPC

---

## Pre-Deployment Checklist

### Before Deploying

- [ ] All tests pass locally: `npm run test` (if tests exist)
- [ ] Build succeeds: `npm run build`
- [ ] Lint passes: `npm run lint`
- [ ] TypeScript compiles: `npx tsc --noEmit`
- [ ] Database migrations are ready
- [ ] PR reviewed and approved (if applicable)
- [ ] AWS credentials configured
- [ ] Tailscale connected to VPC

### Infrastructure Prerequisites

- [ ] Terraform state bootstrapped (one-time)
- [ ] ACM certificate for `*.example.com`
- [ ] Route53 private hosted zone for `example.com`
- [ ] Tailscale app connector configured
- [ ] Required secrets stored in Secrets Manager

---

## Standard Deployment Workflow

### 1. Build Docker Image

```bash
# Navigate to project root
cd /path/to/transparent-trust

# Build Docker image
docker build -t transparent-trust:latest .

# Test image locally (optional)
docker run -p 3000:3000 \
  -e DATABASE_URL="postgresql://..." \
  -e NEXTAUTH_URL="http://localhost:3000" \
  -e NEXTAUTH_SECRET="test-secret" \
  transparent-trust:latest
```

### 2. Push to ECR

```bash
# Get ECR login
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin <AWS_ACCOUNT_ID>.dkr.ecr.us-east-1.amazonaws.com

# Tag image
docker tag transparent-trust:latest \
  <AWS_ACCOUNT_ID>.dkr.ecr.us-east-1.amazonaws.com/transparent-trust-production:latest

# Also tag with git commit SHA for rollback capability
docker tag transparent-trust:latest \
  <AWS_ACCOUNT_ID>.dkr.ecr.us-east-1.amazonaws.com/transparent-trust-production:$(git rev-parse --short HEAD)

# Push both tags
docker push <AWS_ACCOUNT_ID>.dkr.ecr.us-east-1.amazonaws.com/transparent-trust-production:latest
docker push <AWS_ACCOUNT_ID>.dkr.ecr.us-east-1.amazonaws.com/transparent-trust-production:$(git rev-parse --short HEAD)
```

### 3. Run Database Migrations

**Important:** Run migrations BEFORE deploying new code to avoid downtime.

```bash
# Connect via Tailscale (must be connected to VPC)
export DATABASE_URL="postgresql://dbadmin:PASSWORD@transparent-trust-db-production.xxxxx.us-east-1.rds.amazonaws.com:5432/transparenttrust?sslmode=require"

# Generate Prisma client
npx prisma generate

# Deploy migrations
npx prisma migrate deploy

# Verify
npx prisma db pull
```

**Alternative:** Run migrations from ECS task:

```bash
# Create one-off ECS task for migrations
aws ecs run-task \
  --cluster transparent-trust-cluster-production \
  --task-definition transparent-trust-migration-task \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-xxx],securityGroups=[sg-xxx]}"
```

### 4. Deploy to ECS

```bash
# Navigate to environment directory
cd infrastructure/env/prod

# Initialize Terraform (first time only)
terraform init

# Review changes
terraform plan

# Apply infrastructure changes
terraform apply

# Force new deployment (if only container image changed)
aws ecs update-service \
  --cluster transparent-trust-cluster-production \
  --service transparent-trust-service-production \
  --force-new-deployment
```

### 5. Monitor Deployment

```bash
# Watch ECS service events
aws ecs describe-services \
  --cluster transparent-trust-cluster-production \
  --services transparent-trust-service-production \
  --query 'services[0].events[0:5]'

# Stream CloudWatch logs
aws logs tail /aws/ecs/transparent-trust-production --follow

# Check task health
aws ecs list-tasks \
  --cluster transparent-trust-cluster-production \
  --service-name transparent-trust-service-production

# Describe specific task
aws ecs describe-tasks \
  --cluster transparent-trust-cluster-production \
  --tasks <task-arn>
```

---

## Post-Deployment Verification

### Smoke Tests (Manual)

Connect to Tailscale VPN, then:

1. [ ] Access application: `https://transparent-trust-prod.example.com`
2. [ ] Home page loads without errors
3. [ ] Authentication works (Google OAuth sign in/out)
4. [ ] Chat functionality works
5. [ ] Knowledge library loads
6. [ ] File upload works (test with small CSV)
7. [ ] No console errors in browser
8. [ ] Check CloudWatch logs for errors

### Health Checks

```bash
# Via Tailscale
curl -I https://transparent-trust-prod.example.com/api/health

# Check ALB target health
aws elbv2 describe-target-health \
  --target-group-arn <target-group-arn>
```

### Database Verification

```bash
# Connect to database
psql "$DATABASE_URL"

# Check migrations
SELECT * FROM _prisma_migrations ORDER BY finished_at DESC LIMIT 5;

# Verify tables exist
\dt

# Check record counts (optional)
SELECT COUNT(*) FROM "User";
SELECT COUNT(*) FROM "Skill";
```

---

## Deployment Failures

### Build Failure

**Symptoms:** Docker build fails locally or in CI/CD

**Troubleshooting:**
```bash
# Check for TypeScript errors
npx tsc --noEmit

# Check for missing dependencies
npm ci
npm run build

# Review Dockerfile
docker build --no-cache -t transparent-trust:debug .
```

**Common Issues:**
- Missing environment variables in build
- TypeScript compilation errors
- Missing dependencies in package.json
- Prisma client not generated

### Push to ECR Failure

**Symptoms:** `docker push` fails with authentication error

**Troubleshooting:**
```bash
# Verify ECR repository exists
aws ecr describe-repositories --repository-names transparent-trust-production

# Re-authenticate
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin <account>.dkr.ecr.us-east-1.amazonaws.com

# Check IAM permissions
aws sts get-caller-identity
```

### ECS Task Failed to Start

**Symptoms:** New tasks stop immediately after starting

**Troubleshooting:**
```bash
# Check stopped tasks
aws ecs list-tasks \
  --cluster transparent-trust-cluster-production \
  --desired-status STOPPED \
  --max-results 5

# Get failure reason
aws ecs describe-tasks \
  --cluster transparent-trust-cluster-production \
  --tasks <task-arn> \
  --query 'tasks[0].stoppedReason'

# Check CloudWatch logs
aws logs tail /aws/ecs/transparent-trust-production --since 10m
```

**Common Issues:**
- Missing or incorrect environment variables
- Cannot pull image from ECR (check execution role)
- Cannot retrieve secrets (check task role)
- Application crashes on startup (check logs)
- Health check failing (check `/api/health` endpoint)

### Database Migration Failure

**Symptoms:** `prisma migrate deploy` fails

**Troubleshooting:**
```bash
# Check database connectivity
psql "$DATABASE_URL" -c "SELECT version();"

# Check pending migrations
npx prisma migrate status

# Check migration history
psql "$DATABASE_URL" -c "SELECT * FROM _prisma_migrations;"

# Reset and retry (CAUTION: only for dev)
npx prisma migrate reset  # DO NOT run in production
```

**Recovery:**
- Review migration file for SQL errors
- Check database permissions
- Manually apply failed migration if safe
- Rollback if migration corrupts data

### Application Runtime Failure

**Symptoms:** Tasks start but application errors in logs

**Troubleshooting:**
```bash
# Stream logs
aws logs tail /aws/ecs/transparent-trust-production --follow

# Search for errors
aws logs filter-log-events \
  --log-group-name /aws/ecs/transparent-trust-production \
  --filter-pattern "ERROR" \
  --start-time $(date -u -d '10 minutes ago' +%s)000

# Check CloudWatch Insights
# Navigate to CloudWatch Console → Logs → Insights
# Query: fields @timestamp, @message | filter @message like /ERROR/ | sort @timestamp desc
```

**Common Issues:**
- Database connection timeout (check security groups)
- Missing secrets (check Secrets Manager)
- Redis connection failure (check ElastiCache or Upstash)
- S3 permission denied (check IAM task role)
- Anthropic API key invalid

---

## Rollback Procedures

### Rollback to Previous Image

```bash
# List recent images
aws ecr describe-images \
  --repository-name transparent-trust-production \
  --query 'sort_by(imageDetails,& imagePushedAt)[-5:].[imageTags[0], imagePushedAt]'

# Update task definition to use previous image
# Edit: infrastructure/env/prod/terraform.tfvars
# Change: container_image = "<account>.dkr.ecr.us-east-1.amazonaws.com/transparent-trust-production:<previous-tag>"

# Apply
terraform apply

# Or force deployment with specific image
aws ecs update-service \
  --cluster transparent-trust-cluster-production \
  --service transparent-trust-service-production \
  --force-new-deployment \
  --task-definition transparent-trust-app:<previous-revision>
```

### Rollback Database Migration

**CAUTION:** Database rollbacks are risky. Only proceed if you have a backup.

```bash
# Check migration history
npx prisma migrate status

# Restore from RDS snapshot (if needed)
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier transparent-trust-db-production-restored \
  --db-snapshot-identifier <snapshot-id>

# Manual rollback (if safe)
psql "$DATABASE_URL" -f prisma/migrations/<version>/down.sql
```

See [rollback.md](./rollback.md) for detailed rollback procedures.

---

## Infrastructure Changes

### Updating Terraform Configuration

```bash
# Navigate to environment
cd infrastructure/env/prod

# Edit configuration
vim main.tf  # or variables.tf, terraform.tfvars

# Validate syntax
terraform validate

# Review changes
terraform plan -out=tfplan

# Apply changes
terraform apply tfplan

# Verify no drift
terraform plan
```

### Scaling ECS Service

```bash
# Scale up manually
aws ecs update-service \
  --cluster transparent-trust-cluster-production \
  --service transparent-trust-service-production \
  --desired-count 5

# Or update Terraform
# Edit: infrastructure/env/prod/terraform.tfvars
# Set: ecs_desired_count = 5
terraform apply
```

### Updating Secrets

```bash
# Update secret value
aws secretsmanager update-secret \
  --secret-id transparent-trust-anthropic-api-key-production \
  --secret-string "sk-ant-new-key..."

# Force new deployment to pick up new secrets
aws ecs update-service \
  --cluster transparent-trust-cluster-production \
  --service transparent-trust-service-production \
  --force-new-deployment
```

---

## Environment Variables

### Required Secrets (Secrets Manager)

All secrets are stored in AWS Secrets Manager and automatically injected into ECS tasks:

| Secret Name | Description |
|-------------|-------------|
| `transparent-trust-db-credentials-production` | Database username and password |
| `transparent-trust-nextauth-secret-production` | NextAuth session encryption key |
| `transparent-trust-anthropic-api-key-production` | Claude API key |
| `transparent-trust-google-oauth-production` | Google OAuth client ID and secret |
| `transparent-trust-encryption-key-production` | Application settings encryption key |
| `transparent-trust-redis-credentials-production` | Redis URL and token (optional) |

### Viewing Secrets

```bash
# List secrets
aws secretsmanager list-secrets --query 'SecretList[?starts_with(Name, `transparent-trust`)].Name'

# Get secret value
aws secretsmanager get-secret-value \
  --secret-id transparent-trust-anthropic-api-key-production \
  --query SecretString --output text
```

---

## Monitoring

### CloudWatch Dashboards

Access dashboards:
- Production: https://console.aws.amazon.com/cloudwatch/home?region=us-east-1#dashboards:name=transparent-trust-production

### CloudWatch Alarms

Monitor alarms:
```bash
# List active alarms
aws cloudwatch describe-alarms \
  --alarm-name-prefix transparent-trust-production \
  --state-value ALARM

# Get alarm history
aws cloudwatch describe-alarm-history \
  --alarm-name transparent-trust-production-high-error-rate \
  --max-records 10
```

### Logs

```bash
# Tail logs
aws logs tail /aws/ecs/transparent-trust-production --follow

# Search logs
aws logs filter-log-events \
  --log-group-name /aws/ecs/transparent-trust-production \
  --filter-pattern "ERROR" \
  --start-time $(date -u -d '1 hour ago' +%s)000

# CloudWatch Insights query examples
fields @timestamp, @message
| filter @message like /ERROR/
| sort @timestamp desc
| limit 20
```

---

## Tailscale Connectivity

### Verify Tailscale Connection

```bash
# Check Tailscale status
tailscale status

# Test connectivity to ALB
curl -I https://transparent-trust-prod.example.com

# Test connectivity to RDS (from local machine)
psql "postgresql://dbadmin:PASSWORD@transparent-trust-db-production.xxxxx.us-east-1.rds.amazonaws.com:5432/transparenttrust?sslmode=require" -c "SELECT 1;"
```

### Troubleshooting Tailscale

If you cannot access the application:

1. Ensure Tailscale client is running
2. Verify you're connected to the correct tailnet
3. Check Tailscale app connector is running in AWS
4. Verify DNS resolution: `nslookup transparent-trust-prod.example.com`
5. Check Route53 private hosted zone records

See the Tailscale and bastion configuration in [infrastructure/modules/bastion/](../../infrastructure/modules/bastion/) for detailed setup.

---

## Emergency Procedures

### Service Unavailable

1. Check ECS service status
2. Check ALB target health
3. Review CloudWatch logs for errors
4. Check CloudWatch alarms
5. Verify Tailscale connectivity
6. If needed, rollback to previous version

### Database Connection Issues

1. Check RDS instance status
2. Verify security group rules
3. Test connection from ECS task
4. Check database credentials in Secrets Manager
5. Review RDS connections CloudWatch metric

### High Error Rate

1. Check CloudWatch logs for error patterns
2. Review recent deployments
3. Check external service dependencies (Anthropic API)
4. Verify secrets are valid
5. Consider rollback if recent deployment

---

## Related Runbooks

- [Rollback](./rollback.md) - Rollback procedures
- [Incident Response](./incident-response.md) - Incident response procedures
- [Database Migration](./database-migration.md) - Database migration procedures
- [Secrets Management](./secrets-management.md) - Managing secrets

---

## Support

For questions or issues:
- **Linear**: Link to relevant issue tracker
- **Repository**: [transparent-trust](https://github.com/your-org/transparent-trust)
- **AWS Console**: [ECS Services](https://console.aws.amazon.com/ecs/home?region=us-east-1#/clusters/transparent-trust-cluster-production/services)
