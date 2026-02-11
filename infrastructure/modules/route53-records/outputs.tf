# Route53 Records Module Outputs

output "record_name" {
  description = "Name of the created DNS record"
  value       = var.create_record ? aws_route53_record.main[0].name : null
}

output "record_fqdn" {
  description = "FQDN of the created DNS record"
  value       = var.create_record ? aws_route53_record.main[0].fqdn : null
}

output "health_check_id" {
  description = "ID of the Route53 health check"
  value       = var.create_health_check ? aws_route53_health_check.main[0].id : null
}

output "health_check_alarm_arn" {
  description = "ARN of the health check CloudWatch alarm"
  value       = var.create_health_check && var.create_health_check_alarm ? aws_cloudwatch_metric_alarm.health_check[0].arn : null
}
