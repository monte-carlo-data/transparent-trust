# Variables for Monitoring Infrastructure
# Reference: SEC-1058 - Monitoring & Logging

variable "project_name" {
  description = "Name of the project"
  type        = string
  default     = "transparent-trust"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "production"
}

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "tags" {
  description = "Additional tags"
  type        = map(string)
  default = {
    Project   = "transparent-trust"
    ManagedBy = "terraform"
    Component = "monitoring"
  }
}

# SNS Configuration
variable "enable_sns_encryption" {
  description = "Enable SNS topic encryption"
  type        = bool
  default     = true
}

variable "sns_kms_key_id" {
  description = "KMS key ID for SNS encryption"
  type        = string
  default     = ""
}

variable "critical_alert_emails" {
  description = "Email addresses for critical alerts"
  type        = list(string)
  default     = []
}

variable "warning_alert_emails" {
  description = "Email addresses for warning alerts"
  type        = list(string)
  default     = []
}

variable "slack_webhook_url_critical" {
  description = "Slack webhook URL for critical alerts"
  type        = string
  default     = ""
  sensitive   = true
}

variable "slack_webhook_url_warning" {
  description = "Slack webhook URL for warning alerts"
  type        = string
  default     = ""
  sensitive   = true
}

# Resource IDs
variable "ecs_cluster_name" {
  description = "ECS cluster name"
  type        = string
  default     = ""
}

variable "rds_instance_id" {
  description = "RDS instance identifier"
  type        = string
  default     = ""
}

variable "redis_replication_group_id" {
  description = "Redis replication group ID"
  type        = string
  default     = ""
}

variable "alb_arn_suffix" {
  description = "ALB ARN suffix"
  type        = string
  default     = ""
}

variable "log_group_name" {
  description = "CloudWatch log group name"
  type        = string
  default     = ""
}

# Alarm Configuration
variable "create_app_alarms" {
  description = "Create application-level alarms"
  type        = bool
  default     = true
}

variable "create_db_alarms" {
  description = "Create database alarms"
  type        = bool
  default     = true
}

variable "create_composite_alarms" {
  description = "Create composite alarms"
  type        = bool
  default     = true
}

variable "create_log_insights_queries" {
  description = "Create Log Insights saved queries"
  type        = bool
  default     = true
}

# Alarm Thresholds
variable "error_rate_threshold" {
  description = "5XX error count threshold"
  type        = number
  default     = 10
}

variable "response_time_threshold" {
  description = "Response time threshold in seconds"
  type        = number
  default     = 2
}

variable "rds_cpu_threshold" {
  description = "RDS CPU threshold percentage"
  type        = number
  default     = 80
}

variable "rds_connections_threshold" {
  description = "RDS connections threshold"
  type        = number
  default     = 80
}

variable "rds_storage_threshold_bytes" {
  description = "RDS free storage threshold in bytes"
  type        = number
  default     = 5368709120 # 5 GB
}
