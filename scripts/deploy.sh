#!/bin/bash
set -e

# Deployment script for Transparent RFP Copilot
# Usage: ./scripts/deploy.sh [dev|prod]

ENVIRONMENT=${1:-dev}
AWS_REGION="us-east-1"
AWS_ACCOUNT_ID="${AWS_ACCOUNT_ID:?Set AWS_ACCOUNT_ID environment variable}"
ECR_REPOSITORY="transparent-trust-${ENVIRONMENT}"
IMAGE_TAG="${2:-latest}"

echo "=========================================="
echo "Deploying Transparent RFP Copilot"
echo "Environment: ${ENVIRONMENT}"
echo "Region: ${AWS_REGION}"
echo "=========================================="

# Check prerequisites
command -v aws >/dev/null 2>&1 || { echo "AWS CLI is required but not installed. Aborting." >&2; exit 1; }
command -v docker >/dev/null 2>&1 || { echo "Docker is required but not installed. Aborting." >&2; exit 1; }

# Verify AWS credentials
echo "Verifying AWS credentials..."
aws sts get-caller-identity > /dev/null || { echo "AWS credentials not configured. Aborting." >&2; exit 1; }

# Build Docker image
echo ""
echo "Building Docker image..."
docker build -t ${ECR_REPOSITORY}:${IMAGE_TAG} .

# Authenticate Docker to ECR
echo ""
echo "Authenticating to ECR..."
aws ecr get-login-password --region ${AWS_REGION} | docker login --username AWS --password-stdin ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com

# Check if ECR repository exists, create if not
echo ""
echo "Checking ECR repository..."
if ! aws ecr describe-repositories --repository-names ${ECR_REPOSITORY} --region ${AWS_REGION} > /dev/null 2>&1; then
    echo "Creating ECR repository ${ECR_REPOSITORY}..."
    aws ecr create-repository \
        --repository-name ${ECR_REPOSITORY} \
        --region ${AWS_REGION} \
        --image-scanning-configuration scanOnPush=true \
        --encryption-configuration encryptionType=AES256
fi

# Tag and push image
echo ""
echo "Tagging and pushing image to ECR..."
docker tag ${ECR_REPOSITORY}:${IMAGE_TAG} ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPOSITORY}:${IMAGE_TAG}
docker push ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPOSITORY}:${IMAGE_TAG}

echo ""
echo "✓ Docker image pushed successfully!"
echo "Image URI: ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPOSITORY}:${IMAGE_TAG}"

# Deploy with Terraform
echo ""
echo "Deploying infrastructure with Terraform..."
cd infrastructure/env/${ENVIRONMENT}-us-security

if [ ! -d ".terraform" ]; then
    echo "Initializing Terraform..."
    terraform init
fi

echo ""
echo "Running terraform plan..."
terraform plan -out=tfplan

echo ""
read -p "Apply this plan? (yes/no): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Applying Terraform changes..."
    terraform apply tfplan
    rm tfplan

    echo ""
    echo "=========================================="
    echo "Deployment completed successfully!"
    echo "=========================================="
    echo ""
    if [ "${ENVIRONMENT}" == "dev" ]; then
        echo "Application URL: https://transparent-trust.dev.example.com"
    else
        echo "Application URL: https://transparent-trust.prod.example.com"
    fi
    echo ""
    echo "Next steps:"
    echo "1. Connect to Tailscale VPN"
    echo "2. Access the application URL above"
    echo "3. Run database migrations if needed:"
    echo "   ./scripts/run-migrations.sh ${ENVIRONMENT}"
else
    echo "Deployment cancelled."
    rm tfplan
    exit 1
fi
