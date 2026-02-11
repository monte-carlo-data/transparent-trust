#!/bin/bash
# RDS Query Script via SSM Port Forwarding
# Usage: ./scripts/rds-query.sh "SELECT * FROM \"Customer\" LIMIT 10;"
#
# Prerequisites:
#   - AWS CLI configured with appropriate credentials
#   - Session Manager Plugin: brew install --cask session-manager-plugin
#   - PostgreSQL client: brew install postgresql (or run .local/brew-dependencies.sh)
#   - jq: brew install jq
#
# Required IAM permissions:
#   - ec2:DescribeInstances, ec2:StartInstances, ec2:StopInstances
#   - ssm:StartSession
#   - rds:DescribeDBInstances
#   - secretsmanager:GetSecretValue (on RDS-managed secret)

set -e

# Check prerequisites
check_prereqs() {
    local missing=()

    command -v aws >/dev/null 2>&1 || missing+=("aws CLI")
    command -v session-manager-plugin >/dev/null 2>&1 || missing+=("session-manager-plugin")
    command -v psql >/dev/null 2>&1 || missing+=("psql (PostgreSQL client)")
    command -v jq >/dev/null 2>&1 || missing+=("jq")

    if [ ${#missing[@]} -gt 0 ]; then
        echo -e "${RED}Missing prerequisites:${NC}"
        for prereq in "${missing[@]}"; do
            echo "  - $prereq"
        done
        echo ""
        echo "Run: ./.local/brew-dependencies.sh"
        exit 1
    fi
}

# Configuration
INSTANCE_ID="i-0bedcec8aa238b93b"
RDS_HOST="transparent-trust-db-development.c1km0uwm4q07.us-east-1.rds.amazonaws.com"
RDS_PORT="5432"
LOCAL_PORT="15432"
DB_NAME="${DB_NAME:-transparenttrust}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get query from argument or use default
QUERY="${1:-SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';}"

# Check prerequisites before proceeding
check_prereqs

echo -e "${YELLOW}=== RDS Query via SSM ===${NC}"

# Check if instance is running
INSTANCE_STATE=$(aws ec2 describe-instances --instance-ids "$INSTANCE_ID" --query 'Reservations[0].Instances[0].State.Name' --output text)

if [ "$INSTANCE_STATE" != "running" ]; then
    echo -e "${YELLOW}Instance is $INSTANCE_STATE. Starting it...${NC}"
    aws ec2 start-instances --instance-ids "$INSTANCE_ID" > /dev/null

    echo "Waiting for instance to be running..."
    aws ec2 wait instance-running --instance-ids "$INSTANCE_ID"

    echo "Waiting for SSM agent to be ready (30s)..."
    sleep 30

    STARTED_INSTANCE=true
else
    echo -e "${GREEN}Instance is already running${NC}"
    STARTED_INSTANCE=false
fi

# Get database credentials from environment or Secrets Manager
if [ -z "$PGPASSWORD" ]; then
    CREDS_LOADED=false

    # Try 1: RDS-managed secret (authoritative source, but may not have IAM access)
    echo -e "${YELLOW}Trying RDS-managed secret...${NC}"
    RDS_INSTANCE_ID="transparent-trust-db-development"
    RDS_SECRET_ARN=$(aws rds describe-db-instances \
        --db-instance-identifier "$RDS_INSTANCE_ID" \
        --query 'DBInstances[0].MasterUserSecret.SecretArn' \
        --output text 2>/dev/null || echo "")

    if [ -n "$RDS_SECRET_ARN" ] && [ "$RDS_SECRET_ARN" != "None" ]; then
        RDS_CREDS=$(aws secretsmanager get-secret-value --secret-id "$RDS_SECRET_ARN" --query 'SecretString' --output text 2>/dev/null || echo "")

        if [ -n "$RDS_CREDS" ] && echo "$RDS_CREDS" | jq -e . >/dev/null 2>&1; then
            export PGUSER=$(echo "$RDS_CREDS" | jq -r '.username')
            export PGPASSWORD=$(echo "$RDS_CREDS" | jq -r '.password')
            SECRET_DB=$(echo "$RDS_CREDS" | jq -r '.dbname // empty')
            [ -n "$SECRET_DB" ] && DB_NAME="$SECRET_DB"
            echo -e "${GREEN}Credentials loaded from RDS-managed secret${NC}"
            CREDS_LOADED=true
        else
            echo -e "${YELLOW}RDS-managed secret not accessible (AccessDenied or parse error)${NC}"
        fi
    fi

    # Try 2: Tailscale DATABASE_URL secret (may be synced)
    if [ "$CREDS_LOADED" = false ]; then
        echo -e "${YELLOW}Trying Tailscale DATABASE_URL secret...${NC}"
        DB_URL_SECRET="development/transparent-trust-database-url"
        DB_URL=$(aws secretsmanager get-secret-value --secret-id "$DB_URL_SECRET" --query 'SecretString' --output text 2>/dev/null || echo "")

        if [ -n "$DB_URL" ]; then
            export PGUSER=$(echo "$DB_URL" | sed -n 's|.*://\([^:]*\):.*|\1|p')
            export PGPASSWORD=$(echo "$DB_URL" | sed -n 's|.*://[^:]*:\([^@]*\)@.*|\1|p')
            URL_DB=$(echo "$DB_URL" | sed -n 's|.*/\([^?]*\).*|\1|p')
            [ -n "$URL_DB" ] && DB_NAME="$URL_DB"
            echo -e "${GREEN}Credentials loaded from $DB_URL_SECRET${NC}"
            echo -e "${YELLOW}Note: This secret may be stale. If auth fails, sync from RDS-managed secret.${NC}"
            CREDS_LOADED=true
        fi
    fi

    if [ "$CREDS_LOADED" = false ]; then
        echo -e "${RED}Could not fetch credentials from any secret.${NC}"
        echo -e "${RED}Set PGUSER and PGPASSWORD environment variables manually.${NC}"
        exit 1
    fi
fi

echo -e "${GREEN}Using database: $DB_NAME, user: $PGUSER${NC}"

# Kill any existing session on the port
EXISTING_PID=$(lsof -ti :$LOCAL_PORT 2>/dev/null || true)
if [ -n "$EXISTING_PID" ]; then
    echo -e "${YELLOW}Killing existing process on port $LOCAL_PORT...${NC}"
    kill $EXISTING_PID 2>/dev/null || true
    sleep 2
fi

echo -e "${GREEN}Starting SSM port forwarding on localhost:$LOCAL_PORT...${NC}"

# Start port forwarding in background
aws ssm start-session \
    --target "$INSTANCE_ID" \
    --document-name AWS-StartPortForwardingSessionToRemoteHost \
    --parameters "{\"host\":[\"$RDS_HOST\"],\"portNumber\":[\"$RDS_PORT\"],\"localPortNumber\":[\"$LOCAL_PORT\"]}" &

SSM_PID=$!

# Wait for tunnel to establish and port to be ready
echo -e "${YELLOW}Waiting for tunnel to establish...${NC}"
for i in {1..10}; do
    if lsof -ti :$LOCAL_PORT >/dev/null 2>&1; then
        echo -e "${GREEN}Tunnel ready${NC}"
        break
    fi
    sleep 1
done

# Check if tunnel is up
if ! kill -0 $SSM_PID 2>/dev/null; then
    echo -e "${RED}Failed to establish SSM tunnel${NC}"
    exit 1
fi

echo -e "${GREEN}Running query...${NC}"
echo -e "${YELLOW}Query: $QUERY${NC}"
echo ""

# Run the query (sslmode=require for RDS)
PGSSLMODE=require psql -h localhost -p "$LOCAL_PORT" -d "$DB_NAME" -c "$QUERY"

# Cleanup
echo ""
echo -e "${YELLOW}Cleaning up...${NC}"
kill $SSM_PID 2>/dev/null || true

# Optionally stop the instance if we started it
if [ "$STARTED_INSTANCE" = true ]; then
    read -p "Stop the bastion instance? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "Stopping instance..."
        aws ec2 stop-instances --instance-ids "$INSTANCE_ID" > /dev/null
    fi
fi

echo -e "${GREEN}Done!${NC}"
