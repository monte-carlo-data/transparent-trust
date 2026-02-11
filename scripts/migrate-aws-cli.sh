#!/bin/bash
# AWS CLI migration script - triggers ECS migration task from local machine
#
# This script runs the migration as an ECS Fargate task, useful for:
# - Running migrations from CI/CD pipelines
# - Manual migration execution without ECS console
# - Automated deployment workflows
#
# Usage:
#   ./scripts/migrate-aws-cli.sh [environment]
#
# Arguments:
#   environment - Environment name (default: development)
#
# Examples:
#   ./scripts/migrate-aws-cli.sh development
#   ./scripts/migrate-aws-cli.sh production
#
# Prerequisites:
#   - AWS CLI configured with appropriate credentials
#   - ECS cluster and task definition exist
#   - Appropriate IAM permissions

set -e

ENVIRONMENT=${1:-development}
AWS_REGION=${AWS_REGION:-us-east-1}

# Environment-specific configuration
case "$ENVIRONMENT" in
  development|dev)
    ECS_CLUSTER="transparent-trust-cluster-development"
    TASK_DEFINITION="transparent-trust-migration-development"
    SUBNETS="subnet-xxx,subnet-yyy"  # TODO: Replace with actual subnet IDs
    SECURITY_GROUPS="sg-xxx"          # TODO: Replace with actual security group ID
    ;;
  production|prod)
    ECS_CLUSTER="transparent-trust-cluster-production"
    TASK_DEFINITION="transparent-trust-migration-production"
    SUBNETS="subnet-xxx,subnet-yyy"  # TODO: Replace with actual subnet IDs
    SECURITY_GROUPS="sg-xxx"          # TODO: Replace with actual security group ID
    ;;
  *)
    echo "❌ ERROR: Unknown environment: $ENVIRONMENT"
    echo "Valid environments: development, production"
    exit 1
    ;;
esac

echo "=== Running Database Migration via ECS ==="
echo ""
echo "Environment: $ENVIRONMENT"
echo "Region: $AWS_REGION"
echo "Cluster: $ECS_CLUSTER"
echo "Task Definition: $TASK_DEFINITION"
echo ""

# Verify AWS credentials
echo "Verifying AWS credentials..."
if ! aws sts get-caller-identity &>/dev/null; then
  echo "❌ ERROR: AWS credentials not configured or invalid"
  exit 1
fi
echo "✅ AWS credentials valid"
echo ""

# Run the ECS task
echo "Starting migration task..."
TASK_ARN=$(aws ecs run-task \
  --region "$AWS_REGION" \
  --cluster "$ECS_CLUSTER" \
  --task-definition "$TASK_DEFINITION" \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[$SUBNETS],securityGroups=[$SECURITY_GROUPS],assignPublicIp=DISABLED}" \
  --query 'tasks[0].taskArn' \
  --output text)

if [ -z "$TASK_ARN" ]; then
  echo "❌ ERROR: Failed to start migration task"
  exit 1
fi

echo "✅ Task started: $TASK_ARN"
echo ""

# Wait for task to complete
echo "Waiting for task to complete..."
aws ecs wait tasks-stopped \
  --region "$AWS_REGION" \
  --cluster "$ECS_CLUSTER" \
  --tasks "$TASK_ARN"

# Check task exit code
EXIT_CODE=$(aws ecs describe-tasks \
  --region "$AWS_REGION" \
  --cluster "$ECS_CLUSTER" \
  --tasks "$TASK_ARN" \
  --query 'tasks[0].containers[0].exitCode' \
  --output text)

echo ""
if [ "$EXIT_CODE" = "0" ]; then
  echo "✅ Migration completed successfully!"
  echo ""
  echo "View logs:"
  echo "  aws logs tail /aws/ecs/transparent-trust-$ENVIRONMENT --follow"
  exit 0
else
  echo "❌ Migration failed with exit code: $EXIT_CODE"
  echo ""
  echo "View logs for details:"
  echo "  aws logs tail /aws/ecs/transparent-trust-$ENVIRONMENT --follow"
  exit 1
fi
