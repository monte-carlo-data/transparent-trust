# Redis Infrastructure for Transparent Trust
# Reference: SEC-1057 - Redis caching layer

# This module provides ElastiCache Redis for caching and rate limiting.
# Note: The application also supports Upstash Redis (serverless, no infrastructure needed)

# =========================================
# ElastiCache Subnet Group
# =========================================

resource "aws_elasticache_subnet_group" "redis" {
  count = var.create_elasticache ? 1 : 0

  name       = "${var.project_name}-redis-subnet-group-${var.environment}"
  subnet_ids = var.private_subnet_ids

  description = "Subnet group for ${var.project_name} Redis cluster"

  tags = merge(var.tags, {
    Name        = "${var.project_name}-redis-subnet-group-${var.environment}"
    Environment = var.environment
  })
}

# =========================================
# ElastiCache Parameter Group
# =========================================

resource "aws_elasticache_parameter_group" "redis" {
  count = var.create_elasticache ? 1 : 0

  name   = "${var.project_name}-redis-params-${var.environment}"
  family = var.redis_family

  description = "Parameter group for ${var.project_name} Redis cluster"

  # Recommended parameters for production
  dynamic "parameter" {
    for_each = var.redis_parameters
    content {
      name  = parameter.value.name
      value = parameter.value.value
    }
  }

  tags = merge(var.tags, {
    Name        = "${var.project_name}-redis-params-${var.environment}"
    Environment = var.environment
  })
}

# =========================================
# Security Group for Redis
# =========================================

resource "aws_security_group" "redis" {
  count = var.create_elasticache ? 1 : 0

  name        = "${var.project_name}-redis-${var.environment}"
  description = "Security group for Redis cluster"
  vpc_id      = var.vpc_id

  # Allow inbound Redis traffic from app security group
  ingress {
    description     = "Redis from application"
    from_port       = var.redis_port
    to_port         = var.redis_port
    protocol        = "tcp"
    security_groups = var.app_security_group_ids
  }

  # Allow all outbound traffic
  egress {
    description = "Allow all outbound"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(var.tags, {
    Name        = "${var.project_name}-redis-sg-${var.environment}"
    Environment = var.environment
  })
}

# =========================================
# ElastiCache Replication Group (Redis)
# =========================================

resource "aws_elasticache_replication_group" "redis" {
  count = var.create_elasticache ? 1 : 0

  replication_group_id = "${var.project_name}-redis-${var.environment}"
  description          = "Redis cluster for ${var.project_name} (${var.environment})"

  # Engine configuration
  engine               = "redis"
  engine_version       = var.redis_engine_version
  port                 = var.redis_port
  parameter_group_name = aws_elasticache_parameter_group.redis[0].name

  # Node configuration
  node_type                  = var.redis_node_type
  num_cache_clusters         = var.redis_num_cache_nodes
  automatic_failover_enabled = var.redis_num_cache_nodes > 1

  # Networking
  subnet_group_name  = aws_elasticache_subnet_group.redis[0].name
  security_group_ids = [aws_security_group.redis[0].id]

  # Encryption
  at_rest_encryption_enabled = var.enable_encryption_at_rest
  transit_encryption_enabled = var.enable_encryption_in_transit
  # auth_token can be set via variable if needed (requires transit encryption)

  # Maintenance and backups
  maintenance_window         = var.maintenance_window
  snapshot_retention_limit   = var.snapshot_retention_limit
  snapshot_window            = var.snapshot_window
  auto_minor_version_upgrade = var.auto_minor_version_upgrade

  # Notifications
  notification_topic_arn = var.sns_topic_arn

  # Apply changes immediately (use with caution in production)
  apply_immediately = var.apply_immediately

  tags = merge(var.tags, {
    Name        = "${var.project_name}-redis-${var.environment}"
    Environment = var.environment
  })
}

# =========================================
# CloudWatch Alarms for Redis
# =========================================

resource "aws_cloudwatch_metric_alarm" "redis_cpu" {
  count = var.create_elasticache && var.enable_alarms ? 1 : 0

  alarm_name          = "${var.project_name}-redis-cpu-${var.environment}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "CPUUtilization"
  namespace           = "AWS/ElastiCache"
  period              = "300"
  statistic           = "Average"
  threshold           = var.cpu_alarm_threshold
  alarm_description   = "Redis cluster CPU utilization"
  alarm_actions       = var.alarm_sns_topic_arn != "" ? [var.alarm_sns_topic_arn] : []

  dimensions = {
    ReplicationGroupId = aws_elasticache_replication_group.redis[0].id
  }

  tags = merge(var.tags, {
    Name        = "${var.project_name}-redis-cpu-alarm-${var.environment}"
    Environment = var.environment
  })
}

resource "aws_cloudwatch_metric_alarm" "redis_memory" {
  count = var.create_elasticache && var.enable_alarms ? 1 : 0

  alarm_name          = "${var.project_name}-redis-memory-${var.environment}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "DatabaseMemoryUsagePercentage"
  namespace           = "AWS/ElastiCache"
  period              = "300"
  statistic           = "Average"
  threshold           = var.memory_alarm_threshold
  alarm_description   = "Redis cluster memory utilization"
  alarm_actions       = var.alarm_sns_topic_arn != "" ? [var.alarm_sns_topic_arn] : []

  dimensions = {
    ReplicationGroupId = aws_elasticache_replication_group.redis[0].id
  }

  tags = merge(var.tags, {
    Name        = "${var.project_name}-redis-memory-alarm-${var.environment}"
    Environment = var.environment
  })
}

resource "aws_cloudwatch_metric_alarm" "redis_evictions" {
  count = var.create_elasticache && var.enable_alarms ? 1 : 0

  alarm_name          = "${var.project_name}-redis-evictions-${var.environment}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "Evictions"
  namespace           = "AWS/ElastiCache"
  period              = "300"
  statistic           = "Sum"
  threshold           = var.evictions_alarm_threshold
  alarm_description   = "Redis cluster evictions (memory pressure)"
  alarm_actions       = var.alarm_sns_topic_arn != "" ? [var.alarm_sns_topic_arn] : []

  dimensions = {
    ReplicationGroupId = aws_elasticache_replication_group.redis[0].id
  }

  tags = merge(var.tags, {
    Name        = "${var.project_name}-redis-evictions-alarm-${var.environment}"
    Environment = var.environment
  })
}

resource "aws_cloudwatch_metric_alarm" "redis_swap_usage" {
  count = var.create_elasticache && var.enable_alarms ? 1 : 0

  alarm_name          = "${var.project_name}-redis-swap-${var.environment}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "SwapUsage"
  namespace           = "AWS/ElastiCache"
  period              = "300"
  statistic           = "Average"
  threshold           = var.swap_usage_alarm_threshold
  alarm_description   = "Redis cluster swap usage (indicates memory pressure)"
  alarm_actions       = var.alarm_sns_topic_arn != "" ? [var.alarm_sns_topic_arn] : []

  dimensions = {
    ReplicationGroupId = aws_elasticache_replication_group.redis[0].id
  }

  tags = merge(var.tags, {
    Name        = "${var.project_name}-redis-swap-alarm-${var.environment}"
    Environment = var.environment
  })
}

# =========================================
# Secrets Manager for Redis Auth Token
# =========================================

resource "random_password" "redis_auth_token" {
  count = var.create_elasticache && var.enable_encryption_in_transit ? 1 : 0

  length  = 32
  special = false # Redis auth token doesn't support special characters
}

resource "aws_secretsmanager_secret" "redis_auth_token" {
  count = var.create_elasticache && var.enable_encryption_in_transit && var.store_auth_token_in_secrets_manager ? 1 : 0

  name        = "${var.project_name}-redis-auth-token-${var.environment}"
  description = "Redis authentication token for ${var.project_name} (${var.environment})"

  recovery_window_in_days = var.secret_recovery_window_days

  tags = merge(var.tags, {
    Name        = "${var.project_name}-redis-auth-${var.environment}"
    Environment = var.environment
  })
}

resource "aws_secretsmanager_secret_version" "redis_auth_token" {
  count = var.create_elasticache && var.enable_encryption_in_transit && var.store_auth_token_in_secrets_manager ? 1 : 0

  secret_id     = aws_secretsmanager_secret.redis_auth_token[0].id
  secret_string = random_password.redis_auth_token[0].result
}

# =========================================
# Redis Connection String (for Upstash)
# =========================================

# Note: If using Upstash Redis, store credentials in Secrets Manager
resource "aws_secretsmanager_secret" "upstash_redis" {
  count = var.use_upstash && var.store_upstash_in_secrets_manager ? 1 : 0

  name        = "${var.project_name}-upstash-redis-${var.environment}"
  description = "Upstash Redis credentials for ${var.project_name} (${var.environment})"

  recovery_window_in_days = var.secret_recovery_window_days

  tags = merge(var.tags, {
    Name        = "${var.project_name}-upstash-redis-${var.environment}"
    Environment = var.environment
  })
}

resource "aws_secretsmanager_secret_version" "upstash_redis" {
  count = var.use_upstash && var.store_upstash_in_secrets_manager ? 1 : 0

  secret_id = aws_secretsmanager_secret.upstash_redis[0].id
  secret_string = jsonencode({
    url   = var.upstash_redis_url
    token = var.upstash_redis_token
  })
}
