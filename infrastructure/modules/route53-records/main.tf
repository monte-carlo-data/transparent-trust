# Route53 DNS Records Module
# Creates A records (alias) pointing to ALB

terraform {
  required_providers {
    aws = {
      source                = "hashicorp/aws"
      version               = ">= 5.0"
      configuration_aliases = [aws.route53]
    }
  }
}

# A record (alias) for the application domain
# Uses aws.route53 provider passed from parent module
resource "aws_route53_record" "main" {
  count = var.create_record ? 1 : 0

  provider = aws.route53

  zone_id = var.hosted_zone_id
  name    = var.domain_name
  type    = "A"

  alias {
    name                   = var.alb_dns_name
    zone_id                = var.alb_zone_id
    evaluate_target_health = var.evaluate_target_health
  }
}

# Optional: AAAA record for IPv6
resource "aws_route53_record" "ipv6" {
  count = var.create_record && var.enable_ipv6 ? 1 : 0

  provider = aws.route53

  zone_id = var.hosted_zone_id
  name    = var.domain_name
  type    = "AAAA"

  alias {
    name                   = var.alb_dns_name
    zone_id                = var.alb_zone_id
    evaluate_target_health = var.evaluate_target_health
  }
}

# Optional: Create Route53 health check
resource "aws_route53_health_check" "main" {
  count = var.create_health_check ? 1 : 0

  fqdn              = var.domain_name
  port              = 443
  type              = "HTTPS"
  resource_path     = var.health_check_path
  failure_threshold = var.health_check_failure_threshold
  request_interval  = var.health_check_interval

  tags = {
    Name        = "${var.project_name}-health-check-${var.environment}"
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

# CloudWatch alarm for health check failures
resource "aws_cloudwatch_metric_alarm" "health_check" {
  count = var.create_health_check && var.create_health_check_alarm ? 1 : 0

  alarm_name          = "${var.project_name}-route53-health-${var.environment}"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "HealthCheckStatus"
  namespace           = "AWS/Route53"
  period              = "60"
  statistic           = "Minimum"
  threshold           = "1"
  alarm_description   = "Route53 health check failed for ${var.domain_name}"
  treat_missing_data  = "breaching"

  dimensions = {
    HealthCheckId = aws_route53_health_check.main[0].id
  }

  alarm_actions = var.alarm_actions
}
