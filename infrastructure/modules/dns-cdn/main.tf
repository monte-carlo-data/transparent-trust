# DNS & CDN Infrastructure for Transparent Trust
# Reference: SEC-1059 - DNS & CDN Setup

# This module provides Route 53 DNS, ACM certificates, and optional CloudFront CDN
# for the Transparent Trust application.

# =========================================
# Route 53 Hosted Zone
# =========================================

# Create hosted zone (or use existing)
resource "aws_route53_zone" "main" {
  count = var.create_hosted_zone ? 1 : 0

  name    = var.domain_name
  comment = "Hosted zone for ${var.project_name} (${var.environment})"

  tags = merge(var.tags, {
    Name        = "${var.project_name}-zone-${var.environment}"
    Environment = var.environment
  })
}

# Data source for existing hosted zone
data "aws_route53_zone" "existing" {
  count = var.create_hosted_zone ? 0 : 1

  name         = var.domain_name
  private_zone = false
}

locals {
  zone_id = var.create_hosted_zone ? aws_route53_zone.main[0].zone_id : data.aws_route53_zone.existing[0].zone_id
}

# =========================================
# ACM Certificate
# =========================================

# SSL/TLS certificate for the domain
resource "aws_acm_certificate" "main" {
  domain_name               = var.domain_name
  subject_alternative_names = var.include_wildcard ? ["*.${var.domain_name}"] : []
  validation_method         = "DNS"

  lifecycle {
    create_before_destroy = true
  }

  tags = merge(var.tags, {
    Name        = "${var.project_name}-cert-${var.environment}"
    Environment = var.environment
  })
}

# DNS validation records for ACM certificate
resource "aws_route53_record" "cert_validation" {
  for_each = {
    for dvo in aws_acm_certificate.main.domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  }

  allow_overwrite = true
  name            = each.value.name
  records         = [each.value.record]
  ttl             = 60
  type            = each.value.type
  zone_id         = local.zone_id
}

# Wait for certificate validation
resource "aws_acm_certificate_validation" "main" {
  certificate_arn         = aws_acm_certificate.main.arn
  validation_record_fqdns = [for record in aws_route53_record.cert_validation : record.fqdn]
}

# =========================================
# CloudFront Distribution (Optional)
# =========================================

# CloudFront origin access identity for S3
resource "aws_cloudfront_origin_access_identity" "main" {
  count = var.enable_cloudfront ? 1 : 0

  comment = "Origin access identity for ${var.project_name} (${var.environment})"
}

# CloudFront distribution
resource "aws_cloudfront_distribution" "main" {
  count = var.enable_cloudfront ? 1 : 0

  enabled             = true
  is_ipv6_enabled     = true
  comment             = "${var.project_name} CDN (${var.environment})"
  default_root_object = var.cloudfront_default_root_object
  price_class         = var.cloudfront_price_class
  aliases             = [var.domain_name]

  # Origin configuration (ALB or custom origin)
  origin {
    domain_name = var.origin_domain_name
    origin_id   = "main-origin"

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }

    custom_header {
      name  = "X-Custom-Header"
      value = var.cloudfront_custom_header_value
    }
  }

  # Default cache behavior
  default_cache_behavior {
    allowed_methods  = var.cloudfront_allowed_methods
    cached_methods   = ["GET", "HEAD", "OPTIONS"]
    target_origin_id = "main-origin"

    forwarded_values {
      query_string = true
      headers      = var.cloudfront_forwarded_headers

      cookies {
        forward = "all"
      }
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = var.cloudfront_min_ttl
    default_ttl            = var.cloudfront_default_ttl
    max_ttl                = var.cloudfront_max_ttl
    compress               = true
  }

  # Static assets cache behavior (optional)
  dynamic "ordered_cache_behavior" {
    for_each = var.enable_static_cache ? [1] : []

    content {
      path_pattern     = "/_next/static/*"
      allowed_methods  = ["GET", "HEAD", "OPTIONS"]
      cached_methods   = ["GET", "HEAD", "OPTIONS"]
      target_origin_id = "main-origin"

      forwarded_values {
        query_string = false
        headers      = ["Origin"]

        cookies {
          forward = "none"
        }
      }

      viewer_protocol_policy = "redirect-to-https"
      min_ttl                = 31536000
      default_ttl            = 31536000
      max_ttl                = 31536000
      compress               = true
    }
  }

  # Custom error responses
  dynamic "custom_error_response" {
    for_each = var.cloudfront_custom_error_responses

    content {
      error_code            = custom_error_response.value.error_code
      response_code         = custom_error_response.value.response_code
      response_page_path    = custom_error_response.value.response_page_path
      error_caching_min_ttl = custom_error_response.value.error_caching_min_ttl
    }
  }

  # Geo restrictions
  restrictions {
    geo_restriction {
      restriction_type = var.cloudfront_geo_restriction_type
      locations        = var.cloudfront_geo_restriction_locations
    }
  }

  # SSL certificate
  viewer_certificate {
    acm_certificate_arn      = aws_acm_certificate_validation.main.certificate_arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }

  # Logging configuration (optional)
  dynamic "logging_config" {
    for_each = var.cloudfront_logging_bucket != "" ? [1] : []

    content {
      include_cookies = false
      bucket          = var.cloudfront_logging_bucket
      prefix          = "cloudfront/${var.environment}/"
    }
  }

  # WAF association (optional)
  web_acl_id = var.enable_waf ? aws_wafv2_web_acl.cloudfront[0].arn : null

  tags = merge(var.tags, {
    Name        = "${var.project_name}-cdn-${var.environment}"
    Environment = var.environment
  })
}

# =========================================
# DNS Records
# =========================================

# A record pointing to ALB (without CloudFront)
resource "aws_route53_record" "alb" {
  count = !var.enable_cloudfront && var.alb_dns_name != "" ? 1 : 0

  zone_id = local.zone_id
  name    = var.domain_name
  type    = "A"

  alias {
    name                   = var.alb_dns_name
    zone_id                = var.alb_zone_id
    evaluate_target_health = true
  }
}

# A record pointing to CloudFront (with CloudFront)
resource "aws_route53_record" "cloudfront" {
  count = var.enable_cloudfront ? 1 : 0

  zone_id = local.zone_id
  name    = var.domain_name
  type    = "A"

  alias {
    name                   = aws_cloudfront_distribution.main[0].domain_name
    zone_id                = aws_cloudfront_distribution.main[0].hosted_zone_id
    evaluate_target_health = false
  }
}

# AAAA record for IPv6 (CloudFront)
resource "aws_route53_record" "cloudfront_ipv6" {
  count = var.enable_cloudfront && var.enable_ipv6 ? 1 : 0

  zone_id = local.zone_id
  name    = var.domain_name
  type    = "AAAA"

  alias {
    name                   = aws_cloudfront_distribution.main[0].domain_name
    zone_id                = aws_cloudfront_distribution.main[0].hosted_zone_id
    evaluate_target_health = false
  }
}

# =========================================
# Route 53 Health Check (Optional)
# =========================================

resource "aws_route53_health_check" "main" {
  count = var.create_health_check ? 1 : 0

  fqdn              = var.domain_name
  port              = 443
  type              = "HTTPS"
  resource_path     = var.health_check_path
  failure_threshold = var.health_check_failure_threshold
  request_interval  = var.health_check_interval

  tags = merge(var.tags, {
    Name        = "${var.project_name}-health-check-${var.environment}"
    Environment = var.environment
  })
}

# CloudWatch alarm for health check
resource "aws_cloudwatch_metric_alarm" "health_check" {
  count = var.create_health_check ? 1 : 0

  alarm_name          = "${var.project_name}-health-check-failed-${var.environment}"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "HealthCheckStatus"
  namespace           = "AWS/Route53"
  period              = "60"
  statistic           = "Minimum"
  threshold           = "1"
  alarm_description   = "Route 53 health check failed"
  alarm_actions       = var.health_check_alarm_actions

  dimensions = {
    HealthCheckId = aws_route53_health_check.main[0].id
  }

  tags = merge(var.tags, {
    Name        = "${var.project_name}-health-check-alarm-${var.environment}"
    Environment = var.environment
  })
}

# =========================================
# WAF Web ACL for CloudFront (Optional)
# =========================================

resource "aws_wafv2_web_acl" "cloudfront" {
  count = var.enable_cloudfront && var.enable_waf ? 1 : 0

  name  = "${var.project_name}-cloudfront-waf-${var.environment}"
  scope = "CLOUDFRONT"

  default_action {
    allow {}
  }

  # AWS Managed Rules - Core Rule Set
  rule {
    name     = "AWSManagedRulesCommonRuleSet"
    priority = 1

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesCommonRuleSet"
        vendor_name = "AWS"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "AWSManagedRulesCommonRuleSetMetric"
      sampled_requests_enabled   = true
    }
  }

  # AWS Managed Rules - Known Bad Inputs
  rule {
    name     = "AWSManagedRulesKnownBadInputsRuleSet"
    priority = 2

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesKnownBadInputsRuleSet"
        vendor_name = "AWS"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "AWSManagedRulesKnownBadInputsRuleSetMetric"
      sampled_requests_enabled   = true
    }
  }

  # Rate limiting rule
  dynamic "rule" {
    for_each = var.waf_rate_limit > 0 ? [1] : []

    content {
      name     = "RateLimitRule"
      priority = 3

      action {
        block {}
      }

      statement {
        rate_based_statement {
          limit              = var.waf_rate_limit
          aggregate_key_type = "IP"
        }
      }

      visibility_config {
        cloudwatch_metrics_enabled = true
        metric_name                = "RateLimitRuleMetric"
        sampled_requests_enabled   = true
      }
    }
  }

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name                = "${var.project_name}-cloudfront-waf-${var.environment}"
    sampled_requests_enabled   = true
  }

  tags = merge(var.tags, {
    Name        = "${var.project_name}-cloudfront-waf-${var.environment}"
    Environment = var.environment
  })
}
