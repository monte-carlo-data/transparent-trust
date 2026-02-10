# Variables for S3 Policies Module

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

variable "app_uploads_bucket_id" {
  description = "ID (name) of the application uploads bucket"
  type        = string
}

variable "app_uploads_bucket_arn" {
  description = "ARN of the application uploads bucket"
  type        = string
}

# -----------------------------------------------------------------------------
# Application Configuration
# -----------------------------------------------------------------------------

variable "app_role_name" {
  description = "Name of the application IAM role to attach policies to"
  type        = string
  default     = ""
}

variable "app_role_arn" {
  description = "ARN of the application IAM role"
  type        = string
  default     = ""
}

# -----------------------------------------------------------------------------
# Encryption Configuration
# -----------------------------------------------------------------------------

variable "use_kms_encryption" {
  description = "Whether the bucket uses KMS encryption (affects policy conditions)"
  type        = bool
  default     = false
}

variable "kms_key_arn" {
  description = "ARN of the KMS key used for S3 encryption (required if use_kms_encryption is true)"
  type        = string
  default     = ""
}

# -----------------------------------------------------------------------------
# Policy Creation Flags
# -----------------------------------------------------------------------------

variable "create_readonly_policy" {
  description = "Create a read-only S3 access policy (for analytics/reporting)"
  type        = bool
  default     = true
}

variable "create_lambda_policy" {
  description = "Create Lambda function S3 access policy"
  type        = bool
  default     = false
}

variable "create_bucket_policies" {
  description = "Create bucket policies (enforce SSL, encryption)"
  type        = bool
  default     = true
}

variable "create_access_point" {
  description = "Create S3 Access Point for advanced access control"
  type        = bool
  default     = false
}

# -----------------------------------------------------------------------------
# Replication Configuration
# -----------------------------------------------------------------------------

variable "enable_replication" {
  description = "Enable cross-region replication setup"
  type        = bool
  default     = false
}

variable "replication_destination_bucket_arn" {
  description = "ARN of the destination bucket for replication"
  type        = string
  default     = ""
}

variable "replication_destination_kms_key_arn" {
  description = "ARN of the KMS key in the destination region (if using KMS)"
  type        = string
  default     = ""
}

# -----------------------------------------------------------------------------
# Access Point Configuration
# -----------------------------------------------------------------------------

variable "access_point_vpc_id" {
  description = "VPC ID for S3 Access Point (restricts access to VPC only)"
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
