# Example Environment Configuration
#
# INSTRUCTIONS:
# 1. Copy this directory: cp -r infrastructure/env/example/ infrastructure/env/my-env/
# 2. Update the values below for your environment
# 3. Configure the S3 backend in main.tf
# 4. Create secrets in AWS Secrets Manager (see docs/INTEGRATION_CREDENTIALS_SETUP.md)
# 5. Run: cd infrastructure/env/my-env && terraform init && terraform plan

# =========================================
# General
# =========================================
project_name = "transparent-trust"
environment  = "development" # Change to "staging", "production", etc.
aws_region   = "us-east-1"

# =========================================
# VPC
# =========================================
vpc_cidr           = "10.0.0.0/16"                # Choose a CIDR that doesn't conflict with your network
availability_zones = ["us-east-1a", "us-east-1b"] # Add a third AZ for production HA

# =========================================
# RDS
# =========================================
rds_instance_class  = "db.t3.small" # db.t3.micro for dev, db.t3.small+ for production
rds_database_name   = "transparenttrust"
rds_master_username = "dbadmin"

# =========================================
# Redis
# =========================================
enable_elasticache_redis = false # Enable for background job processing
redis_node_type          = "cache.t3.micro"

# =========================================
# ALB & HTTPS
# =========================================
alb_certificate_arn = "" # Leave empty - certificate is created in main.tf
alb_enable_https    = true

# =========================================
# DNS
# =========================================
enable_dns_cdn = false
domain_name    = "transparent-trust.dev.example.com" # Replace with your domain

# =========================================
# Deployment
# =========================================
deployment_type   = "ecs"
ecs_desired_count = 1

# =========================================
# Application URL
# =========================================
nextauth_url = "https://transparent-trust.dev.example.com" # Must match domain_name

# =========================================
# Monitoring
# =========================================
enable_monitoring      = false # Enable for production
monitoring_alert_email = ""    # Set to your team's alert email

# =========================================
# Integration Credentials
# =========================================
# Secrets are created by Terraform with PLACEHOLDER values.
# Update actual credentials directly in AWS Secrets Manager Console.
# See docs/INTEGRATION_CREDENTIALS_SETUP.md for setup instructions.
