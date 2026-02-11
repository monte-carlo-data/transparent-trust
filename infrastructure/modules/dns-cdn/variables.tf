# Variables for DNS & CDN Infrastructure
# Reference: SEC-1059

# =========================================
# General Configuration
# =========================================

variable "project_name" {
  description = "Name of the project (used in resource naming)"
  type        = string
  default     = "transparent-trust"
}

variable "environment" {
  description = "Environment name (e.g., production, staging, dev)"
  type        = string
  default     = "production"
}

variable "aws_region" {
  description = "AWS region for resources"
  type        = string
  default     = "us-east-1"
}

variable "tags" {
  description = "Additional tags to apply to resources"
  type        = map(string)
  default     = {}
}

# =========================================
# Route 53 Configuration
# =========================================

variable "domain_name" {
  description = "Primary domain name (e.g., transparenttrust.com)"
  type        = string
}

variable "create_hosted_zone" {
  description = "Whether to create a new hosted zone (false to use existing)"
  type        = bool
  default     = false
}

variable "include_wildcard" {
  description = "Include wildcard subdomain in ACM certificate (*.domain.com)"
  type        = bool
  default     = true
}

# =========================================
# Origin Configuration
# =========================================

variable "alb_dns_name" {
  description = "DNS name of the Application Load Balancer (for direct ALB routing)"
  type        = string
  default     = ""
}

variable "alb_zone_id" {
  description = "Hosted zone ID of the ALB (for Route 53 alias)"
  type        = string
  default     = ""
}

variable "origin_domain_name" {
  description = "Domain name of the origin (ALB or custom origin for CloudFront)"
  type        = string
  default     = ""
}

# =========================================
# CloudFront Configuration
# =========================================

variable "enable_cloudfront" {
  description = "Enable CloudFront CDN distribution"
  type        = bool
  default     = false
}

variable "cloudfront_price_class" {
  description = "CloudFront price class (PriceClass_All, PriceClass_200, PriceClass_100)"
  type        = string
  default     = "PriceClass_100"
  validation {
    condition     = contains(["PriceClass_All", "PriceClass_200", "PriceClass_100"], var.cloudfront_price_class)
    error_message = "Price class must be PriceClass_All, PriceClass_200, or PriceClass_100"
  }
}

variable "cloudfront_default_root_object" {
  description = "Default root object for CloudFront"
  type        = string
  default     = ""
}

variable "cloudfront_allowed_methods" {
  description = "HTTP methods allowed by CloudFront"
  type        = list(string)
  default     = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
}

variable "cloudfront_forwarded_headers" {
  description = "Headers to forward to origin"
  type        = list(string)
  default     = ["Host", "Accept", "Accept-Language", "Authorization"]
}

variable "cloudfront_min_ttl" {
  description = "Minimum TTL for CloudFront cache (seconds)"
  type        = number
  default     = 0
}

variable "cloudfront_default_ttl" {
  description = "Default TTL for CloudFront cache (seconds)"
  type        = number
  default     = 3600
}

variable "cloudfront_max_ttl" {
  description = "Maximum TTL for CloudFront cache (seconds)"
  type        = number
  default     = 86400
}

variable "enable_static_cache" {
  description = "Enable aggressive caching for static assets (_next/static/*)"
  type        = bool
  default     = true
}

variable "cloudfront_custom_header_value" {
  description = "Custom header value to verify requests from CloudFront"
  type        = string
  default     = ""
  sensitive   = true
}

variable "cloudfront_custom_error_responses" {
  description = "Custom error response configurations"
  type = list(object({
    error_code            = number
    response_code         = number
    response_page_path    = string
    error_caching_min_ttl = number
  }))
  default = [
    {
      error_code            = 404
      response_code         = 404
      response_page_path    = "/404"
      error_caching_min_ttl = 300
    },
    {
      error_code            = 500
      response_code         = 500
      response_page_path    = "/500"
      error_caching_min_ttl = 60
    }
  ]
}

variable "cloudfront_geo_restriction_type" {
  description = "Geo restriction type (none, whitelist, blacklist)"
  type        = string
  default     = "none"
  validation {
    condition     = contains(["none", "whitelist", "blacklist"], var.cloudfront_geo_restriction_type)
    error_message = "Geo restriction type must be none, whitelist, or blacklist"
  }
}

variable "cloudfront_geo_restriction_locations" {
  description = "List of country codes for geo restriction"
  type        = list(string)
  default     = []
}

variable "cloudfront_logging_bucket" {
  description = "S3 bucket for CloudFront access logs (e.g., mybucket.s3.amazonaws.com)"
  type        = string
  default     = ""
}

# =========================================
# Health Check Configuration
# =========================================

variable "create_health_check" {
  description = "Create Route 53 health check"
  type        = bool
  default     = true
}

variable "health_check_path" {
  description = "Path for health check endpoint"
  type        = string
  default     = "/api/health"
}

variable "health_check_failure_threshold" {
  description = "Number of consecutive failures before marking unhealthy"
  type        = number
  default     = 3
}

variable "health_check_interval" {
  description = "Health check interval in seconds (10 or 30)"
  type        = number
  default     = 30
  validation {
    condition     = contains([10, 30], var.health_check_interval)
    error_message = "Health check interval must be 10 or 30 seconds"
  }
}

variable "health_check_alarm_actions" {
  description = "SNS topic ARNs to notify when health check fails"
  type        = list(string)
  default     = []
}

# =========================================
# WAF Configuration
# =========================================

variable "enable_waf" {
  description = "Enable AWS WAF for CloudFront"
  type        = bool
  default     = false
}

variable "waf_rate_limit" {
  description = "Rate limit (requests per 5 minutes per IP). 0 to disable"
  type        = number
  default     = 2000
}

# =========================================
# IPv6 Configuration
# =========================================

variable "enable_ipv6" {
  description = "Enable IPv6 support (AAAA records)"
  type        = bool
  default     = true
}
