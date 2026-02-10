# Outputs for Redis Infrastructure
# Reference: SEC-1057 - Redis caching layer

# =========================================
# ElastiCache Outputs
# =========================================

output "redis_endpoint" {
  description = "Primary endpoint for Redis cluster"
  value       = var.create_elasticache ? aws_elasticache_replication_group.redis[0].primary_endpoint_address : null
}

output "redis_port" {
  description = "Port for Redis cluster"
  value       = var.create_elasticache ? aws_elasticache_replication_group.redis[0].port : null
}

output "redis_reader_endpoint" {
  description = "Reader endpoint for Redis cluster (if using read replicas)"
  value       = var.create_elasticache && var.redis_num_cache_nodes > 1 ? aws_elasticache_replication_group.redis[0].reader_endpoint_address : null
}

output "redis_connection_string" {
  description = "Redis connection string (redis://endpoint:port)"
  value       = var.create_elasticache ? "redis://${aws_elasticache_replication_group.redis[0].primary_endpoint_address}:${aws_elasticache_replication_group.redis[0].port}" : null
}

output "redis_replication_group_id" {
  description = "ID of the Redis replication group"
  value       = var.create_elasticache ? aws_elasticache_replication_group.redis[0].id : null
}

output "redis_arn" {
  description = "ARN of the Redis replication group"
  value       = var.create_elasticache ? aws_elasticache_replication_group.redis[0].arn : null
}

output "redis_security_group_id" {
  description = "ID of the Redis security group"
  value       = var.create_elasticache ? aws_security_group.redis[0].id : null
}

# =========================================
# Auth Token Outputs
# =========================================

output "redis_auth_token_secret_arn" {
  description = "ARN of the Secrets Manager secret containing Redis auth token"
  value       = var.create_elasticache && var.enable_encryption_in_transit && var.store_auth_token_in_secrets_manager ? aws_secretsmanager_secret.redis_auth_token[0].arn : null
  sensitive   = true
}

output "redis_auth_token_secret_name" {
  description = "Name of the Secrets Manager secret containing Redis auth token"
  value       = var.create_elasticache && var.enable_encryption_in_transit && var.store_auth_token_in_secrets_manager ? aws_secretsmanager_secret.redis_auth_token[0].name : null
}

# =========================================
# Upstash Outputs
# =========================================

output "upstash_secret_arn" {
  description = "ARN of the Secrets Manager secret containing Upstash Redis credentials"
  value       = var.use_upstash && var.store_upstash_in_secrets_manager ? aws_secretsmanager_secret.upstash_redis[0].arn : null
  sensitive   = true
}

output "upstash_secret_name" {
  description = "Name of the Secrets Manager secret containing Upstash Redis credentials"
  value       = var.use_upstash && var.store_upstash_in_secrets_manager ? aws_secretsmanager_secret.upstash_redis[0].name : null
}

# =========================================
# Alarm Outputs
# =========================================

output "cpu_alarm_arn" {
  description = "ARN of the CPU utilization alarm"
  value       = var.create_elasticache && var.enable_alarms ? aws_cloudwatch_metric_alarm.redis_cpu[0].arn : null
}

output "memory_alarm_arn" {
  description = "ARN of the memory utilization alarm"
  value       = var.create_elasticache && var.enable_alarms ? aws_cloudwatch_metric_alarm.redis_memory[0].arn : null
}

output "evictions_alarm_arn" {
  description = "ARN of the evictions alarm"
  value       = var.create_elasticache && var.enable_alarms ? aws_cloudwatch_metric_alarm.redis_evictions[0].arn : null
}

output "swap_usage_alarm_arn" {
  description = "ARN of the swap usage alarm"
  value       = var.create_elasticache && var.enable_alarms ? aws_cloudwatch_metric_alarm.redis_swap_usage[0].arn : null
}

# =========================================
# Deployment Information
# =========================================

output "deployment_info" {
  description = "Summary of Redis deployment configuration"
  value = {
    type = var.create_elasticache ? "elasticache" : (var.use_upstash ? "upstash" : "none")

    # ElastiCache info
    elasticache_endpoint       = var.create_elasticache ? aws_elasticache_replication_group.redis[0].primary_endpoint_address : null
    elasticache_port           = var.create_elasticache ? aws_elasticache_replication_group.redis[0].port : null
    elasticache_node_type      = var.create_elasticache ? var.redis_node_type : null
    elasticache_num_nodes      = var.create_elasticache ? var.redis_num_cache_nodes : null
    elasticache_engine_version = var.create_elasticache ? var.redis_engine_version : null
    encryption_at_rest         = var.create_elasticache ? var.enable_encryption_at_rest : null
    encryption_in_transit      = var.create_elasticache ? var.enable_encryption_in_transit : null

    # Upstash info
    upstash_enabled = var.use_upstash

    environment = var.environment
  }
}

# =========================================
# Application Configuration
# =========================================

output "app_environment_variables" {
  description = "Environment variables for application configuration"
  value = var.create_elasticache ? {
    # For ElastiCache Redis
    REDIS_HOST = aws_elasticache_replication_group.redis[0].primary_endpoint_address
    REDIS_PORT = tostring(aws_elasticache_replication_group.redis[0].port)
    REDIS_TLS  = var.enable_encryption_in_transit ? "true" : "false"
    } : (var.use_upstash ? {
      # For Upstash Redis - these should come from Secrets Manager
      # UPSTASH_REDIS_REST_URL   = "from-secrets-manager"
      # UPSTASH_REDIS_REST_TOKEN = "from-secrets-manager"
  } : {})
}

# =========================================
# Useful Commands
# =========================================

output "useful_commands" {
  description = "Useful commands for managing Redis"
  value = var.create_elasticache ? {
    describe_cluster = "aws elasticache describe-replication-groups --replication-group-id ${aws_elasticache_replication_group.redis[0].id}"
    view_metrics     = "aws cloudwatch get-metric-statistics --namespace AWS/ElastiCache --metric-name CPUUtilization --dimensions Name=ReplicationGroupId,Value=${aws_elasticache_replication_group.redis[0].id} --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) --end-time $(date -u +%Y-%m-%dT%H:%M:%S) --period 300 --statistics Average"
    get_auth_token   = var.enable_encryption_in_transit && var.store_auth_token_in_secrets_manager ? "aws secretsmanager get-secret-value --secret-id ${aws_secretsmanager_secret.redis_auth_token[0].name} --query SecretString --output text" : "N/A"
    test_connection  = var.enable_encryption_in_transit ? "redis-cli -h ${aws_elasticache_replication_group.redis[0].primary_endpoint_address} -p ${aws_elasticache_replication_group.redis[0].port} --tls --askpass ping" : "redis-cli -h ${aws_elasticache_replication_group.redis[0].primary_endpoint_address} -p ${aws_elasticache_replication_group.redis[0].port} ping"
  } : {}
}

# =========================================
# Cost Estimate
# =========================================

output "estimated_monthly_cost" {
  description = "Estimated monthly cost in USD (us-east-1 pricing)"
  value = var.create_elasticache ? {
    node_cost_per_month = var.redis_node_type == "cache.t4g.micro" ? 11.5 : (
      var.redis_node_type == "cache.t3.micro" ? 12.5 : (
        var.redis_node_type == "cache.t4g.small" ? 23 : (
          var.redis_node_type == "cache.t3.small" ? 25 : "See AWS pricing"
        )
      )
    )
    number_of_nodes = var.redis_num_cache_nodes
    total_monthly_cost = var.redis_node_type == "cache.t4g.micro" ? 11.5 * var.redis_num_cache_nodes : (
      var.redis_node_type == "cache.t3.micro" ? 12.5 * var.redis_num_cache_nodes : (
        var.redis_node_type == "cache.t4g.small" ? 23 * var.redis_num_cache_nodes : (
          var.redis_node_type == "cache.t3.small" ? 25 * var.redis_num_cache_nodes : "See AWS pricing"
        )
      )
    )
    backup_storage = "First 20 GB free, then ~$0.085/GB/month"
    data_transfer  = "First 1 GB free, then $0.09/GB"
    } : (var.use_upstash ? {
      note      = "Upstash pricing varies by usage. See https://upstash.com/pricing"
      free_tier = "10,000 commands/day free"
  } : null)
}
