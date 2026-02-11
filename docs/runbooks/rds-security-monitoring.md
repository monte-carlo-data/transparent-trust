# RDS Security Monitoring Runbook

This runbook provides step-by-step procedures for monitoring, auditing, and responding to RDS security events.

## Table of Contents

- [Daily Security Checks](#daily-security-checks)
- [Weekly Security Review](#weekly-security-review)
- [Monthly Security Audit](#monthly-security-audit)
- [Security Alert Response](#security-alert-response)
- [Credential Rotation](#credential-rotation)
- [Security Incident Response](#security-incident-response)
- [Compliance Reporting](#compliance-reporting)

## Daily Security Checks

**Time Required**: 10-15 minutes
**Frequency**: Daily (automated where possible)
**Responsible**: On-call engineer / Security team

### 1. Check CloudWatch Alarms

```bash
# View alarm status
aws cloudwatch describe-alarms \
  --alarm-name-prefix your-app-db-production \
  --state-value ALARM \
  --query 'MetricAlarms[*].{Name:AlarmName,State:StateValue,Reason:StateReason}' \
  --output table
```

**Action**: If any alarms are in ALARM state, investigate immediately.

### 2. Review Failed Connection Attempts

```bash
# Search for authentication failures in last 24 hours
aws logs filter-log-events \
  --log-group-name /aws/rds/instance/your-app-db-production/postgresql \
  --filter-pattern "authentication failed" \
  --start-time $(($(date +%s) - 86400))000 \
  --query 'events[*].message' \
  --output text | wc -l
```

**Thresholds**:
- 0-5 failures: Normal (expected from transient errors)
- 6-20 failures: Monitor (check for patterns)
- 20+ failures: Investigate immediately (possible attack)

**Investigation**:
```bash
# Get details of failed attempts
aws logs filter-log-events \
  --log-group-name /aws/rds/instance/your-app-db-production/postgresql \
  --filter-pattern "authentication failed" \
  --start-time $(($(date +%s) - 86400))000 \
  --query 'events[*].message' \
  --output text
```

### 3. Check Current Database Connections

```bash
# Connect to database
psql "postgresql://dbadmin:PASSWORD@<endpoint>:5432/transparenttrust?sslmode=require"

# Check connection count by user
SELECT usename, count(*) as connections
FROM pg_stat_activity
WHERE state != 'idle'
GROUP BY usename
ORDER BY connections DESC;

# Check for long-running queries
SELECT pid, usename, application_name,
       now() - query_start as duration,
       state, query
FROM pg_stat_activity
WHERE state != 'idle'
  AND now() - query_start > interval '5 minutes'
ORDER BY duration DESC;
```

**Action**: Investigate any unusual connection patterns or long-running queries.

### 4. Review Recent CloudTrail Events

```bash
# Check for RDS modifications in last 24 hours
aws cloudtrail lookup-events \
  --lookup-attributes AttributeKey=ResourceType,AttributeValue=AWS::RDS::DBInstance \
  --start-time $(date -u -d '24 hours ago' --iso-8601=seconds) \
  --query 'Events[*].{Time:EventTime,User:Username,Action:EventName,Instance:Resources[0].ResourceName}' \
  --output table
```

**Review for**:
- Unexpected ModifyDBInstance calls
- Security group modifications
- Parameter group changes
- Snapshot operations by unknown users

### 5. Check Database Performance

```bash
# Check CPU utilization
aws cloudwatch get-metric-statistics \
  --namespace AWS/RDS \
  --metric-name CPUUtilization \
  --dimensions Name=DBInstanceIdentifier,Value=your-app-db-production \
  --start-time $(date -u -d '1 hour ago' --iso-8601=seconds) \
  --end-time $(date -u --iso-8601=seconds) \
  --period 300 \
  --statistics Average,Maximum \
  --query 'Datapoints[*].{Time:Timestamp,Avg:Average,Max:Maximum}' \
  --output table
```

**Thresholds**:
- < 70%: Normal
- 70-85%: Monitor
- > 85%: Investigate (possible DoS or inefficient queries)

## Weekly Security Review

**Time Required**: 30-45 minutes
**Frequency**: Weekly
**Responsible**: Security team

### 1. Audit Database Users

```sql
-- List all database users
SELECT usename, valuntil as password_expiry,
       usesuper, usecreatedb, usecreaterole
FROM pg_user
ORDER BY usename;

-- Check user permissions
SELECT grantee, privilege_type, table_schema, table_name
FROM information_schema.table_privileges
WHERE grantee NOT IN ('postgres', 'rds_superuser', 'rdsadmin')
ORDER BY grantee, table_schema, table_name;
```

**Review checklist**:
- [ ] Remove unused user accounts
- [ ] Verify each user has appropriate permissions
- [ ] Check for users with excessive privileges
- [ ] Ensure no users have empty passwords (if password auth used)

### 2. Review Security Group Configuration

```bash
# Get RDS security group
RDS_SG=$(aws rds describe-db-instances \
  --db-instance-identifier your-app-db-production \
  --query 'DBInstances[0].VpcSecurityGroups[0].VpcSecurityGroupId' \
  --output text)

# Check security group rules
aws ec2 describe-security-groups \
  --group-ids $RDS_SG \
  --query 'SecurityGroups[0].IpPermissions[*].{
    Port:FromPort,
    Protocol:IpProtocol,
    SourceSG:UserIdGroupPairs[0].GroupId,
    SourceCIDR:IpRanges[*].CidrIp
  }' \
  --output table
```

**Verify**:
- [ ] Only port 5432 is open
- [ ] Only application security group has access (no CIDR blocks)
- [ ] No 0.0.0.0/0 access
- [ ] No unauthorized security group references

### 3. Analyze Query Patterns

```sql
-- Top 10 most executed queries (requires pg_stat_statements)
SELECT calls, total_exec_time, mean_exec_time, query
FROM pg_stat_statements
ORDER BY calls DESC
LIMIT 10;

-- Top 10 slowest queries
SELECT calls, total_exec_time, mean_exec_time, query
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;

-- Reset statistics for next week
SELECT pg_stat_statements_reset();
```

**Look for**:
- Unusual query patterns
- Unexpected table scans
- Queries accessing sensitive data
- Potential SQL injection attempts

### 4. Review CloudWatch Logs for Suspicious Activity

```bash
# Search for DDL statements in last 7 days
aws logs filter-log-events \
  --log-group-name /aws/rds/instance/your-app-db-production/postgresql \
  --filter-pattern "DROP TABLE" \
  --start-time $(($(date +%s) - 604800))000

aws logs filter-log-events \
  --log-group-name /aws/rds/instance/your-app-db-production/postgresql \
  --filter-pattern "ALTER TABLE" \
  --start-time $(($(date +%s) - 604800))000

aws logs filter-log-events \
  --log-group-name /aws/rds/instance/your-app-db-production/postgresql \
  --filter-pattern "TRUNCATE" \
  --start-time $(($(date +%s) - 604800))000
```

**Action**: Verify all DDL statements are authorized and expected.

### 5. Check Backup Status

```bash
# Verify recent automated backups
aws rds describe-db-snapshots \
  --db-instance-identifier your-app-db-production \
  --snapshot-type automated \
  --query 'DBSnapshots[*].{
    ID:DBSnapshotIdentifier,
    Time:SnapshotCreateTime,
    Status:Status,
    Size:AllocatedStorage
  }' \
  --output table | head -20

# Check backup retention
aws rds describe-db-instances \
  --db-instance-identifier your-app-db-production \
  --query 'DBInstances[0].BackupRetentionPeriod'
```

**Verify**:
- [ ] Daily backups are being created
- [ ] Backups are completing successfully
- [ ] Retention period is 7+ days
- [ ] Backup size is as expected

## Monthly Security Audit

**Time Required**: 2-3 hours
**Frequency**: Monthly
**Responsible**: Security team + DevOps lead

### 1. Full Configuration Review

```bash
# Export full RDS configuration
aws rds describe-db-instances \
  --db-instance-identifier your-app-db-production \
  --output json > rds-config-$(date +%Y%m%d).json

# Review configuration
jq '{
  Instance: .DBInstances[0].DBInstanceIdentifier,
  Engine: .DBInstances[0].EngineVersion,
  MultiAZ: .DBInstances[0].MultiAZ,
  PubliclyAccessible: .DBInstances[0].PubliclyAccessible,
  StorageEncrypted: .DBInstances[0].StorageEncrypted,
  DeletionProtection: .DBInstances[0].DeletionProtection,
  BackupRetention: .DBInstances[0].BackupRetentionPeriod,
  MonitoringInterval: .DBInstances[0].MonitoringInterval,
  PerformanceInsights: .DBInstances[0].PerformanceInsightsEnabled,
  IAMAuth: .DBInstances[0].IAMDatabaseAuthenticationEnabled
}' rds-config-$(date +%Y%m%d).json
```

**Checklist**:
- [ ] All security features are enabled as expected
- [ ] Configuration matches Terraform state
- [ ] No unauthorized changes have been made
- [ ] PostgreSQL version is current (check for security updates)

### 2. Access Control Audit

```sql
-- Full user and permission audit
\du+

-- Check role memberships
SELECT r.rolname, r.rolsuper, r.rolinherit,
  r.rolcreaterole, r.rolcreatedb, r.rolcanlogin,
  ARRAY(SELECT b.rolname
        FROM pg_catalog.pg_auth_members m
        JOIN pg_catalog.pg_roles b ON (m.roleid = b.oid)
        WHERE m.member = r.oid) as memberof
FROM pg_catalog.pg_roles r
ORDER BY 1;

-- Check database privileges
SELECT datname, datacl FROM pg_database;

-- Check schema privileges
SELECT schema_name, schema_owner FROM information_schema.schemata;

-- Check table-level privileges
SELECT schemaname, tablename, tableowner,
       has_table_privilege('app_user', schemaname||'.'||tablename, 'SELECT') as app_select,
       has_table_privilege('app_user', schemaname||'.'||tablename, 'INSERT') as app_insert,
       has_table_privilege('app_user', schemaname||'.'||tablename, 'UPDATE') as app_update,
       has_table_privilege('app_user', schemaname||'.'||tablename, 'DELETE') as app_delete
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
```

**Document**:
- All database users and their purposes
- Permission grants and their justifications
- Any deviations from principle of least privilege
- Remediation actions needed

### 3. Network Security Review

```bash
# Review VPC configuration
VPC_ID=$(aws rds describe-db-instances \
  --db-instance-identifier your-app-db-production \
  --query 'DBInstances[0].DBSubnetGroup.VpcId' \
  --output text)

# Check subnets
aws rds describe-db-instances \
  --db-instance-identifier your-app-db-production \
  --query 'DBInstances[0].DBSubnetGroup.Subnets[*].{
    SubnetId:SubnetIdentifier,
    AZ:SubnetAvailabilityZone.Name,
    Status:SubnetStatus
  }' \
  --output table

# Verify subnets are private (no IGW route)
for subnet in $(aws rds describe-db-instances \
  --db-instance-identifier your-app-db-production \
  --query 'DBInstances[0].DBSubnetGroup.Subnets[*].SubnetIdentifier' \
  --output text); do

  echo "Subnet: $subnet"
  ROUTE_TABLE=$(aws ec2 describe-route-tables \
    --filters "Name=association.subnet-id,Values=$subnet" \
    --query 'RouteTables[0].RouteTableId' \
    --output text)

  echo "Routes:"
  aws ec2 describe-route-tables \
    --route-table-ids $ROUTE_TABLE \
    --query 'RouteTables[0].Routes[*].{
      Dest:DestinationCidrBlock,
      Target:GatewayId
    }' \
    --output table
done
```

**Verify**:
- [ ] RDS is in private subnets
- [ ] No direct route to Internet Gateway
- [ ] NAT Gateway is used for outbound if needed
- [ ] VPC Flow Logs are enabled

### 4. Encryption Audit

```bash
# Verify encryption at rest
aws rds describe-db-instances \
  --db-instance-identifier your-app-db-production \
  --query 'DBInstances[0].{
    Encrypted:StorageEncrypted,
    KMSKey:KmsKeyId
  }'

# Check KMS key configuration
KMS_KEY=$(aws rds describe-db-instances \
  --db-instance-identifier your-app-db-production \
  --query 'DBInstances[0].KmsKeyId' \
  --output text)

aws kms describe-key --key-id $KMS_KEY \
  --query 'KeyMetadata.{
    KeyState:KeyState,
    Enabled:Enabled,
    KeyUsage:KeyUsage
  }'

# Check key rotation
aws kms get-key-rotation-status --key-id $KMS_KEY

# Verify SSL enforcement
aws rds describe-db-parameters \
  --db-parameter-group-name your-app-db-params-production \
  --query "Parameters[?ParameterName=='rds.force_ssl'].{
    Name:ParameterName,
    Value:ParameterValue
  }"
```

**Verify**:
- [ ] Storage encryption is enabled
- [ ] KMS key is active and enabled
- [ ] Automatic key rotation is enabled
- [ ] SSL/TLS is enforced (rds.force_ssl=1)

### 5. Log Analysis

```bash
# Generate monthly log summary
cat > log_analysis.sh << 'EOF'
#!/bin/bash
START_TIME=$(($(date +%s) - 2592000))000  # 30 days ago
LOG_GROUP="/aws/rds/instance/your-app-db-production/postgresql"

echo "=== Monthly Log Analysis Report ==="
echo "Period: $(date -d @$((START_TIME/1000))) to $(date)"
echo ""

echo "Failed Authentications:"
aws logs filter-log-events \
  --log-group-name $LOG_GROUP \
  --filter-pattern "authentication failed" \
  --start-time $START_TIME \
  --query 'events[*].message' \
  --output text | wc -l

echo ""
echo "DDL Operations:"
echo "DROP statements:"
aws logs filter-log-events \
  --log-group-name $LOG_GROUP \
  --filter-pattern "DROP" \
  --start-time $START_TIME \
  --query 'events[*].message' \
  --output text | wc -l

echo "ALTER statements:"
aws logs filter-log-events \
  --log-group-name $LOG_GROUP \
  --filter-pattern "ALTER" \
  --start-time $START_TIME \
  --query 'events[*].message' \
  --output text | wc -l

echo ""
echo "Connection Statistics:"
aws logs filter-log-events \
  --log-group-name $LOG_GROUP \
  --filter-pattern "connection authorized" \
  --start-time $START_TIME \
  --query 'events[*].message' \
  --output text | wc -l
EOF

chmod +x log_analysis.sh
./log_analysis.sh
```

### 6. Compliance Check

Run automated compliance scanning:

```bash
# AWS Config compliance check
aws configservice describe-compliance-by-config-rule \
  --compliance-types NON_COMPLIANT \
  --query 'ComplianceByConfigRules[?contains(ConfigRuleName, `rds`) == `true`]'

# If using Prowler
prowler aws -s rds -M json html
```

**Generate compliance report** documenting:
- All security controls in place
- Any non-compliant items and remediation plans
- Evidence of encryption, backups, monitoring
- Access control documentation

## Security Alert Response

### High Connection Count Alert

**Alert**: `your-app-db-production-high-connections`

**Response Time**: Immediate (< 5 minutes)

**Steps**:

1. Check current connections:
```bash
psql -c "SELECT count(*) FROM pg_stat_activity WHERE state != 'idle';"
```

2. Identify source:
```sql
SELECT client_addr, usename, count(*) as connections
FROM pg_stat_activity
GROUP BY client_addr, usename
ORDER BY connections DESC;
```

3. Check for connection leak:
```sql
SELECT usename, application_name, count(*) as connections,
       max(now() - backend_start) as oldest_connection
FROM pg_stat_activity
GROUP BY usename, application_name
ORDER BY connections DESC;
```

4. If DoS attack suspected:
```sql
-- Terminate connections from suspicious source
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE client_addr = '<suspicious-ip>';
```

5. Update security group if needed:
```bash
aws ec2 revoke-security-group-ingress \
  --group-id <rds-sg-id> \
  --source-group <compromised-app-sg-id> \
  --protocol tcp \
  --port 5432
```

### Failed Authentication Alert

**Alert**: Multiple authentication failures detected

**Response Time**: < 15 minutes

**Steps**:

1. Review failed attempts:
```bash
aws logs filter-log-events \
  --log-group-name /aws/rds/instance/your-app-db-production/postgresql \
  --filter-pattern "authentication failed" \
  --start-time $(($(date +%s) - 3600))000
```

2. Identify if brute force:
```bash
aws logs filter-log-events \
  --log-group-name /aws/rds/instance/your-app-db-production/postgresql \
  --filter-pattern "password authentication failed" \
  --start-time $(($(date +%s) - 3600))000 | \
  jq -r '.events[].message' | \
  grep -oP 'user=\w+' | \
  sort | uniq -c | sort -nr
```

3. If attack detected, rotate credentials immediately:
```bash
aws secretsmanager rotate-secret \
  --secret-id your-app-db-credentials-production
```

4. Review security group for unauthorized changes
5. Check CloudTrail for suspicious API activity
6. Document incident and escalate if needed

### High CPU Alert

**Alert**: `your-app-db-production-high-cpu`

**Response Time**: < 10 minutes

**Steps**:

1. Check Performance Insights (AWS Console)

2. Identify active queries:
```sql
SELECT pid, usename, application_name,
       now() - query_start as duration,
       state, wait_event_type, wait_event, query
FROM pg_stat_activity
WHERE state = 'active'
ORDER BY duration DESC;
```

3. Check for runaway queries:
```sql
-- Queries running > 5 minutes
SELECT pid, usename, query_start, query
FROM pg_stat_activity
WHERE state = 'active'
  AND now() - query_start > interval '5 minutes';
```

4. If security concern (unusual query pattern):
```sql
-- Terminate suspicious query
SELECT pg_terminate_backend(<pid>);
```

5. Review query in Performance Insights for optimization

## Credential Rotation

### Monthly Credential Rotation

**Schedule**: 1st day of each month
**Time Required**: 15-20 minutes
**Requires**: Maintenance window (brief application restart)

**Pre-rotation checklist**:
- [ ] Notify team of planned rotation
- [ ] Verify Secrets Manager rotation is configured
- [ ] Confirm backup is recent (< 24 hours)
- [ ] Check application health

**Rotation steps**:

1. Trigger rotation:
```bash
aws secretsmanager rotate-secret \
  --secret-id your-app-db-credentials-production \
  --rotation-lambda-arn arn:aws:lambda:us-east-1:ACCOUNT:function:SecretsManagerRotation
```

2. Monitor rotation:
```bash
aws secretsmanager describe-secret \
  --secret-id your-app-db-credentials-production \
  --query 'RotationEnabled'
```

3. Verify new credentials:
```bash
# Get new password
NEW_PASSWORD=$(aws secretsmanager get-secret-value \
  --secret-id your-app-db-credentials-production \
  --query SecretString --output text | jq -r '.password')

# Test connection
psql "postgresql://dbadmin:$NEW_PASSWORD@<endpoint>:5432/transparenttrust?sslmode=require" -c "SELECT 1;"
```

4. Restart application to pick up new credentials:
```bash
# ECS Fargate
aws ecs update-service \
  --cluster your-app-cluster-production \
  --service your-app-service \
  --force-new-deployment
```

5. Verify application health:
```bash
# Check application logs
aws logs tail /aws/ecs/transparent-trust --follow

# Check database connections
psql -c "SELECT usename, count(*) FROM pg_stat_activity GROUP BY usename;"
```

6. Document rotation in change log

## Security Incident Response

### Phase 1: Detection & Triage (0-15 minutes)

1. **Alert received** via CloudWatch Alarm, log analysis, or user report

2. **Initial assessment**:
   - Severity: Critical / High / Medium / Low
   - Impact: Data breach / Service disruption / Attempted breach
   - Scope: Single user / Multiple users / All systems

3. **Notify team**:
   ```bash
   # Page on-call if Critical/High
   # Notify security team via Slack/email
   ```

4. **Preserve evidence**:
   ```bash
   # Create immediate snapshot
   aws rds create-db-snapshot \
     --db-instance-identifier your-app-db-production \
     --db-snapshot-identifier incident-$(date +%Y%m%d-%H%M%S)

   # Export recent logs
   aws logs filter-log-events \
     --log-group-name /aws/rds/instance/your-app-db-production/postgresql \
     --start-time $(($(date +%s) - 86400))000 \
     > incident-logs-$(date +%Y%m%d-%H%M%S).json
   ```

### Phase 2: Containment (15-30 minutes)

1. **Isolate if breach suspected**:
   ```bash
   # Option 1: Modify security group (removes all access temporarily)
   aws ec2 revoke-security-group-ingress \
     --group-id <rds-sg-id> \
     --source-group <app-sg-id> \
     --protocol tcp --port 5432

   # Option 2: Terminate suspicious connections only
   psql -c "SELECT pg_terminate_backend(pid)
            FROM pg_stat_activity
            WHERE usename = '<suspicious-user>';"
   ```

2. **Rotate credentials**:
   ```bash
   aws secretsmanager rotate-secret \
     --secret-id your-app-db-credentials-production
   ```

3. **Block malicious IPs** (if applicable):
   ```bash
   # Update NACLs to block specific IPs
   aws ec2 create-network-acl-entry \
     --network-acl-id <nacl-id> \
     --ingress --rule-number 50 \
     --protocol tcp --port-range From=5432,To=5432 \
     --cidr-block <malicious-ip>/32 \
     --rule-action deny
   ```

### Phase 3: Investigation (30-120 minutes)

1. **Analyze logs** for:
   - Timeline of events
   - Affected users/data
   - Attack vectors
   - Indicators of compromise

2. **Review CloudTrail**:
   ```bash
   aws cloudtrail lookup-events \
     --lookup-attributes AttributeKey=ResourceType,AttributeValue=AWS::RDS::DBInstance \
     --start-time $(date -u -d '7 days ago' --iso-8601=seconds)
   ```

3. **Query database** for data access:
   ```sql
   -- Check for unusual data exports
   SELECT usename, query, query_start
   FROM pg_stat_activity
   WHERE query LIKE '%COPY%' OR query LIKE '%pg_dump%';
   ```

4. **Document findings** in incident report

### Phase 4: Recovery (varies)

1. **Restore service** once threat is contained
2. **Verify data integrity**
3. **Implement additional controls**
4. **Monitor closely** for 48-72 hours

### Phase 5: Post-Incident (24-48 hours after)

1. **Root cause analysis**
2. **Lessons learned session**
3. **Update security procedures**
4. **Implement preventive measures**
5. **Complete incident report**
6. **Notify stakeholders** (if required)

## Compliance Reporting

### Monthly Compliance Report

**Generate report** covering:

1. **Security Configuration Status**
   - Encryption: Enabled ✓
   - Multi-AZ: Enabled ✓
   - Backups: Configured (7 days) ✓
   - SSL/TLS: Enforced ✓
   - Public Access: Disabled ✓

2. **Access Control**
   - Number of database users
   - Last access review date
   - Permission changes this month

3. **Monitoring & Logging**
   - Log retention: 30 days ✓
   - Alarms configured: 7 ✓
   - Alarms triggered: X (list)

4. **Incidents & Anomalies**
   - Security incidents: X
   - Failed authentication attempts: X
   - Unauthorized access attempts: X

5. **Maintenance Activities**
   - Credential rotations: X
   - Security patches applied: X
   - Configuration changes: X

6. **Compliance Status**
   - SOC 2 controls: Compliant ✓
   - Audit findings: None
   - Remediation items: None

### Audit Evidence Collection

For external audits, collect:

```bash
# 1. Configuration export
aws rds describe-db-instances \
  --db-instance-identifier your-app-db-production \
  > audit-rds-config.json

# 2. Security group export
aws ec2 describe-security-groups \
  --group-ids <rds-sg-id> \
  > audit-security-groups.json

# 3. KMS configuration
aws kms describe-key --key-id <kms-key-id> \
  > audit-kms-config.json

# 4. CloudTrail events (90 days)
aws cloudtrail lookup-events \
  --lookup-attributes AttributeKey=ResourceType,AttributeValue=AWS::RDS::DBInstance \
  --start-time $(date -u -d '90 days ago' --iso-8601=seconds) \
  --max-results 1000 \
  > audit-cloudtrail-90days.json

# 5. Sample of logs
aws logs filter-log-events \
  --log-group-name /aws/rds/instance/your-app-db-production/postgresql \
  --start-time $(($(date +%s) - 2592000))000 \
  --max-items 1000 \
  > audit-sample-logs.json
```

---

**Document Version**: 1.0
**Last Updated**: 2025-12-18
**Review Schedule**: Quarterly
**Owner**: Security Team
