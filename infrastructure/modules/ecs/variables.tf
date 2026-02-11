# Variables for ECS/Fargate Infrastructure
# Reference: SEC-1047 - ECS/Fargate deployment

# =========================================
# General Configuration
# =========================================

variable "project_name" {
  description = "Name of the project (used for resource naming)"
  type        = string
  default     = "transparent-trust"
}

variable "environment" {
  description = "Environment name (e.g., production, staging, development)"
  type        = string
  default     = "production"
}

variable "aws_region" {
  description = "AWS region for resources"
  type        = string
  default     = "us-east-1"
}

variable "tags" {
  description = "Additional tags to apply to all resources"
  type        = map(string)
  default = {
    Project   = "transparent-trust"
    ManagedBy = "terraform"
    Component = "ecs"
  }
}

# =========================================
# Networking
# =========================================

variable "vpc_id" {
  description = "ID of the VPC where ECS tasks will run"
  type        = string
}

variable "private_subnet_ids" {
  description = "List of private subnet IDs for ECS tasks"
  type        = list(string)
}

variable "alb_security_group_id" {
  description = "Security group ID of the Application Load Balancer (if using ALB)"
  type        = string
  default     = ""
}

variable "target_group_arn" {
  description = "ARN of the ALB target group (leave empty if not using ALB)"
  type        = string
  default     = ""
}

# =========================================
# ECS Cluster Configuration
# =========================================

variable "enable_container_insights" {
  description = "Enable CloudWatch Container Insights for the ECS cluster"
  type        = bool
  default     = true
}

variable "use_fargate_spot" {
  description = "Use Fargate Spot instances for cost savings (may have interruptions)"
  type        = bool
  default     = false
}

# =========================================
# ECR Configuration
# =========================================

variable "ecr_image_tag_mutability" {
  description = "Image tag mutability setting for ECR repository (MUTABLE or IMMUTABLE)"
  type        = string
  default     = "MUTABLE"

  validation {
    condition     = contains(["MUTABLE", "IMMUTABLE"], var.ecr_image_tag_mutability)
    error_message = "ECR image tag mutability must be either MUTABLE or IMMUTABLE."
  }
}

variable "ecr_scan_on_push" {
  description = "Enable automatic vulnerability scanning on image push"
  type        = bool
  default     = true
}

variable "ecr_image_count" {
  description = "Number of tagged images to keep in ECR"
  type        = number
  default     = 30
}

variable "ecr_untagged_days" {
  description = "Number of days to keep untagged images"
  type        = number
  default     = 7
}

variable "ecr_kms_key_arn" {
  description = "ARN of KMS key for ECR encryption (leave empty to use AWS managed key)"
  type        = string
  default     = ""
}

# =========================================
# Task Definition Configuration
# =========================================

variable "task_cpu" {
  description = "CPU units for the task (256, 512, 1024, 2048, 4096)"
  type        = number
  default     = 512

  validation {
    condition     = contains([256, 512, 1024, 2048, 4096], var.task_cpu)
    error_message = "Task CPU must be one of: 256, 512, 1024, 2048, 4096."
  }
}

variable "task_memory" {
  description = "Memory for the task in MB (must be compatible with CPU)"
  type        = number
  default     = 1024
}

variable "container_name" {
  description = "Name of the container in the task definition"
  type        = string
  default     = "app"
}

variable "container_port" {
  description = "Port that the container listens on"
  type        = number
  default     = 3000
}

variable "image_tag" {
  description = "Docker image tag to deploy"
  type        = string
  default     = "latest"
}

# =========================================
# IAM Roles
# =========================================

variable "ecs_execution_role_arn" {
  description = "ARN of the ECS task execution role (for pulling images and secrets)"
  type        = string
}

variable "ecs_task_role_arn" {
  description = "ARN of the ECS task role (for application runtime permissions)"
  type        = string
}

# =========================================
# Secrets Manager Integration
# =========================================

variable "database_secret_arn" {
  description = "ARN of the database secret in Secrets Manager (DEPRECATED: use rds_secret_arn instead)"
  type        = string
  default     = ""
}

variable "rds_secret_arn" {
  description = "ARN of the RDS-managed secret containing username and password"
  type        = string
  default     = ""
}

variable "rds_endpoint" {
  description = "RDS database endpoint (host:port or just host)"
  type        = string
  default     = ""
}

variable "rds_database_name" {
  description = "RDS database name"
  type        = string
  default     = "transparenttrust"
}

variable "nextauth_secret_arn" {
  description = "ARN of the NextAuth secret in Secrets Manager"
  type        = string
}

variable "anthropic_secret_arn" {
  description = "ARN of the Anthropic API key secret in Secrets Manager"
  type        = string
}

variable "google_oauth_secret_arn" {
  description = "ARN of the Google OAuth secret in Secrets Manager"
  type        = string
}

variable "okta_oauth_secret_arn" {
  description = "ARN of the Okta OAuth secret in Secrets Manager"
  type        = string
  default     = ""
}

variable "encryption_key_secret_arn" {
  description = "ARN of the encryption key secret in Secrets Manager"
  type        = string
}

variable "redis_secret_arn" {
  description = "ARN of the Redis secret in Secrets Manager (optional, for Upstash)"
  type        = string
  default     = ""
}

variable "redis_host" {
  description = "Redis host (for AWS ElastiCache)"
  type        = string
  default     = ""
}

variable "redis_port" {
  description = "Redis port (for AWS ElastiCache)"
  type        = string
  default     = ""
}

variable "redis_tls_enabled" {
  description = "Whether Redis TLS is enabled"
  type        = bool
  default     = false
}

variable "redis_auth_token_secret_arn" {
  description = "ARN of Redis auth token secret (for ElastiCache with TLS)"
  type        = string
  default     = ""
}

variable "github_secret_arn" {
  description = "ARN of the GitHub token secret in Secrets Manager (optional, for git sync)"
  type        = string
  default     = ""
}

variable "nextauth_url" {
  description = "Public URL for NextAuth (e.g., https://app.example.com)"
  type        = string
}

variable "additional_environment_variables" {
  description = "Additional environment variables for the container"
  type = list(object({
    name  = string
    value = string
  }))
  default = []
}

# =========================================
# ECS Service Configuration
# =========================================

variable "desired_count" {
  description = "Desired number of tasks to run"
  type        = number
  default     = 2
}

variable "deployment_maximum_percent" {
  description = "Maximum percentage of tasks that can run during deployment"
  type        = number
  default     = 200
}

variable "deployment_minimum_healthy_percent" {
  description = "Minimum percentage of tasks that must remain healthy during deployment"
  type        = number
  default     = 100
}

variable "health_check_grace_period" {
  description = "Seconds to wait before starting health checks (for ALB)"
  type        = number
  default     = 60
}

variable "enable_execute_command" {
  description = "Enable ECS Exec for debugging (SSH into containers)"
  type        = bool
  default     = false
}

# =========================================
# Health Check Configuration
# =========================================

variable "health_check_path" {
  description = "Path for container health checks"
  type        = string
  default     = "/api/health"
}

variable "health_check_interval" {
  description = "Seconds between health checks"
  type        = number
  default     = 30
}

variable "health_check_timeout" {
  description = "Seconds before health check times out"
  type        = number
  default     = 5
}

variable "health_check_retries" {
  description = "Number of consecutive failures before marking unhealthy"
  type        = number
  default     = 3
}

variable "health_check_start_period" {
  description = "Seconds to wait before starting health checks (container startup time)"
  type        = number
  default     = 60
}

# =========================================
# Auto Scaling Configuration
# =========================================

variable "enable_autoscaling" {
  description = "Enable auto scaling for the ECS service"
  type        = bool
  default     = true
}

variable "autoscaling_min_capacity" {
  description = "Minimum number of tasks"
  type        = number
  default     = 2
}

variable "autoscaling_max_capacity" {
  description = "Maximum number of tasks"
  type        = number
  default     = 10
}

variable "autoscaling_cpu_target" {
  description = "Target CPU utilization percentage for scaling"
  type        = number
  default     = 70
}

variable "autoscaling_memory_target" {
  description = "Target memory utilization percentage for scaling"
  type        = number
  default     = 80
}

variable "autoscaling_scale_in_cooldown" {
  description = "Seconds to wait before allowing another scale in"
  type        = number
  default     = 300
}

variable "autoscaling_scale_out_cooldown" {
  description = "Seconds to wait before allowing another scale out"
  type        = number
  default     = 60
}

# =========================================
# Logging Configuration
# =========================================

variable "log_retention_days" {
  description = "Number of days to retain CloudWatch logs"
  type        = number
  default     = 30

  validation {
    condition = contains([
      1, 3, 5, 7, 14, 30, 60, 90, 120, 150, 180, 365, 400, 545, 731, 1827, 3653
    ], var.log_retention_days)
    error_message = "Log retention days must be a valid CloudWatch Logs retention period."
  }
}

variable "cloudwatch_kms_key_arn" {
  description = "ARN of KMS key for CloudWatch Logs encryption (leave empty for AWS managed)"
  type        = string
  default     = ""
}

# =========================================
# Monitoring & Alarms
# =========================================

variable "enable_alarms" {
  description = "Enable CloudWatch alarms for the ECS service"
  type        = bool
  default     = true
}

variable "cpu_alarm_threshold" {
  description = "CPU utilization threshold for alarms (percentage)"
  type        = number
  default     = 80
}

variable "memory_alarm_threshold" {
  description = "Memory utilization threshold for alarms (percentage)"
  type        = number
  default     = 80
}

variable "alarm_sns_topic_arn" {
  description = "ARN of SNS topic for alarm notifications"
  type        = string
  default     = ""
}

# =========================================
# Worker Service Configuration
# =========================================

variable "enable_worker" {
  description = "Enable the background worker ECS service for job queue processing"
  type        = bool
  default     = false
}

variable "worker_task_cpu" {
  description = "CPU units for the worker task (256, 512, 1024, 2048, 4096)"
  type        = number
  default     = 256

  validation {
    condition     = contains([256, 512, 1024, 2048, 4096], var.worker_task_cpu)
    error_message = "Worker task CPU must be one of: 256, 512, 1024, 2048, 4096."
  }
}

variable "worker_task_memory" {
  description = "Memory for the worker task in MB (must be compatible with CPU)"
  type        = number
  default     = 512
}

variable "worker_desired_count" {
  description = "Desired number of worker tasks to run"
  type        = number
  default     = 1
}
