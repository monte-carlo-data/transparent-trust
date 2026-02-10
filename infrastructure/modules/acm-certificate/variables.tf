# ACM Certificate Module Variables

variable "project_name" {
  description = "Project name for resource naming"
  type        = string
}

variable "environment" {
  description = "Environment name (development, production, etc.)"
  type        = string
}

variable "domain_name" {
  description = "Primary domain name for the certificate"
  type        = string
}

variable "subject_alternative_names" {
  description = "Additional domain names to include in the certificate (SANs)"
  type        = list(string)
  default     = []
}

variable "route53_zone_id" {
  description = "Route53 hosted zone ID for DNS validation records"
  type        = string
  default     = ""
}

variable "create_validation_records" {
  description = "Whether to automatically create DNS validation records in Route53"
  type        = bool
  default     = false
}

variable "store_in_ssm" {
  description = "Whether to store the certificate ARN in SSM Parameter Store"
  type        = bool
  default     = true
}

variable "wait_for_validation" {
  description = "Whether to wait for certificate validation to complete (set false if NS delegation not yet configured)"
  type        = bool
  default     = false
}
