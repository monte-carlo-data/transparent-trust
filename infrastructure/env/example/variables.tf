# Variables for Environment Configuration
# Copy this file when creating a new environment

# =========================================
# General Configuration
# =========================================

variable "project_name" {
  description = "Project name for resource naming and tagging"
  type        = string
  default     = "transparent-trust"
}

variable "environment" {
  description = "Environment name (e.g., development, staging, production)"
  type        = string
  default     = "development"
}

variable "aws_region" {
  description = "AWS region for resource deployment"
  type        = string
  default     = "us-east-1"
}

# =========================================
# VPC Configuration
# =========================================

variable "vpc_cidr" {
  description = "CIDR block for the VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "availability_zones" {
  description = "List of availability zones"
  type        = list(string)
  default     = ["us-east-1a", "us-east-1b"]
}

variable "enable_nat_gateway" {
  description = "Enable NAT Gateway for private subnets"
  type        = bool
  default     = true
}

variable "enable_flow_logs" {
  description = "Enable VPC Flow Logs"
  type        = bool
  default     = true
}

variable "app_connector_vpc_cidr" {
  description = "CIDR of Tailscale app connector VPC (if applicable)"
  type        = string
  default     = ""
}

# =========================================
# Security Groups Configuration
# =========================================

variable "alb_ingress_cidr_blocks" {
  description = "CIDR blocks allowed to access ALB"
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

# =========================================
# S3 Configuration
# =========================================

variable "s3_enable_versioning" {
  description = "Enable S3 bucket versioning"
  type        = bool
  default     = true
}

variable "s3_enable_lifecycle" {
  description = "Enable S3 lifecycle policies"
  type        = bool
  default     = true
}

# =========================================
# RDS Configuration
# =========================================

variable "rds_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t3.small"

  validation {
    condition = contains([
      "db.t3.micro", "db.t3.small", "db.t3.medium", "db.t3.large"
    ], var.rds_instance_class)
    error_message = "RDS instance class must be db.t3.micro/small/medium/large."
  }
}

variable "rds_allocated_storage" {
  description = "Allocated storage for RDS in GB"
  type        = number
  default     = 20
}

variable "rds_engine_version" {
  description = "PostgreSQL engine version"
  type        = string
  default     = "16.11"
}

variable "rds_database_name" {
  description = "Name of the database"
  type        = string
  default     = "transparenttrust"
}

variable "rds_master_username" {
  description = "Master username for RDS"
  type        = string
  default     = "dbadmin"
}

variable "rds_multi_az" {
  description = "Enable Multi-AZ for RDS"
  type        = bool
  default     = false
}

variable "rds_backup_retention_period" {
  description = "Backup retention period in days"
  type        = number
  default     = 7
}

variable "rds_enable_enhanced_monitoring" {
  description = "Enable enhanced monitoring for RDS"
  type        = bool
  default     = true
}

variable "rds_enable_performance_insights" {
  description = "Enable Performance Insights for RDS"
  type        = bool
  default     = true
}

variable "database_url" {
  description = "Optional database URL for manual configuration"
  type        = string
  default     = ""
  sensitive   = true
}

# =========================================
# Redis Configuration
# =========================================

variable "enable_elasticache_redis" {
  description = "Enable ElastiCache Redis"
  type        = bool
  default     = false
}

variable "redis_node_type" {
  description = "Redis node type"
  type        = string
  default     = "cache.t3.micro"
}

variable "redis_num_cache_nodes" {
  description = "Number of cache nodes"
  type        = number
  default     = 1
}

variable "redis_parameter_group_family" {
  description = "Redis parameter group family"
  type        = string
  default     = "redis7"
}

# =========================================
# ALB Configuration
# =========================================

variable "alb_certificate_arn" {
  description = "ARN of ACM certificate for HTTPS (optional, certificate created in main.tf)"
  type        = string
  default     = ""
}

variable "alb_enable_https" {
  description = "Enable HTTPS listener on ALB"
  type        = bool
  default     = true
}

variable "alb_health_check_path" {
  description = "Health check path for ALB target group"
  type        = string
  default     = "/api/health"
}

# =========================================
# DNS & Certificate Configuration
# =========================================

variable "domain_name" {
  description = "Domain name for the application (e.g., app.dev.example.com)"
  type        = string
  default     = ""
}

variable "certificate_san" {
  description = "Subject alternative names for the ACM certificate"
  type        = list(string)
  default     = []
}

variable "enable_dns_cdn" {
  description = "Enable DNS and CDN module"
  type        = bool
  default     = false
}

variable "create_hosted_zone" {
  description = "Create new Route53 hosted zone"
  type        = bool
  default     = false
}

variable "hosted_zone_id" {
  description = "Existing Route53 hosted zone ID"
  type        = string
  default     = ""
}

variable "route53_cross_account_role_arn" {
  description = "IAM role ARN for cross-account Route53 access"
  type        = string
  default     = ""
}

variable "enable_cloudfront" {
  description = "Enable CloudFront CDN"
  type        = bool
  default     = false
}

variable "enable_waf" {
  description = "Enable AWS WAF"
  type        = bool
  default     = false
}

# =========================================
# Deployment Type
# =========================================

variable "deployment_type" {
  description = "Deployment type: 'ecs' or 'amplify'"
  type        = string
  default     = "ecs"

  validation {
    condition     = contains(["ecs", "amplify"], var.deployment_type)
    error_message = "Deployment type must be 'ecs' or 'amplify'."
  }
}

# =========================================
# ECS Configuration
# =========================================

variable "ecs_task_cpu" {
  description = "CPU units for ECS task"
  type        = number
  default     = 512
}

variable "ecs_task_memory" {
  description = "Memory for ECS task in MB"
  type        = number
  default     = 1024
}

variable "ecs_desired_count" {
  description = "Desired number of ECS tasks"
  type        = number
  default     = 1
}

variable "ecs_enable_autoscaling" {
  description = "Enable ECS auto scaling"
  type        = bool
  default     = false
}

variable "ecs_autoscaling_min_capacity" {
  description = "Minimum number of ECS tasks"
  type        = number
  default     = 1
}

variable "ecs_autoscaling_max_capacity" {
  description = "Maximum number of ECS tasks"
  type        = number
  default     = 4
}

variable "ecs_enable_execute_command" {
  description = "Enable ECS Exec for debugging"
  type        = bool
  default     = true
}

variable "ecs_use_fargate_spot" {
  description = "Use Fargate Spot for cost savings"
  type        = bool
  default     = false
}

# =========================================
# Amplify Configuration
# =========================================

variable "amplify_repository_url" {
  description = "Git repository URL for Amplify"
  type        = string
  default     = ""
}

variable "amplify_branch_name" {
  description = "Git branch name for Amplify"
  type        = string
  default     = "main"
}

variable "amplify_enable_custom_domain" {
  description = "Enable custom domain for Amplify"
  type        = bool
  default     = false
}

variable "amplify_environment_variables" {
  description = "Additional environment variables for Amplify"
  type        = map(string)
  default     = {}
}

variable "amplify_enable_basic_auth" {
  description = "Enable basic auth for Amplify"
  type        = bool
  default     = true
}

variable "amplify_basic_auth_username" {
  description = "Basic auth username for Amplify"
  type        = string
  default     = "admin"
  sensitive   = true
}

variable "amplify_basic_auth_password" {
  description = "Basic auth password for Amplify"
  type        = string
  default     = ""
  sensitive   = true
}

# =========================================
# Secrets Configuration
# =========================================

variable "enable_secret_rotation" {
  description = "Enable automatic secret rotation"
  type        = bool
  default     = false
}

variable "nextauth_url" {
  description = "NextAuth URL for the application"
  type        = string
  default     = ""
}

# =========================================
# Monitoring Configuration
# =========================================

variable "enable_monitoring" {
  description = "Enable monitoring and alarms"
  type        = bool
  default     = false
}

variable "monitoring_alert_email" {
  description = "Email address for monitoring alerts"
  type        = string
  default     = ""
}

variable "monitoring_slack_webhook_url" {
  description = "Slack webhook URL for monitoring alerts"
  type        = string
  default     = ""
  sensitive   = true
}

variable "monitoring_create_dashboard" {
  description = "Create CloudWatch dashboard"
  type        = bool
  default     = true
}

# =========================================
# Additional Configuration
# =========================================

variable "enable_xray_tracing" {
  description = "Enable AWS X-Ray tracing"
  type        = bool
  default     = false
}

# =========================================
# Bastion Host Configuration
# =========================================

variable "enable_bastion" {
  description = "Enable bastion host for secure access to private resources"
  type        = bool
  default     = true
}

variable "bastion_instance_type" {
  description = "EC2 instance type for bastion host"
  type        = string
  default     = "t3.micro"

  validation {
    condition     = contains(["t3.micro", "t3.small"], var.bastion_instance_type)
    error_message = "Bastion instance type must be t3.micro or t3.small."
  }
}

variable "tailscale_auth_key_secret_arn" {
  description = "ARN of the Secrets Manager secret containing the Tailscale auth key"
  type        = string
  default     = ""
}

variable "tailscale_bastion_hostname" {
  description = "Hostname for the bastion in Tailscale"
  type        = string
  default     = ""
}

variable "tailscale_bastion_tags" {
  description = "Tailscale ACL tag for the bastion"
  type        = string
  default     = "tag:bastion"
}
