# Variables for Bastion Host module

variable "project_name" {
  description = "Name of the project"
  type        = string
}

variable "environment" {
  description = "Environment name (e.g., development, production)"
  type        = string
}

variable "vpc_id" {
  description = "ID of the VPC"
  type        = string
}

variable "subnet_id" {
  description = "Subnet ID for the bastion host (should be a private subnet with NAT Gateway access)"
  type        = string
}

variable "instance_type" {
  description = "EC2 instance type for the bastion"
  type        = string
  default     = "t3.micro"
}

variable "enable_detailed_monitoring" {
  description = "Enable detailed CloudWatch monitoring"
  type        = bool
  default     = false
}

variable "tags" {
  description = "Additional tags to apply to resources"
  type        = map(string)
  default     = {}
}

# =========================================
# Tailscale Configuration
# =========================================

variable "tailscale_auth_key_secret_arn" {
  description = "ARN of the Secrets Manager secret containing the Tailscale auth key. Secret should contain JSON with 'authKey' field."
  type        = string
  default     = ""
}

variable "tailscale_hostname" {
  description = "Hostname for this bastion in Tailscale (e.g., 'bastion-dev')"
  type        = string
  default     = ""
}

variable "tailscale_tags" {
  description = "Tailscale ACL tags for this bastion (e.g., 'tag:bastion,tag:dev')"
  type        = string
  default     = "tag:bastion"
}

variable "aws_region" {
  description = "AWS region (used for Secrets Manager API calls)"
  type        = string
  default     = "us-east-1"
}
