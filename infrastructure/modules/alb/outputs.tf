# Outputs for ALB module
# Reference: SEC-1052 - Application Load Balancer

# ALB
output "alb_id" {
  description = "ID of the Application Load Balancer"
  value       = aws_lb.main.id
}

output "alb_arn" {
  description = "ARN of the Application Load Balancer"
  value       = aws_lb.main.arn
}

output "alb_arn_suffix" {
  description = "ARN suffix for use in CloudWatch metrics"
  value       = aws_lb.main.arn_suffix
}

output "alb_dns_name" {
  description = "DNS name of the Application Load Balancer"
  value       = aws_lb.main.dns_name
}

output "alb_zone_id" {
  description = "Zone ID of the Application Load Balancer (for Route 53)"
  value       = aws_lb.main.zone_id
}

# Target Group
output "target_group_id" {
  description = "ID of the target group"
  value       = aws_lb_target_group.app.id
}

output "target_group_arn" {
  description = "ARN of the target group"
  value       = aws_lb_target_group.app.arn
}

output "target_group_arn_suffix" {
  description = "ARN suffix for use in CloudWatch metrics"
  value       = aws_lb_target_group.app.arn_suffix
}

output "target_group_name" {
  description = "Name of the target group"
  value       = aws_lb_target_group.app.name
}

# Listeners
output "https_listener_arn" {
  description = "ARN of the HTTPS listener (if enabled)"
  value       = var.enable_https ? aws_lb_listener.https[0].arn : null
}

output "http_listener_arn" {
  description = "ARN of the HTTP listener"
  value       = var.enable_http_redirect ? aws_lb_listener.http[0].arn : (var.enable_https ? null : aws_lb_listener.http_only[0].arn)
}

# Alarms
output "unhealthy_targets_alarm_id" {
  description = "ID of the unhealthy targets CloudWatch alarm (if enabled)"
  value       = var.enable_alb_alarms ? aws_cloudwatch_metric_alarm.alb_unhealthy_targets[0].id : null
}

output "high_5xx_alarm_id" {
  description = "ID of the 5xx errors CloudWatch alarm (if enabled)"
  value       = var.enable_alb_alarms ? aws_cloudwatch_metric_alarm.alb_5xx_errors[0].id : null
}

output "high_latency_alarm_id" {
  description = "ID of the high latency CloudWatch alarm (if enabled)"
  value       = var.enable_alb_alarms ? aws_cloudwatch_metric_alarm.alb_high_latency[0].id : null
}

# Summary
output "alb_summary" {
  description = "Summary of ALB configuration"
  value = {
    alb_dns_name        = aws_lb.main.dns_name
    alb_arn             = aws_lb.main.arn
    target_group_arn    = aws_lb_target_group.app.arn
    https_enabled       = var.enable_https
    access_logs_enabled = var.enable_access_logs
    alarms_enabled      = var.enable_alb_alarms
  }
}
