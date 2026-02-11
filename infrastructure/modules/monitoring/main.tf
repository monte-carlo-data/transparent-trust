# Monitoring Infrastructure for Transparent Trust
# Reference: SEC-1058 - Monitoring & Logging

# This module provides comprehensive monitoring with CloudWatch dashboards,
# alarms, and SNS notifications for all infrastructure components.

# =========================================
# SNS Topics for Alerts
# =========================================

resource "aws_sns_topic" "critical_alerts" {
  name         = "${var.project_name}-critical-alerts-${var.environment}"
  display_name = "Critical alerts for ${var.project_name} (${var.environment})"

  kms_master_key_id = var.enable_sns_encryption ? (var.sns_kms_key_id != "" ? var.sns_kms_key_id : "alias/aws/sns") : null

  tags = merge(var.tags, {
    Name        = "${var.project_name}-critical-alerts-${var.environment}"
    Environment = var.environment
    Severity    = "critical"
  })
}

resource "aws_sns_topic" "warning_alerts" {
  name         = "${var.project_name}-warning-alerts-${var.environment}"
  display_name = "Warning alerts for ${var.project_name} (${var.environment})"

  kms_master_key_id = var.enable_sns_encryption ? (var.sns_kms_key_id != "" ? var.sns_kms_key_id : "alias/aws/sns") : null

  tags = merge(var.tags, {
    Name        = "${var.project_name}-warning-alerts-${var.environment}"
    Environment = var.environment
    Severity    = "warning"
  })
}

# Email subscriptions for critical alerts
resource "aws_sns_topic_subscription" "critical_email" {
  for_each = toset(var.critical_alert_emails)

  topic_arn = aws_sns_topic.critical_alerts.arn
  protocol  = "email"
  endpoint  = each.value
}

# Email subscriptions for warning alerts
resource "aws_sns_topic_subscription" "warning_email" {
  for_each = toset(var.warning_alert_emails)

  topic_arn = aws_sns_topic.warning_alerts.arn
  protocol  = "email"
  endpoint  = each.value
}

# Slack webhook subscription (if provided)
resource "aws_sns_topic_subscription" "critical_slack" {
  count = var.slack_webhook_url_critical != "" ? 1 : 0

  topic_arn = aws_sns_topic.critical_alerts.arn
  protocol  = "https"
  endpoint  = var.slack_webhook_url_critical
}

resource "aws_sns_topic_subscription" "warning_slack" {
  count = var.slack_webhook_url_warning != "" ? 1 : 0

  topic_arn = aws_sns_topic.warning_alerts.arn
  protocol  = "https"
  endpoint  = var.slack_webhook_url_warning
}

# =========================================
# CloudWatch Dashboard
# =========================================

resource "aws_cloudwatch_dashboard" "main" {
  dashboard_name = "${var.project_name}-${var.environment}"

  dashboard_body = jsonencode({
    widgets = concat(
      # Application metrics
      var.ecs_cluster_name != "" ? [
        {
          type = "metric"
          properties = {
            metrics = [
              ["AWS/ECS", "CPUUtilization", { stat = "Average", label = "ECS CPU" }],
              [".", "MemoryUtilization", { stat = "Average", label = "ECS Memory" }]
            ]
            view   = "timeSeries"
            region = var.aws_region
            title  = "ECS Metrics"
            period = 300
            yAxis = {
              left = { min = 0, max = 100 }
            }
          }
          width  = 12
          height = 6
          x      = 0
          y      = 0
        }
      ] : [],

      # RDS metrics
      var.rds_instance_id != "" ? [
        {
          type = "metric"
          properties = {
            metrics = [
              ["AWS/RDS", "CPUUtilization", { "DBInstanceIdentifier" = var.rds_instance_id, stat = "Average", label = "RDS CPU" }],
              [".", "DatabaseConnections", { "DBInstanceIdentifier" = var.rds_instance_id, stat = "Average", label = "Connections" }]
            ]
            view   = "timeSeries"
            region = var.aws_region
            title  = "RDS Metrics"
            period = 300
          }
          width  = 12
          height = 6
          x      = 12
          y      = 0
        }
      ] : [],

      # Redis metrics
      var.redis_replication_group_id != "" ? [
        {
          type = "metric"
          properties = {
            metrics = [
              ["AWS/ElastiCache", "CPUUtilization", { "ReplicationGroupId" = var.redis_replication_group_id, stat = "Average" }],
              [".", "DatabaseMemoryUsagePercentage", { "ReplicationGroupId" = var.redis_replication_group_id, stat = "Average" }]
            ]
            view   = "timeSeries"
            region = var.aws_region
            title  = "Redis Metrics"
            period = 300
          }
          width  = 12
          height = 6
          x      = 0
          y      = 6
        }
      ] : [],

      # ALB metrics
      var.alb_arn_suffix != "" ? [
        {
          type = "metric"
          properties = {
            metrics = [
              ["AWS/ApplicationELB", "TargetResponseTime", { "LoadBalancer" = var.alb_arn_suffix, stat = "Average", label = "Response Time" }],
              [".", "HTTPCode_Target_5XX_Count", { "LoadBalancer" = var.alb_arn_suffix, stat = "Sum", label = "5XX Errors" }],
              [".", "RequestCount", { "LoadBalancer" = var.alb_arn_suffix, stat = "Sum", label = "Requests" }]
            ]
            view   = "timeSeries"
            region = var.aws_region
            title  = "ALB Metrics"
            period = 300
          }
          width  = 12
          height = 6
          x      = 12
          y      = 6
        }
      ] : []
    )
  })
}

# =========================================
# Application-Level Alarms
# =========================================

# High error rate alarm
resource "aws_cloudwatch_metric_alarm" "high_error_rate" {
  count = var.create_app_alarms ? 1 : 0

  alarm_name          = "${var.project_name}-high-error-rate-${var.environment}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "HTTPCode_Target_5XX_Count"
  namespace           = "AWS/ApplicationELB"
  period              = "300"
  statistic           = "Sum"
  threshold           = var.error_rate_threshold
  alarm_description   = "High error rate detected"
  alarm_actions       = [aws_sns_topic.critical_alerts.arn]
  ok_actions          = [aws_sns_topic.critical_alerts.arn]

  dimensions = {
    LoadBalancer = var.alb_arn_suffix
  }

  tags = merge(var.tags, {
    Name        = "${var.project_name}-high-error-rate-${var.environment}"
    Environment = var.environment
  })
}

# High response time alarm
resource "aws_cloudwatch_metric_alarm" "high_response_time" {
  count = var.create_app_alarms ? 1 : 0

  alarm_name          = "${var.project_name}-high-response-time-${var.environment}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "3"
  metric_name         = "TargetResponseTime"
  namespace           = "AWS/ApplicationELB"
  period              = "300"
  statistic           = "Average"
  threshold           = var.response_time_threshold
  alarm_description   = "High response time detected"
  alarm_actions       = [aws_sns_topic.warning_alerts.arn]
  ok_actions          = [aws_sns_topic.warning_alerts.arn]

  dimensions = {
    LoadBalancer = var.alb_arn_suffix
  }

  tags = merge(var.tags, {
    Name        = "${var.project_name}-high-response-time-${var.environment}"
    Environment = var.environment
  })
}

# =========================================
# Database Alarms
# =========================================

# High database CPU
resource "aws_cloudwatch_metric_alarm" "rds_high_cpu" {
  count = var.create_db_alarms ? 1 : 0

  alarm_name          = "${var.project_name}-rds-high-cpu-${var.environment}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "CPUUtilization"
  namespace           = "AWS/RDS"
  period              = "300"
  statistic           = "Average"
  threshold           = var.rds_cpu_threshold
  alarm_description   = "RDS CPU utilization is high"
  alarm_actions       = [aws_sns_topic.warning_alerts.arn]

  dimensions = {
    DBInstanceIdentifier = var.rds_instance_id
  }

  tags = merge(var.tags, {
    Name        = "${var.project_name}-rds-high-cpu-${var.environment}"
    Environment = var.environment
  })
}

# High database connections
resource "aws_cloudwatch_metric_alarm" "rds_high_connections" {
  count = var.create_db_alarms ? 1 : 0

  alarm_name          = "${var.project_name}-rds-high-connections-${var.environment}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "DatabaseConnections"
  namespace           = "AWS/RDS"
  period              = "300"
  statistic           = "Average"
  threshold           = var.rds_connections_threshold
  alarm_description   = "RDS connection count is high"
  alarm_actions       = [aws_sns_topic.warning_alerts.arn]

  dimensions = {
    DBInstanceIdentifier = var.rds_instance_id
  }

  tags = merge(var.tags, {
    Name        = "${var.project_name}-rds-high-connections-${var.environment}"
    Environment = var.environment
  })
}

# Low database storage
resource "aws_cloudwatch_metric_alarm" "rds_low_storage" {
  count = var.create_db_alarms ? 1 : 0

  alarm_name          = "${var.project_name}-rds-low-storage-${var.environment}"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "FreeStorageSpace"
  namespace           = "AWS/RDS"
  period              = "300"
  statistic           = "Average"
  threshold           = var.rds_storage_threshold_bytes
  alarm_description   = "RDS free storage space is low"
  alarm_actions       = [aws_sns_topic.critical_alerts.arn]

  dimensions = {
    DBInstanceIdentifier = var.rds_instance_id
  }

  tags = merge(var.tags, {
    Name        = "${var.project_name}-rds-low-storage-${var.environment}"
    Environment = var.environment
  })
}

# =========================================
# Log Insights Queries
# =========================================

resource "aws_cloudwatch_query_definition" "error_logs" {
  count = var.create_log_insights_queries && var.log_group_name != "" ? 1 : 0

  name = "${var.project_name}-error-logs-${var.environment}"

  log_group_names = [var.log_group_name]

  query_string = <<-QUERY
    fields @timestamp, @message
    | filter @message like /ERROR|Error|error/
    | sort @timestamp desc
    | limit 100
  QUERY
}

resource "aws_cloudwatch_query_definition" "slow_requests" {
  count = var.create_log_insights_queries && var.log_group_name != "" ? 1 : 0

  name = "${var.project_name}-slow-requests-${var.environment}"

  log_group_names = [var.log_group_name]

  query_string = <<-QUERY
    fields @timestamp, @message
    | filter @message like /duration/
    | parse @message /duration=(?<duration>\d+)/
    | filter duration > 1000
    | sort duration desc
    | limit 50
  QUERY
}

# =========================================
# Composite Alarm for Service Health
# =========================================

resource "aws_cloudwatch_composite_alarm" "service_unhealthy" {
  count = var.create_composite_alarms && var.create_app_alarms ? 1 : 0

  alarm_name        = "${var.project_name}-service-unhealthy-${var.environment}"
  alarm_description = "Service is unhealthy (multiple metrics in alarm state)"
  actions_enabled   = true
  alarm_actions     = [aws_sns_topic.critical_alerts.arn]
  ok_actions        = [aws_sns_topic.critical_alerts.arn]

  alarm_rule = "ALARM(${aws_cloudwatch_metric_alarm.high_error_rate[0].alarm_name}) OR ALARM(${aws_cloudwatch_metric_alarm.high_response_time[0].alarm_name})"

  tags = merge(var.tags, {
    Name        = "${var.project_name}-service-unhealthy-${var.environment}"
    Environment = var.environment
  })
}
