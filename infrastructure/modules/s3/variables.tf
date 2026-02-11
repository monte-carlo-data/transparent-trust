# Variables for S3 Buckets Module

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
# Application Uploads Bucket Configuration
# -----------------------------------------------------------------------------

variable "enable_versioning" {
  description = "Enable versioning for the application uploads bucket"
  type        = bool
  default     = true
}

variable "use_kms_encryption" {
  description = "Use KMS encryption instead of AES256 for the uploads bucket"
  type        = bool
  default     = false
}

variable "app_role_arn" {
  description = "ARN of the application IAM role that needs access to S3 buckets"
  type        = string
  default     = ""
}

# -----------------------------------------------------------------------------
# Lifecycle Policies
# -----------------------------------------------------------------------------

variable "enable_lifecycle_policies" {
  description = "Enable lifecycle policies for the uploads bucket"
  type        = bool
  default     = true
}

variable "transition_to_ia_days" {
  description = "Number of days before transitioning objects to Infrequent Access storage"
  type        = number
  default     = 90
}

variable "transition_to_glacier_days" {
  description = "Number of days before transitioning objects to Glacier storage"
  type        = number
  default     = 180
}

variable "expire_after_days" {
  description = "Number of days before expiring objects (0 = never expire)"
  type        = number
  default     = 0 # Never expire by default
}

variable "noncurrent_version_expiration_days" {
  description = "Number of days before expiring noncurrent versions"
  type        = number
  default     = 90
}

# -----------------------------------------------------------------------------
# Log Retention
# -----------------------------------------------------------------------------

variable "alb_logs_retention_days" {
  description = "Number of days to retain ALB access logs"
  type        = number
  default     = 180 # Must be greater than last transition (90 days to GLACIER)
}

variable "cloudtrail_logs_retention_days" {
  description = "Number of days to retain CloudTrail logs"
  type        = number
  default     = 365 # 1 year for compliance
}

variable "general_logs_retention_days" {
  description = "Number of days to retain general logs"
  type        = number
  default     = 180 # Must be greater than last transition (90 days to GLACIER)
}

# -----------------------------------------------------------------------------
# CORS Configuration
# -----------------------------------------------------------------------------

variable "enable_cors" {
  description = "Enable CORS configuration for the uploads bucket"
  type        = bool
  default     = true
}

variable "cors_allowed_origins" {
  description = "List of allowed origins for CORS"
  type        = list(string)
  default     = ["*"] # Override in production with specific domain
}

variable "cors_allowed_methods" {
  description = "List of allowed HTTP methods for CORS"
  type        = list(string)
  default     = ["GET", "PUT", "POST", "DELETE", "HEAD"]
}

variable "cors_allowed_headers" {
  description = "List of allowed headers for CORS"
  type        = list(string)
  default     = ["*"]
}

# -----------------------------------------------------------------------------
# Access Logging
# -----------------------------------------------------------------------------

variable "enable_access_logging" {
  description = "Enable S3 access logging for the uploads bucket"
  type        = bool
  default     = true
}

# -----------------------------------------------------------------------------
# KMS Configuration
# -----------------------------------------------------------------------------

variable "kms_deletion_window_days" {
  description = "Number of days before KMS key deletion (7-30)"
  type        = number
  default     = 30
}

# -----------------------------------------------------------------------------
# CloudWatch Alarms
# -----------------------------------------------------------------------------

variable "enable_cloudwatch_alarms" {
  description = "Enable CloudWatch alarms for S3 buckets"
  type        = bool
  default     = true
}

variable "bucket_size_alarm_threshold" {
  description = "Threshold in bytes for bucket size alarm"
  type        = number
  default     = 107374182400 # 100 GB
}

variable "alarm_sns_topic_arn" {
  description = "SNS topic ARN for CloudWatch alarms"
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
