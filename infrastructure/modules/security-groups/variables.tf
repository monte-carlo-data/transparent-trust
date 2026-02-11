# Variables for Security Groups module
# Reference: SEC-1053 - Security Groups and NACLs

variable "project_name" {
  description = "Project name for resource naming and tagging"
  type        = string
  default     = "transparent-trust"
}

variable "environment" {
  description = "Environment name (e.g., production, staging, development)"
  type        = string
  default     = "production"

  validation {
    condition     = contains(["production", "staging", "development"], var.environment)
    error_message = "Environment must be production, staging, or development."
  }
}

variable "vpc_cidr" {
  description = "CIDR block of the VPC"
  type        = string
}

variable "app_port" {
  description = "Port the application listens on"
  type        = number
  default     = 3000
}

variable "allow_http_to_alb" {
  description = "Whether to allow HTTP traffic to ALB (typically for redirecting to HTTPS)"
  type        = bool
  default     = true
}

variable "enable_redis" {
  description = "Whether to create Redis security group"
  type        = bool
  default     = false
}

variable "enable_vpc_endpoints" {
  description = "Whether to create VPC endpoints security group"
  type        = bool
  default     = false
}

variable "enable_custom_nacls" {
  description = "Whether to create custom Network ACLs (uses default VPC NACL if false)"
  type        = bool
  default     = false
}

variable "app_connector_vpc_cidr" {
  description = "CIDR block of the Tailscale app connector VPC (for example.com routing)"
  type        = string
  default     = ""
}
