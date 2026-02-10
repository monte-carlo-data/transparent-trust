#!/bin/bash
set -e

# Run Prisma migrations on ECS container
# Usage: ./scripts/run-migrations.sh [dev|prod]

ENVIRONMENT=${1:-dev}
AWS_REGION="us-east-1"

echo "=========================================="
echo "Running database migrations"
echo "Environment: ${ENVIRONMENT}"
echo "=========================================="

# Get ECS cluster name and task
cd infrastructure/env/${ENVIRONMENT}-us-security

CLUSTER_NAME=$(terraform output -raw ecs_cluster_name 2>/dev/null || echo "transparent-trust-${ENVIRONMENT}")

echo ""
echo "Getting ECS task ID from cluster ${CLUSTER_NAME}..."
TASK_ARN=$(aws ecs list-tasks --cluster ${CLUSTER_NAME} --region ${AWS_REGION} --desired-status RUNNING --query 'taskArns[0]' --output text)

if [ "$TASK_ARN" == "None" ] || [ -z "$TASK_ARN" ]; then
    echo "Error: No running tasks found in cluster ${CLUSTER_NAME}"
    echo "Make sure the ECS service is running."
    exit 1
fi

TASK_ID=$(echo $TASK_ARN | cut -d/ -f3)

echo "Found task: ${TASK_ID}"
echo ""
echo "Connecting to container and running migrations..."
echo ""

# Run migrations
aws ecs execute-command \
    --cluster ${CLUSTER_NAME} \
    --task ${TASK_ID} \
    --container app \
    --region ${AWS_REGION} \
    --interactive \
    --command "npx prisma migrate deploy"

echo ""
echo "✓ Migrations completed successfully!"
