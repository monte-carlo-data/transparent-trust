variable "project_name" {
  description = "Name of the project - used for resource naming"
  type        = string
  default     = "transparent-trust"
}

variable "aws_region" {
  description = "AWS region for bootstrap resources"
  type        = string
  default     = "us-east-1"
}

variable "state_bucket_name" {
  description = "Name of the S3 bucket for Terraform state storage"
  type        = string
  default     = "transparent-trust-terraform-state"

  validation {
    condition     = can(regex("^[a-z0-9][a-z0-9-]*[a-z0-9]$", var.state_bucket_name)) && length(var.state_bucket_name) >= 3 && length(var.state_bucket_name) <= 63
    error_message = "Bucket name must be between 3-63 characters, start and end with lowercase letter or number, and contain only lowercase letters, numbers, and hyphens."
  }
}

variable "lock_table_name" {
  description = "Name of the DynamoDB table for Terraform state locking"
  type        = string
  default     = "transparent-trust-terraform-locks"
}

variable "state_retention_days" {
  description = "Number of days to retain non-current versions of state files"
  type        = number
  default     = 90

  validation {
    condition     = var.state_retention_days >= 1 && var.state_retention_days <= 365
    error_message = "State retention days must be between 1 and 365."
  }
}
