# Outputs for Monitoring Infrastructure
# Reference: SEC-1058 - Monitoring & Logging

output "critical_alerts_topic_arn" {
  description = "ARN of the critical alerts SNS topic"
  value       = aws_sns_topic.critical_alerts.arn
}

output "warning_alerts_topic_arn" {
  description = "ARN of the warning alerts SNS topic"
  value       = aws_sns_topic.warning_alerts.arn
}

output "dashboard_name" {
  description = "Name of the CloudWatch dashboard"
  value       = aws_cloudwatch_dashboard.main.dashboard_name
}

output "dashboard_url" {
  description = "URL to view the CloudWatch dashboard"
  value       = "https://console.aws.amazon.com/cloudwatch/home?region=${var.aws_region}#dashboards:name=${aws_cloudwatch_dashboard.main.dashboard_name}"
}

output "alarms_created" {
  description = "List of alarms created"
  value = {
    high_error_rate      = var.create_app_alarms && var.alb_arn_suffix != "" ? aws_cloudwatch_metric_alarm.high_error_rate[0].alarm_name : null
    high_response_time   = var.create_app_alarms && var.alb_arn_suffix != "" ? aws_cloudwatch_metric_alarm.high_response_time[0].alarm_name : null
    rds_high_cpu         = var.create_db_alarms && var.rds_instance_id != "" ? aws_cloudwatch_metric_alarm.rds_high_cpu[0].alarm_name : null
    rds_high_connections = var.create_db_alarms && var.rds_instance_id != "" ? aws_cloudwatch_metric_alarm.rds_high_connections[0].alarm_name : null
    rds_low_storage      = var.create_db_alarms && var.rds_instance_id != "" ? aws_cloudwatch_metric_alarm.rds_low_storage[0].alarm_name : null
  }
}

output "monitoring_summary" {
  description = "Summary of monitoring configuration"
  value = {
    dashboard_name       = aws_cloudwatch_dashboard.main.dashboard_name
    critical_topic       = aws_sns_topic.critical_alerts.name
    warning_topic        = aws_sns_topic.warning_alerts.name
    critical_subscribers = length(var.critical_alert_emails)
    warning_subscribers  = length(var.warning_alert_emails)
    alarms_enabled       = var.create_app_alarms || var.create_db_alarms
    environment          = var.environment
  }
}
