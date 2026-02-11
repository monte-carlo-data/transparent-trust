# ACM Certificate Module
# Creates and validates ACM certificates with DNS validation

terraform {
  required_providers {
    aws = {
      source                = "hashicorp/aws"
      version               = ">= 5.0"
      configuration_aliases = [aws.route53]
    }
  }
}

resource "aws_acm_certificate" "main" {
  domain_name               = var.domain_name
  subject_alternative_names = var.subject_alternative_names
  validation_method         = "DNS"

  lifecycle {
    create_before_destroy = true
  }

  tags = {
    Name        = "${var.project_name}-certificate-${var.environment}"
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "terraform"
    Domain      = var.domain_name
  }
}

# DNS validation records (to be created in Route53)
# These will be output for manual creation or automatic creation if zone ID is provided
# Uses aws.route53 provider passed from parent module
resource "aws_route53_record" "validation" {
  for_each = var.create_validation_records ? {
    for dvo in aws_acm_certificate.main.domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  } : {}

  provider = aws.route53

  allow_overwrite = true
  name            = each.value.name
  records         = [each.value.record]
  ttl             = 60
  type            = each.value.type
  zone_id         = var.route53_zone_id
}

# Certificate validation waiter
resource "aws_acm_certificate_validation" "main" {
  count = var.create_validation_records && var.wait_for_validation ? 1 : 0

  certificate_arn         = aws_acm_certificate.main.arn
  validation_record_fqdns = [for record in aws_route53_record.validation : record.fqdn]

  timeouts {
    create = "30m"
  }
}

# Optional: Store certificate ARN in SSM Parameter Store
resource "aws_ssm_parameter" "certificate_arn" {
  count = var.store_in_ssm ? 1 : 0

  name        = "/domain/public/${var.domain_name}/certificate/arn"
  description = "ACM Certificate ARN for ${var.domain_name}"
  type        = "String"
  value       = aws_acm_certificate.main.arn

  tags = {
    Name        = "${var.project_name}-cert-arn-${var.environment}"
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}
