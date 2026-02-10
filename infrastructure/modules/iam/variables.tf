# Variables for IAM module
# Reference: SEC-1046 - IAM Roles for Application Services

variable "environment" {
  description = "Environment name (e.g., production, staging, development)"
  type        = string
  default     = "production"

  validation {
    condition     = contains(["production", "staging", "development"], var.environment)
    error_message = "Environment must be production, staging, or development."
  }
}

variable "aws_region" {
  description = "AWS region for resource deployment"
  type        = string
  default     = "us-east-1"
}

variable "enable_lambda" {
  description = "Whether to create Lambda execution roles"
  type        = bool
  default     = false
}

variable "lambda_vpc_access" {
  description = "Whether Lambda functions need VPC access"
  type        = bool
  default     = false
}

variable "enable_xray" {
  description = "Whether to enable AWS X-Ray tracing"
  type        = bool
  default     = false
}

variable "project_name" {
  description = "Project name for resource naming and tagging"
  type        = string
  default     = "transparent-trust"
}
