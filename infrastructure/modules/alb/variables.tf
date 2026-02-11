# Variables for ALB module
# Reference: SEC-1052 - Application Load Balancer

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

variable "app_port" {
  description = "Port the application listens on"
  type        = number
  default     = 3000
}

variable "enable_deletion_protection" {
  description = "Whether to enable deletion protection on the ALB"
  type        = bool
  default     = true
}

variable "enable_https" {
  description = "Whether to enable HTTPS listener (requires certificate_arn)"
  type        = bool
  default     = true
}

variable "enable_http_redirect" {
  description = "Whether to redirect HTTP to HTTPS"
  type        = bool
  default     = true
}

variable "certificate_arn" {
  description = "ARN of ACM certificate for HTTPS listener"
  type        = string
  default     = ""
}

variable "additional_certificate_arns" {
  description = "Additional ACM certificate ARNs for multi-domain support"
  type        = list(string)
  default     = []
}

variable "ssl_policy" {
  description = "SSL policy for HTTPS listener"
  type        = string
  default     = "ELBSecurityPolicy-TLS13-1-2-2021-06"
}

# Health Check Configuration
variable "health_check_path" {
  description = "Path for health check"
  type        = string
  default     = "/api/health"
}

variable "health_check_interval" {
  description = "Health check interval in seconds"
  type        = number
  default     = 30
}

variable "health_check_timeout" {
  description = "Health check timeout in seconds"
  type        = number
  default     = 5
}

variable "health_check_healthy_threshold" {
  description = "Number of consecutive health check successes required"
  type        = number
  default     = 2
}

variable "health_check_unhealthy_threshold" {
  description = "Number of consecutive health check failures required"
  type        = number
  default     = 3
}

variable "health_check_matcher" {
  description = "HTTP status codes to consider healthy"
  type        = string
  default     = "200"
}

variable "deregistration_delay" {
  description = "Time to wait before deregistering a target (seconds)"
  type        = number
  default     = 30
}

# Stickiness Configuration
variable "enable_stickiness" {
  description = "Whether to enable session stickiness"
  type        = bool
  default     = false
}

variable "stickiness_duration" {
  description = "Stickiness duration in seconds"
  type        = number
  default     = 86400 # 24 hours
}

# Access Logs
variable "enable_access_logs" {
  description = "Whether to enable ALB access logs to S3"
  type        = bool
  default     = false
}

variable "access_logs_bucket" {
  description = "S3 bucket name for ALB access logs"
  type        = string
  default     = ""
}

variable "access_logs_prefix" {
  description = "S3 bucket prefix for ALB access logs"
  type        = string
  default     = "alb-logs"
}

# CloudWatch Alarms
variable "enable_alb_alarms" {
  description = "Whether to create CloudWatch alarms for ALB"
  type        = bool
  default     = true
}

variable "alarm_sns_topic_arns" {
  description = "List of SNS topic ARNs for alarm notifications"
  type        = list(string)
  default     = []
}

# Connection Timeout Configuration for Long-Running Requests
variable "idle_timeout" {
  description = "Idle timeout in seconds for ALB connections (for long-running requests like skill analysis)"
  type        = number
  default     = 60
}

variable "slow_start" {
  description = "Slow start duration in seconds for targets"
  type        = number
  default     = 0
}
