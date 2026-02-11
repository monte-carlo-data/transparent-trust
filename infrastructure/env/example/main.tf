# Example Environment
# Terraform configuration for deploying transparent-trust infrastructure
#
# GETTING STARTED:
# 1. Copy this directory to create your environment (e.g., cp -r example/ my-env/)
# 2. Configure the S3 backend below with your state bucket
# 3. Update terraform.tfvars with your environment-specific values
# 4. Run: terraform init && terraform plan

terraform {
  required_version = ">= 1.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Configure your Terraform state backend
  # backend "s3" {
  #   bucket  = "your-terraform-state-bucket"
  #   key     = "transparent-trust/your-env/terraform.tfstate"
  #   region  = "us-east-1"
  #   encrypt = true
  # }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = var.project_name
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}

# =========================================
# VPC Module
# =========================================

module "vpc" {
  source = "../../modules/vpc"

  project_name       = var.project_name
  environment        = var.environment
  aws_region         = var.aws_region
  vpc_cidr           = var.vpc_cidr
  availability_zones = var.availability_zones

  enable_nat_gateway   = var.enable_nat_gateway
  enable_flow_logs     = var.enable_flow_logs
  enable_dns_hostnames = true
  enable_dns_support   = true

  flow_logs_retention_days = 30
}

# =========================================
# Security Groups Module
# =========================================

module "security_groups" {
  source = "../../modules/security-groups"

  project_name = var.project_name
  environment  = var.environment
  vpc_id       = module.vpc.vpc_id
  vpc_cidr     = var.vpc_cidr

  public_subnet_ids  = module.vpc.public_subnet_ids
  private_subnet_ids = module.vpc.private_subnet_ids

  enable_redis = var.enable_elasticache_redis

  # If using Tailscale app connector, set CIDR of the VPC running the connector
  app_connector_vpc_cidr = var.app_connector_vpc_cidr
}

# =========================================
# S3 Module
# =========================================

module "s3" {
  source = "../../modules/s3"

  project_name = var.project_name
  environment  = var.environment

  enable_versioning         = var.s3_enable_versioning
  enable_lifecycle_policies = var.s3_enable_lifecycle

  transition_to_ia_days = 90
  expire_after_days     = 365

  enable_cloudwatch_alarms = false
  alarm_sns_topic_arn      = ""

  depends_on = [module.vpc]
}

# =========================================
# S3 Policies Module
# =========================================

module "s3_policies" {
  source = "../../modules/s3-policies"

  project_name           = var.project_name
  environment            = var.environment
  app_uploads_bucket_id  = module.s3.app_uploads_bucket_id
  app_uploads_bucket_arn = module.s3.app_uploads_bucket_arn

  depends_on = [module.s3]
}

# =========================================
# IAM Module
# =========================================

module "iam" {
  source = "../../modules/iam"

  project_name = var.project_name
  environment  = var.environment
  aws_region   = var.aws_region

  enable_xray = var.enable_xray_tracing

  depends_on = [module.s3]
}

# =========================================
# Secrets Manager Module
# =========================================

module "secrets_manager" {
  source = "../../modules/secrets-manager"

  project_name = var.project_name
  environment  = var.environment

  # Toggle which secrets to reference (must be created manually in AWS first)
  reference_nextauth_secret      = true
  reference_anthropic_secret     = true
  reference_google_oauth_secret  = false # Enable if using Google OAuth
  reference_okta_oauth_secret    = false # Enable if using Okta SSO
  reference_upstash_redis_secret = false # Enable if using Upstash Redis

  reference_encryption_key = true

  enable_cloudwatch_alarms = false
  alarm_sns_topic_arn      = ""
}

# =========================================
# RDS Module
# =========================================

module "rds" {
  source = "../../modules/rds"

  project_name = var.project_name
  environment  = var.environment

  vpc_id                = module.vpc.vpc_id
  private_subnet_ids    = module.vpc.private_subnet_ids
  rds_security_group_id = module.security_groups.rds_security_group_id

  instance_class    = var.rds_instance_class
  allocated_storage = var.rds_allocated_storage
  postgres_version  = var.rds_engine_version

  database_name   = var.rds_database_name
  master_username = var.rds_master_username

  multi_az                     = var.rds_multi_az
  backup_retention_period      = var.rds_backup_retention_period
  monitoring_interval          = var.rds_enable_enhanced_monitoring ? 60 : 0
  rds_monitoring_role_arn      = module.iam.rds_enhanced_monitoring_role_arn
  performance_insights_enabled = var.rds_enable_performance_insights

  enable_cloudwatch_alarms = false
  alarm_sns_topic_arns     = []

  depends_on = [module.vpc, module.security_groups, module.iam]
}

# Database URL secret
resource "aws_secretsmanager_secret" "database_url" {
  name        = "${var.environment}/transparent-trust-database-url"
  description = "Database URL for transparent-trust (${var.environment})"

  recovery_window_in_days = var.environment == "development" ? 0 : 7

  tags = {
    Name        = "transparent-trust-database-url"
    Environment = var.environment
    Purpose     = "PostgreSQL connection"
  }
}

resource "aws_secretsmanager_secret_version" "database_url" {
  secret_id = aws_secretsmanager_secret.database_url.id
  secret_string = jsonencode({
    url = var.database_url != "" ? var.database_url : "postgresql://placeholder:placeholder@localhost:5432/placeholder"
  })

  lifecycle {
    ignore_changes = [secret_string]
  }
}

# =========================================
# ACM Certificate
# =========================================
# Certificate must be in the same account as the ALB.
# If using a root account for DNS, validation records must be added there.

resource "aws_acm_certificate" "app" {
  domain_name               = var.domain_name
  subject_alternative_names = var.certificate_san
  validation_method         = "DNS"

  lifecycle {
    create_before_destroy = true
  }

  tags = {
    Name        = "${var.project_name}-cert-${var.environment}"
    Environment = var.environment
    Project     = var.project_name
    ManagedBy   = "terraform"
  }
}

output "certificate_validation_records" {
  description = "DNS validation records - add these to your DNS zone"
  value = {
    for dvo in aws_acm_certificate.app.domain_validation_options : dvo.domain_name => {
      name  = dvo.resource_record_name
      type  = dvo.resource_record_type
      value = dvo.resource_record_value
    }
  }
}

# =========================================
# Redis Module (ElastiCache)
# =========================================

module "redis" {
  count  = var.enable_elasticache_redis ? 1 : 0
  source = "../../modules/redis"

  project_name = var.project_name
  environment  = var.environment

  create_elasticache     = true
  vpc_id                 = module.vpc.vpc_id
  private_subnet_ids     = module.vpc.private_subnet_ids
  app_security_group_ids = [module.security_groups.app_security_group_id]

  redis_node_type       = var.redis_node_type
  redis_num_cache_nodes = var.redis_num_cache_nodes
  redis_family          = var.redis_parameter_group_family

  enable_alarms       = false
  alarm_sns_topic_arn = ""

  depends_on = [module.vpc, module.security_groups, module.secrets_manager]
}

# =========================================
# ALB Module
# =========================================

module "alb" {
  source = "../../modules/alb"

  project_name = var.project_name
  environment  = var.environment

  vpc_id                = module.vpc.vpc_id
  private_subnet_ids    = module.vpc.private_subnet_ids
  alb_security_group_id = module.security_groups.alb_security_group_id

  certificate_arn = aws_acm_certificate.app.arn
  enable_https    = var.alb_enable_https

  health_check_path     = var.alb_health_check_path
  health_check_interval = 30
  health_check_timeout  = 5

  enable_alb_alarms    = false
  alarm_sns_topic_arns = []

  idle_timeout = 300 # 5 minutes for long-running requests

  depends_on = [module.vpc, module.security_groups, module.s3]
}

# =========================================
# DNS & CDN Module
# =========================================

module "dns_cdn" {
  count  = var.enable_dns_cdn ? 1 : 0
  source = "../../modules/dns-cdn"

  project_name = var.project_name
  environment  = var.environment

  domain_name        = var.domain_name
  create_hosted_zone = var.create_hosted_zone

  alb_dns_name = module.alb.alb_dns_name
  alb_zone_id  = module.alb.alb_zone_id

  enable_cloudfront = var.enable_cloudfront
  enable_waf        = var.enable_waf

  depends_on = [module.alb]
}

# =========================================
# ECS Module
# =========================================

module "ecs" {
  count  = var.deployment_type == "ecs" ? 1 : 0
  source = "../../modules/ecs"

  project_name = var.project_name
  environment  = var.environment
  aws_region   = var.aws_region

  vpc_id                = module.vpc.vpc_id
  private_subnet_ids    = module.vpc.private_subnet_ids
  alb_security_group_id = module.security_groups.alb_security_group_id
  target_group_arn      = module.alb.target_group_arn

  ecs_execution_role_arn = module.iam.ecs_task_execution_role_arn
  ecs_task_role_arn      = module.iam.app_runtime_role_arn

  task_cpu    = var.ecs_task_cpu
  task_memory = var.ecs_task_memory

  desired_count            = var.ecs_desired_count
  enable_autoscaling       = var.ecs_enable_autoscaling
  autoscaling_min_capacity = var.ecs_autoscaling_min_capacity
  autoscaling_max_capacity = var.ecs_autoscaling_max_capacity

  # RDS-managed secret for automatic password rotation support
  rds_secret_arn    = module.rds.master_user_secret_arn
  rds_endpoint      = module.rds.db_endpoint
  rds_database_name = module.rds.db_instance_name

  nextauth_secret_arn       = module.secrets_manager.nextauth_secret_arn
  anthropic_secret_arn      = module.secrets_manager.anthropic_api_key_arn
  encryption_key_secret_arn = module.secrets_manager.encryption_key_arn

  # Optional: uncomment if using Google OAuth or Okta
  # google_oauth_secret_arn = module.secrets_manager.google_oauth_arn
  # okta_oauth_secret_arn   = data.aws_secretsmanager_secret.okta_oauth.arn

  # ElastiCache Redis configuration
  redis_host                  = var.enable_elasticache_redis ? module.redis[0].redis_endpoint : ""
  redis_port                  = var.enable_elasticache_redis ? tostring(module.redis[0].redis_port) : ""
  redis_tls_enabled           = false
  redis_auth_token_secret_arn = ""

  nextauth_url = var.nextauth_url

  enable_execute_command = var.ecs_enable_execute_command
  use_fargate_spot       = var.ecs_use_fargate_spot

  # Background worker service (requires Redis)
  enable_worker = var.enable_elasticache_redis

  enable_alarms       = false
  alarm_sns_topic_arn = ""

  depends_on = [module.alb, module.secrets_manager, module.iam]
}

# =========================================
# Security Group Rule: ALB to ECS Tasks
# =========================================

resource "aws_vpc_security_group_egress_rule" "alb_to_ecs_tasks" {
  count = var.deployment_type == "ecs" ? 1 : 0

  security_group_id            = module.security_groups.alb_security_group_id
  description                  = "Allow traffic from ALB to ECS tasks"
  referenced_security_group_id = module.ecs[0].ecs_tasks_security_group_id
  from_port                    = 3000
  to_port                      = 3000
  ip_protocol                  = "tcp"

  depends_on = [module.ecs]
}

# =========================================
# Amplify Module (Alternative to ECS)
# =========================================

module "amplify" {
  count  = var.deployment_type == "amplify" ? 1 : 0
  source = "../../modules/amplify"

  project_name = var.project_name
  environment  = var.environment

  repository_url           = var.amplify_repository_url
  github_access_token      = "" # Set via terraform.tfvars or environment variable
  amplify_service_role_arn = module.iam.app_runtime_role_arn

  main_branch_name = var.amplify_branch_name

  custom_domain = var.amplify_enable_custom_domain ? var.domain_name : ""

  environment_variables = merge(
    {
      DATABASE_URL = "from-secrets-manager"
      NEXTAUTH_URL = var.nextauth_url
    },
    var.amplify_environment_variables
  )

  enable_basic_auth_for_main = var.amplify_enable_basic_auth
  basic_auth_username        = var.amplify_basic_auth_username
  basic_auth_password        = var.amplify_basic_auth_password

  enable_alarms       = false
  alarm_sns_topic_arn = ""

  depends_on = [module.secrets_manager, module.iam]
}

# =========================================
# Monitoring Module
# =========================================

module "monitoring" {
  count  = var.enable_monitoring ? 1 : 0
  source = "../../modules/monitoring"

  project_name = var.project_name
  environment  = var.environment
  aws_region   = var.aws_region

  critical_alert_emails = var.monitoring_alert_email != "" ? [var.monitoring_alert_email] : []
  warning_alert_emails  = var.monitoring_alert_email != "" ? [var.monitoring_alert_email] : []

  slack_webhook_url_critical = var.monitoring_slack_webhook_url
  slack_webhook_url_warning  = var.monitoring_slack_webhook_url

  # Pass resource identifiers for monitoring
  ecs_cluster_name = var.deployment_type == "ecs" ? module.ecs[0].cluster_name : ""
  alb_arn_suffix   = module.alb.alb_arn_suffix
  rds_instance_id  = module.rds.db_instance_id

  depends_on = [module.ecs, module.alb, module.rds]
}

# =========================================
# Bastion Host Module (Optional)
# =========================================
# Provides secure access to private resources via Tailscale and/or SSM

module "bastion" {
  count  = var.enable_bastion ? 1 : 0
  source = "../../modules/bastion"

  project_name = var.project_name
  environment  = var.environment
  aws_region   = var.aws_region

  vpc_id    = module.vpc.vpc_id
  subnet_id = module.vpc.private_subnet_ids[0]

  instance_type              = var.bastion_instance_type
  enable_detailed_monitoring = false

  # Tailscale configuration (optional)
  tailscale_auth_key_secret_arn = var.tailscale_auth_key_secret_arn
  tailscale_hostname            = var.tailscale_bastion_hostname
  tailscale_tags                = var.tailscale_bastion_tags

  depends_on = [module.vpc, module.security_groups]
}

# Security Group Rule: Allow Bastion to access RDS
resource "aws_vpc_security_group_ingress_rule" "rds_from_bastion" {
  count             = var.enable_bastion ? 1 : 0
  security_group_id = module.security_groups.rds_security_group_id
  description       = "Allow PostgreSQL traffic from bastion host"

  referenced_security_group_id = module.bastion[0].security_group_id
  from_port                    = 5432
  to_port                      = 5432
  ip_protocol                  = "tcp"

  tags = {
    Name = "allow-postgres-from-bastion"
  }

  depends_on = [module.bastion]
}

# =========================================
# Integration Credentials Secrets
# =========================================
# Stores credentials for external integrations (Slack, Zendesk, Notion, Salesforce, Gong)
# Terraform creates these with placeholder values - update credentials in AWS Console

# Slack Bot Tokens (per-library)
resource "aws_secretsmanager_secret" "slack_bot_token_it" {
  name        = "${var.environment}/${var.project_name}-slack-bot-token-it"
  description = "Slack bot token for IT Support library integration"
  tags = {
    Name        = "${var.project_name}-slack-bot-token-it"
    Environment = var.environment
    Purpose     = "Slack Integration"
  }
}

resource "aws_secretsmanager_secret_version" "slack_bot_token_it" {
  secret_id     = aws_secretsmanager_secret.slack_bot_token_it.id
  secret_string = "PLACEHOLDER"
  lifecycle { ignore_changes = [secret_string] }
}

resource "aws_secretsmanager_secret" "slack_bot_token_knowledge" {
  name        = "${var.environment}/${var.project_name}-slack-bot-token-knowledge"
  description = "Slack bot token for Knowledge library integration"
  tags = {
    Name        = "${var.project_name}-slack-bot-token-knowledge"
    Environment = var.environment
    Purpose     = "Slack Integration"
  }
}

resource "aws_secretsmanager_secret_version" "slack_bot_token_knowledge" {
  secret_id     = aws_secretsmanager_secret.slack_bot_token_knowledge.id
  secret_string = "PLACEHOLDER"
  lifecycle { ignore_changes = [secret_string] }
}

resource "aws_secretsmanager_secret" "slack_bot_token_gtm" {
  name        = "${var.environment}/${var.project_name}-slack-bot-token-gtm"
  description = "Slack bot token for GTM library integration"
  tags = {
    Name        = "${var.project_name}-slack-bot-token-gtm"
    Environment = var.environment
    Purpose     = "Slack Integration"
  }
}

resource "aws_secretsmanager_secret_version" "slack_bot_token_gtm" {
  secret_id     = aws_secretsmanager_secret.slack_bot_token_gtm.id
  secret_string = "PLACEHOLDER"
  lifecycle { ignore_changes = [secret_string] }
}

resource "aws_secretsmanager_secret" "slack_bot_token_customers" {
  name        = "${var.environment}/${var.project_name}-slack-bot-token-customers"
  description = "Slack bot token for customer profiles library integration"
  tags = {
    Name        = "${var.project_name}-slack-bot-token-customers"
    Environment = var.environment
    Purpose     = "Slack Integration"
  }
}

resource "aws_secretsmanager_secret_version" "slack_bot_token_customers" {
  secret_id     = aws_secretsmanager_secret.slack_bot_token_customers.id
  secret_string = "PLACEHOLDER"
  lifecycle { ignore_changes = [secret_string] }
}

# Salesforce Credentials
resource "aws_secretsmanager_secret" "salesforce_client_id" {
  name        = "${var.environment}/${var.project_name}-salesforce-client-id"
  description = "Salesforce OAuth client ID"
  tags = {
    Name        = "${var.project_name}-salesforce-client-id"
    Environment = var.environment
    Purpose     = "Salesforce Integration"
  }
}

resource "aws_secretsmanager_secret_version" "salesforce_client_id" {
  secret_id     = aws_secretsmanager_secret.salesforce_client_id.id
  secret_string = "PLACEHOLDER"
  lifecycle { ignore_changes = [secret_string] }
}

resource "aws_secretsmanager_secret" "salesforce_client_secret" {
  name        = "${var.environment}/${var.project_name}-salesforce-client-secret"
  description = "Salesforce OAuth client secret"
  tags = {
    Name        = "${var.project_name}-salesforce-client-secret"
    Environment = var.environment
    Purpose     = "Salesforce Integration"
  }
}

resource "aws_secretsmanager_secret_version" "salesforce_client_secret" {
  secret_id     = aws_secretsmanager_secret.salesforce_client_secret.id
  secret_string = "PLACEHOLDER"
  lifecycle { ignore_changes = [secret_string] }
}

resource "aws_secretsmanager_secret" "salesforce_refresh_token" {
  name        = "${var.environment}/${var.project_name}-salesforce-refresh-token"
  description = "Salesforce OAuth refresh token"
  tags = {
    Name        = "${var.project_name}-salesforce-refresh-token"
    Environment = var.environment
    Purpose     = "Salesforce Integration"
  }
}

resource "aws_secretsmanager_secret_version" "salesforce_refresh_token" {
  secret_id     = aws_secretsmanager_secret.salesforce_refresh_token.id
  secret_string = "PLACEHOLDER"
  lifecycle { ignore_changes = [secret_string] }
}

resource "aws_secretsmanager_secret" "salesforce_instance_url" {
  name        = "${var.environment}/${var.project_name}-salesforce-instance-url"
  description = "Salesforce instance URL"
  tags = {
    Name        = "${var.project_name}-salesforce-instance-url"
    Environment = var.environment
    Purpose     = "Salesforce Integration"
  }
}

resource "aws_secretsmanager_secret_version" "salesforce_instance_url" {
  secret_id     = aws_secretsmanager_secret.salesforce_instance_url.id
  secret_string = "PLACEHOLDER"
  lifecycle { ignore_changes = [secret_string] }
}

# Zendesk Internal Credentials
resource "aws_secretsmanager_secret" "zendesk_internal_subdomain" {
  name        = "${var.environment}/${var.project_name}-zendesk-internal-subdomain"
  description = "Zendesk account subdomain"
  tags = {
    Name        = "${var.project_name}-zendesk-internal-subdomain"
    Environment = var.environment
    Purpose     = "Zendesk Integration"
  }
}

resource "aws_secretsmanager_secret_version" "zendesk_internal_subdomain" {
  secret_id     = aws_secretsmanager_secret.zendesk_internal_subdomain.id
  secret_string = "PLACEHOLDER"
  lifecycle { ignore_changes = [secret_string] }
}

resource "aws_secretsmanager_secret" "zendesk_internal_email" {
  name        = "${var.environment}/${var.project_name}-zendesk-internal-email"
  description = "Zendesk API user email"
  tags = {
    Name        = "${var.project_name}-zendesk-internal-email"
    Environment = var.environment
    Purpose     = "Zendesk Integration"
  }
}

resource "aws_secretsmanager_secret_version" "zendesk_internal_email" {
  secret_id     = aws_secretsmanager_secret.zendesk_internal_email.id
  secret_string = "PLACEHOLDER"
  lifecycle { ignore_changes = [secret_string] }
}

resource "aws_secretsmanager_secret" "zendesk_internal_api_token" {
  name        = "${var.environment}/${var.project_name}-zendesk-internal-api-token"
  description = "Zendesk API token"
  tags = {
    Name        = "${var.project_name}-zendesk-internal-api-token"
    Environment = var.environment
    Purpose     = "Zendesk Integration"
  }
}

resource "aws_secretsmanager_secret_version" "zendesk_internal_api_token" {
  secret_id     = aws_secretsmanager_secret.zendesk_internal_api_token.id
  secret_string = "PLACEHOLDER"
  lifecycle { ignore_changes = [secret_string] }
}

# Zendesk Support Credentials
resource "aws_secretsmanager_secret" "zendesk_support_subdomain" {
  name        = "${var.environment}/${var.project_name}-zendesk-support-subdomain"
  description = "Zendesk Support account subdomain"
  tags = {
    Name        = "${var.project_name}-zendesk-support-subdomain"
    Environment = var.environment
    Purpose     = "Zendesk Integration"
  }
}

resource "aws_secretsmanager_secret_version" "zendesk_support_subdomain" {
  secret_id     = aws_secretsmanager_secret.zendesk_support_subdomain.id
  secret_string = "PLACEHOLDER"
  lifecycle { ignore_changes = [secret_string] }
}

resource "aws_secretsmanager_secret" "zendesk_support_email" {
  name        = "${var.environment}/${var.project_name}-zendesk-support-email"
  description = "Zendesk Support API user email"
  tags = {
    Name        = "${var.project_name}-zendesk-support-email"
    Environment = var.environment
    Purpose     = "Zendesk Integration"
  }
}

resource "aws_secretsmanager_secret_version" "zendesk_support_email" {
  secret_id     = aws_secretsmanager_secret.zendesk_support_email.id
  secret_string = "PLACEHOLDER"
  lifecycle { ignore_changes = [secret_string] }
}

resource "aws_secretsmanager_secret" "zendesk_support_api_token" {
  name        = "${var.environment}/${var.project_name}-zendesk-support-api-token"
  description = "Zendesk Support API token"
  tags = {
    Name        = "${var.project_name}-zendesk-support-api-token"
    Environment = var.environment
    Purpose     = "Zendesk Integration"
  }
}

resource "aws_secretsmanager_secret_version" "zendesk_support_api_token" {
  secret_id     = aws_secretsmanager_secret.zendesk_support_api_token.id
  secret_string = "PLACEHOLDER"
  lifecycle { ignore_changes = [secret_string] }
}

# Gong Credentials
resource "aws_secretsmanager_secret" "gong_access_key" {
  name        = "${var.environment}/${var.project_name}-gong-access-key"
  description = "Gong API access key"
  tags = {
    Name        = "${var.project_name}-gong-access-key"
    Environment = var.environment
    Purpose     = "Gong Integration"
  }
}

resource "aws_secretsmanager_secret_version" "gong_access_key" {
  secret_id     = aws_secretsmanager_secret.gong_access_key.id
  secret_string = "PLACEHOLDER"
  lifecycle { ignore_changes = [secret_string] }
}

resource "aws_secretsmanager_secret" "gong_access_key_secret" {
  name        = "${var.environment}/${var.project_name}-gong-access-key-secret"
  description = "Gong API access key secret"
  tags = {
    Name        = "${var.project_name}-gong-access-key-secret"
    Environment = var.environment
    Purpose     = "Gong Integration"
  }
}

resource "aws_secretsmanager_secret_version" "gong_access_key_secret" {
  secret_id     = aws_secretsmanager_secret.gong_access_key_secret.id
  secret_string = "PLACEHOLDER"
  lifecycle { ignore_changes = [secret_string] }
}

# Notion Credentials
resource "aws_secretsmanager_secret" "notion_api_token" {
  name        = "${var.environment}/${var.project_name}-notion-api-token"
  description = "Notion Internal Integration API token"
  tags = {
    Name        = "${var.project_name}-notion-api-token"
    Environment = var.environment
    Purpose     = "Notion Integration"
  }
}

resource "aws_secretsmanager_secret_version" "notion_api_token" {
  secret_id     = aws_secretsmanager_secret.notion_api_token.id
  secret_string = "PLACEHOLDER"
  lifecycle { ignore_changes = [secret_string] }
}
