# Variables for Secrets Manager Module
#
# This module references existing secrets in AWS Secrets Manager.
# Secrets must be created manually by administrators.

# -----------------------------------------------------------------------------
# Required Variables
# -----------------------------------------------------------------------------

variable "project_name" {
  description = "Project name used for resource naming"
  type        = string
}

variable "environment" {
  description = "Environment name (e.g., production, staging, development)"
  type        = string
}

# -----------------------------------------------------------------------------
# Secret Reference Flags
# -----------------------------------------------------------------------------

variable "reference_nextauth_secret" {
  description = "Reference existing NextAuth.js secret in Secrets Manager"
  type        = bool
  default     = true
}

variable "reference_anthropic_secret" {
  description = "Reference existing Anthropic API key secret in Secrets Manager"
  type        = bool
  default     = true
}

variable "reference_google_oauth_secret" {
  description = "Reference existing Google OAuth credentials secret in Secrets Manager"
  type        = bool
  default     = false
}

variable "reference_okta_oauth_secret" {
  description = "Reference existing Okta OAuth credentials secret in Secrets Manager"
  type        = bool
  default     = true
}

variable "reference_upstash_redis_secret" {
  description = "Reference existing Upstash Redis credentials secret in Secrets Manager"
  type        = bool
  default     = false
}

variable "reference_encryption_key" {
  description = "Reference existing application encryption key secret in Secrets Manager"
  type        = bool
  default     = true
}

# -----------------------------------------------------------------------------
# RDS Secret Configuration
# -----------------------------------------------------------------------------

variable "import_rds_secret" {
  description = "Import existing RDS secret created by RDS module"
  type        = bool
  default     = false
}

variable "database_secret_name" {
  description = "Name of the RDS database secret (if importing)"
  type        = string
  default     = ""
}

# -----------------------------------------------------------------------------
# IAM Configuration
# -----------------------------------------------------------------------------

variable "app_role_name" {
  description = "Name of the application IAM role to attach secrets policy"
  type        = string
  default     = ""
}

variable "kms_key_arn" {
  description = "ARN of KMS key for secret encryption (optional, uses AWS managed key if not specified)"
  type        = string
  default     = ""
}

# -----------------------------------------------------------------------------
# Monitoring
# -----------------------------------------------------------------------------

variable "enable_cloudwatch_alarms" {
  description = "Enable CloudWatch alarms for secret access monitoring"
  type        = bool
  default     = true
}

variable "alarm_sns_topic_arn" {
  description = "SNS topic ARN for CloudWatch alarm notifications"
  type        = string
  default     = ""
}

# -----------------------------------------------------------------------------
# Tags
# -----------------------------------------------------------------------------

variable "tags" {
  description = "Additional tags to apply to all resources"
  type        = map(string)
  default     = {}
}
