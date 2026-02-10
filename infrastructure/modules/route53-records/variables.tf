# Route53 Records Module Variables

variable "project_name" {
  description = "Project name for resource naming"
  type        = string
}

variable "environment" {
  description = "Environment name (development, production, etc.)"
  type        = string
}

variable "domain_name" {
  description = "Domain name for the A record"
  type        = string
}

variable "hosted_zone_id" {
  description = "Route53 hosted zone ID"
  type        = string
}

variable "alb_dns_name" {
  description = "ALB DNS name to point the A record to"
  type        = string
}

variable "alb_zone_id" {
  description = "ALB hosted zone ID"
  type        = string
}

variable "create_record" {
  description = "Whether to create the Route53 record"
  type        = bool
  default     = true
}

variable "evaluate_target_health" {
  description = "Whether to evaluate target health for the alias record"
  type        = bool
  default     = true
}

variable "enable_ipv6" {
  description = "Whether to create AAAA record for IPv6"
  type        = bool
  default     = false
}

variable "create_health_check" {
  description = "Whether to create Route53 health check"
  type        = bool
  default     = false
}

variable "health_check_path" {
  description = "Path for health check"
  type        = string
  default     = "/api/health"
}

variable "health_check_failure_threshold" {
  description = "Number of consecutive health check failures before considering unhealthy"
  type        = number
  default     = 3
}

variable "health_check_interval" {
  description = "Health check interval in seconds (10 or 30)"
  type        = number
  default     = 30
}

variable "create_health_check_alarm" {
  description = "Whether to create CloudWatch alarm for health check"
  type        = bool
  default     = false
}

variable "alarm_actions" {
  description = "List of SNS topic ARNs for health check alarms"
  type        = list(string)
  default     = []
}
