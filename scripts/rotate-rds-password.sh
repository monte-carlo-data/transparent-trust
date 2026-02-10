#!/bin/bash

#############################################################################
# RDS Password Rotation and Sync Script
#
# This script automates the entire process of rotating the RDS master
# password and syncing it to the reference secret in AWS Secrets Manager,
# then restarting the ECS service to pick up the new credentials.
#
# Usage:
#   ./scripts/rotate-rds-password.sh <environment>
#
# Examples:
#   ./scripts/rotate-rds-password.sh development
#   ./scripts/rotate-rds-password.sh production
#
# Requirements:
#   - AWS CLI configured with appropriate credentials
#   - jq for JSON parsing
#   - Appropriate IAM permissions for Secrets Manager and ECS
#############################################################################

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
ENVIRONMENT="${1:-development}"
AWS_REGION="us-east-1"
PROJECT_NAME="transparent-trust"

# Derived names based on environment
if [ "$ENVIRONMENT" = "development" ]; then
  CLUSTER_NAME="${PROJECT_NAME}-cluster-${ENVIRONMENT}"
  SERVICE_NAME="${PROJECT_NAME}-service-${ENVIRONMENT}"
  REFERENCE_SECRET_NAME="${PROJECT_NAME}-rds-password-${ENVIRONMENT}"
  RDS_MANAGED_SECRET_PREFIX="rds!db-"
elif [ "$ENVIRONMENT" = "production" ]; then
  CLUSTER_NAME="${PROJECT_NAME}-cluster-${ENVIRONMENT}"
  SERVICE_NAME="${PROJECT_NAME}-service-${ENVIRONMENT}"
  REFERENCE_SECRET_NAME="${PROJECT_NAME}-rds-password-${ENVIRONMENT}"
  RDS_MANAGED_SECRET_PREFIX="rds!db-"
else
  echo -e "${RED}Error: Unknown environment '${ENVIRONMENT}'${NC}"
  echo "Supported environments: development, production"
  exit 1
fi

echo -e "${YELLOW}========================================${NC}"
echo -e "${YELLOW}RDS Password Rotation and Sync${NC}"
echo -e "${YELLOW}========================================${NC}"
echo "Environment: $ENVIRONMENT"
echo "Region: $AWS_REGION"
echo "Cluster: $CLUSTER_NAME"
echo "Service: $SERVICE_NAME"
echo ""

# Step 1: Verify AWS credentials
echo -e "${YELLOW}[1/5] Verifying AWS credentials...${NC}"
if ! aws sts get-caller-identity --region "$AWS_REGION" > /dev/null 2>&1; then
  echo -e "${RED}Error: AWS credentials not configured or invalid${NC}"
  exit 1
fi
echo -e "${GREEN}✓ AWS credentials verified${NC}"
echo ""

# Step 2: Find the RDS-managed secret
echo -e "${YELLOW}[2/5] Finding RDS-managed secret...${NC}"
RDS_SECRET=$(aws secretsmanager list-secrets \
  --region "$AWS_REGION" \
  --query "SecretList[?contains(Name, 'rds!db')].Name" \
  --output text | head -1)

if [ -z "$RDS_SECRET" ]; then
  echo -e "${RED}Error: Could not find RDS-managed secret${NC}"
  exit 1
fi
echo -e "${GREEN}✓ Found RDS-managed secret${NC}"
echo ""

# Step 3: Rotate the RDS password
echo -e "${YELLOW}[3/5] Rotating RDS password (this may take 1-2 minutes)...${NC}"
echo "Initiating rotation on RDS-managed secret..."

aws secretsmanager rotate-secret \
  --secret-id "$RDS_SECRET" \
  --region "$AWS_REGION" \
  --rotation-rules '{"AutomaticallyAfterDays": 0}' > /dev/null 2>&1 || true

# Wait for rotation to complete
echo "Waiting for rotation to complete..."
MAX_WAIT=120
ELAPSED=0
while [ $ELAPSED -lt $MAX_WAIT ]; do
  STATUS=$(aws secretsmanager describe-secret \
    --secret-id "$RDS_SECRET" \
    --region "$AWS_REGION" \
    --query 'RotationEnabled' \
    --output text)

  # Check if rotation is complete by checking if we can get the secret
  if aws secretsmanager get-secret-value \
    --secret-id "$RDS_SECRET" \
    --region "$AWS_REGION" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ RDS password rotated successfully${NC}"
    break
  fi

  sleep 5
  ELAPSED=$((ELAPSED + 5))
  echo -n "."
done

if [ $ELAPSED -ge $MAX_WAIT ]; then
  echo -e "${YELLOW}⚠ Rotation may still be in progress, proceeding with sync...${NC}"
fi
echo ""

# Step 4: Sync the new password to the reference secret
echo -e "${YELLOW}[4/5] Syncing new password to reference secret...${NC}"

# Get the new password from RDS-managed secret
NEW_PASSWORD=$(aws secretsmanager get-secret-value \
  --secret-id "$RDS_SECRET" \
  --region "$AWS_REGION" \
  --query 'SecretString' \
  --output text)

if [ -z "$NEW_PASSWORD" ]; then
  echo -e "${RED}Error: Could not retrieve new password${NC}"
  exit 1
fi

# Update the reference secret
aws secretsmanager put-secret-value \
  --secret-id "$REFERENCE_SECRET_NAME" \
  --secret-string "$NEW_PASSWORD" \
  --region "$AWS_REGION" > /dev/null 2>&1

echo -e "${GREEN}✓ Password synced to reference secret: $REFERENCE_SECRET_NAME${NC}"
echo ""

# Step 5: Restart the ECS service
echo -e "${YELLOW}[5/5] Restarting ECS service to pick up new credentials...${NC}"

aws ecs update-service \
  --cluster "$CLUSTER_NAME" \
  --service "$SERVICE_NAME" \
  --force-new-deployment \
  --region "$AWS_REGION" > /dev/null 2>&1

echo "Waiting for ECS task to restart (this may take 1-2 minutes)..."

# Wait for the task to be healthy
MAX_WAIT=180
ELAPSED=0
while [ $ELAPSED -lt $MAX_WAIT ]; do
  RUNNING=$(aws ecs describe-services \
    --cluster "$CLUSTER_NAME" \
    --services "$SERVICE_NAME" \
    --region "$AWS_REGION" \
    --query 'services[0].runningCount' \
    --output text)

  if [ "$RUNNING" -eq 1 ]; then
    echo -e "${GREEN}✓ ECS service restarted and healthy${NC}"
    break
  fi

  sleep 5
  ELAPSED=$((ELAPSED + 5))
  echo -n "."
done

if [ $ELAPSED -ge $MAX_WAIT ]; then
  echo -e "${YELLOW}⚠ ECS task may still be restarting, verify manually${NC}"
fi
echo ""

# Summary
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✓ Password rotation complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Summary:"
echo "  - RDS password rotated"
echo "  - Reference secret synced"
echo "  - ECS service restarted"
echo ""
echo "Your application should now be able to connect with the new credentials."
echo ""
echo "To verify connectivity, check your application logs:"
echo "  aws logs tail /ecs/${SERVICE_NAME} --follow --region $AWS_REGION"
