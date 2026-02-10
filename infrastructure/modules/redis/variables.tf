# Variables for Redis Infrastructure
# Reference: SEC-1057 - Redis caching layer

# =========================================
# General Configuration
# =========================================

variable "project_name" {
  description = "Name of the project (used for resource naming)"
  type        = string
  default     = "transparent-trust"
}

variable "environment" {
  description = "Environment name (e.g., production, staging, development)"
  type        = string
  default     = "production"
}

variable "tags" {
  description = "Additional tags to apply to all resources"
  type        = map(string)
  default = {
    Project   = "transparent-trust"
    ManagedBy = "terraform"
    Component = "redis"
  }
}

# =========================================
# Deployment Choice
# =========================================

variable "create_elasticache" {
  description = "Create AWS ElastiCache Redis cluster (set to false if using Upstash)"
  type        = bool
  default     = true
}

variable "use_upstash" {
  description = "Using Upstash Redis (serverless, no AWS infrastructure needed)"
  type        = bool
  default     = false
}

# =========================================
# Networking
# =========================================

variable "vpc_id" {
  description = "ID of the VPC where Redis will be deployed"
  type        = string
  default     = ""
}

variable "private_subnet_ids" {
  description = "List of private subnet IDs for Redis cluster"
  type        = list(string)
  default     = []
}

variable "app_security_group_ids" {
  description = "List of application security group IDs that need Redis access"
  type        = list(string)
  default     = []
}

# =========================================
# ElastiCache Configuration
# =========================================

variable "redis_node_type" {
  description = "Instance type for Redis nodes (e.g., cache.t3.micro, cache.t4g.micro)"
  type        = string
  default     = "cache.t4g.micro"
}

variable "redis_engine_version" {
  description = "Redis engine version"
  type        = string
  default     = "7.1"
}

variable "redis_family" {
  description = "Redis parameter group family"
  type        = string
  default     = "redis7"
}

variable "redis_port" {
  description = "Port for Redis"
  type        = number
  default     = 6379
}

variable "redis_num_cache_nodes" {
  description = "Number of cache nodes (>1 enables automatic failover)"
  type        = number
  default     = 2

  validation {
    condition     = var.redis_num_cache_nodes >= 1 && var.redis_num_cache_nodes <= 6
    error_message = "Number of cache nodes must be between 1 and 6."
  }
}

variable "redis_parameters" {
  description = "Redis parameter group parameters"
  type = list(object({
    name  = string
    value = string
  }))
  default = [
    {
      name  = "maxmemory-policy"
      value = "allkeys-lru" # Evict any key using LRU when memory limit reached
    },
    {
      name  = "timeout"
      value = "300" # Close connection after 300s of idleness
    }
  ]
}

# =========================================
# Encryption
# =========================================

variable "enable_encryption_at_rest" {
  description = "Enable encryption at rest for Redis"
  type        = bool
  default     = true
}

variable "enable_encryption_in_transit" {
  description = "Enable encryption in transit (TLS) for Redis"
  type        = bool
  default     = true
}

variable "store_auth_token_in_secrets_manager" {
  description = "Store Redis auth token in Secrets Manager"
  type        = bool
  default     = true
}

# =========================================
# Backup and Maintenance
# =========================================

variable "snapshot_retention_limit" {
  description = "Number of days to retain automatic snapshots (0 to disable)"
  type        = number
  default     = 7

  validation {
    condition     = var.snapshot_retention_limit >= 0 && var.snapshot_retention_limit <= 35
    error_message = "Snapshot retention limit must be between 0 and 35 days."
  }
}

variable "snapshot_window" {
  description = "Daily time range for automatic snapshots (UTC)"
  type        = string
  default     = "03:00-05:00"
}

variable "maintenance_window" {
  description = "Weekly time range for maintenance (UTC)"
  type        = string
  default     = "sun:05:00-sun:07:00"
}

variable "auto_minor_version_upgrade" {
  description = "Automatically upgrade to new minor versions"
  type        = bool
  default     = true
}

variable "apply_immediately" {
  description = "Apply changes immediately (use with caution in production)"
  type        = bool
  default     = false
}

# =========================================
# Monitoring & Alarms
# =========================================

variable "enable_alarms" {
  description = "Enable CloudWatch alarms for Redis"
  type        = bool
  default     = true
}

variable "alarm_sns_topic_arn" {
  description = "ARN of SNS topic for alarm notifications"
  type        = string
  default     = ""
}

variable "cpu_alarm_threshold" {
  description = "CPU utilization threshold for alarms (percentage)"
  type        = number
  default     = 75
}

variable "memory_alarm_threshold" {
  description = "Memory utilization threshold for alarms (percentage)"
  type        = number
  default     = 90
}

variable "evictions_alarm_threshold" {
  description = "Number of evictions to trigger alarm"
  type        = number
  default     = 1000
}

variable "swap_usage_alarm_threshold" {
  description = "Swap usage threshold in bytes (indicates memory pressure)"
  type        = number
  default     = 50000000 # 50 MB
}

# =========================================
# Notifications
# =========================================

variable "sns_topic_arn" {
  description = "ARN of SNS topic for ElastiCache notifications"
  type        = string
  default     = ""
}

# =========================================
# Secrets Manager
# =========================================

variable "secret_recovery_window_days" {
  description = "Number of days to retain deleted secrets before permanent deletion"
  type        = number
  default     = 30
}

# =========================================
# Upstash Configuration (if using Upstash)
# =========================================

variable "store_upstash_in_secrets_manager" {
  description = "Store Upstash Redis credentials in Secrets Manager"
  type        = bool
  default     = true
}

variable "upstash_redis_url" {
  description = "Upstash Redis REST URL (if using Upstash)"
  type        = string
  default     = ""
  sensitive   = true
}

variable "upstash_redis_token" {
  description = "Upstash Redis REST token (if using Upstash)"
  type        = string
  default     = ""
  sensitive   = true
}
