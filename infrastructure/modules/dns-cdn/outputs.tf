# Outputs for DNS & CDN Infrastructure
# Reference: SEC-1059

# =========================================
# Route 53 Outputs
# =========================================

output "hosted_zone_id" {
  description = "ID of the Route 53 hosted zone"
  value       = local.zone_id
}

output "hosted_zone_name_servers" {
  description = "Name servers for the hosted zone (update these at your domain registrar)"
  value       = var.create_hosted_zone ? aws_route53_zone.main[0].name_servers : null
}

output "domain_name" {
  description = "Primary domain name"
  value       = var.domain_name
}

# =========================================
# ACM Certificate Outputs
# =========================================

output "certificate_arn" {
  description = "ARN of the ACM certificate"
  value       = aws_acm_certificate.main.arn
}

output "certificate_status" {
  description = "Status of the ACM certificate"
  value       = aws_acm_certificate.main.status
}

output "certificate_domain_validation_options" {
  description = "Domain validation options for manual validation (if needed)"
  value       = aws_acm_certificate.main.domain_validation_options
  sensitive   = true
}

# =========================================
# CloudFront Outputs
# =========================================

output "cloudfront_distribution_id" {
  description = "ID of the CloudFront distribution"
  value       = var.enable_cloudfront ? aws_cloudfront_distribution.main[0].id : null
}

output "cloudfront_distribution_arn" {
  description = "ARN of the CloudFront distribution"
  value       = var.enable_cloudfront ? aws_cloudfront_distribution.main[0].arn : null
}

output "cloudfront_domain_name" {
  description = "Domain name of the CloudFront distribution (for testing)"
  value       = var.enable_cloudfront ? aws_cloudfront_distribution.main[0].domain_name : null
}

output "cloudfront_hosted_zone_id" {
  description = "Hosted zone ID for CloudFront distribution"
  value       = var.enable_cloudfront ? aws_cloudfront_distribution.main[0].hosted_zone_id : null
}

output "cloudfront_status" {
  description = "Status of the CloudFront distribution"
  value       = var.enable_cloudfront ? aws_cloudfront_distribution.main[0].status : null
}

# =========================================
# Health Check Outputs
# =========================================

output "health_check_id" {
  description = "ID of the Route 53 health check"
  value       = var.create_health_check ? aws_route53_health_check.main[0].id : null
}

output "health_check_cloudwatch_alarm_name" {
  description = "Name of the CloudWatch alarm for health check"
  value       = var.create_health_check ? aws_cloudwatch_metric_alarm.health_check[0].alarm_name : null
}

# =========================================
# WAF Outputs
# =========================================

output "waf_web_acl_id" {
  description = "ID of the WAF Web ACL"
  value       = var.enable_cloudfront && var.enable_waf ? aws_wafv2_web_acl.cloudfront[0].id : null
}

output "waf_web_acl_arn" {
  description = "ARN of the WAF Web ACL"
  value       = var.enable_cloudfront && var.enable_waf ? aws_wafv2_web_acl.cloudfront[0].arn : null
}

# =========================================
# DNS Records Outputs
# =========================================

output "dns_record_name" {
  description = "Name of the DNS A record"
  value       = var.domain_name
}

output "dns_record_target" {
  description = "Target of the DNS A record (ALB or CloudFront)"
  value = var.enable_cloudfront ? (
    var.enable_cloudfront ? aws_cloudfront_distribution.main[0].domain_name : null
    ) : (
    var.alb_dns_name != "" ? var.alb_dns_name : null
  )
}

# =========================================
# Setup Instructions
# =========================================

output "setup_instructions" {
  description = "Next steps for DNS setup"
  value       = <<-EOT
    ========================================
    DNS SETUP INSTRUCTIONS
    ========================================

    ${var.create_hosted_zone ? "1. Update your domain registrar with these name servers:\n       ${join("\n       ", aws_route53_zone.main[0].name_servers)}\n\n    2. Wait for DNS propagation (can take 24-48 hours)\n" : "Using existing hosted zone: ${var.domain_name}\n"}
    ${var.create_hosted_zone ? "3" : "1"}. Verify DNS with:
       dig ${var.domain_name}
       dig NS ${var.domain_name}

    ${var.create_hosted_zone ? "4" : "2"}. Update NEXTAUTH_URL in your application:
       NEXTAUTH_URL=https://${var.domain_name}

    ${var.enable_cloudfront ? "${var.create_hosted_zone ? "5" : "3"}. Test CloudFront distribution:\n       https://${aws_cloudfront_distribution.main[0].domain_name}\n" : ""}
    ========================================
  EOT
}

# =========================================
# Cost Estimate
# =========================================

output "estimated_monthly_cost" {
  description = "Estimated monthly cost breakdown"
  value = {
    route53_hosted_zone = var.create_hosted_zone ? "$0.50" : "$0 (using existing)"
    route53_queries     = "$0.40 per million queries (first 1B)"
    acm_certificate     = "$0 (free for public certificates)"
    cloudfront          = var.enable_cloudfront ? "$0.085 per GB transferred + $0.0075 per 10,000 requests (US/Europe)" : "$0 (disabled)"
    health_check        = var.create_health_check ? "$0.50" : "$0 (disabled)"
    waf                 = var.enable_cloudfront && var.enable_waf ? "$5 + $1 per rule + $0.60 per million requests" : "$0 (disabled)"
    total_minimum       = var.enable_cloudfront ? (var.enable_waf ? "$6.50-$11/month (with CloudFront + WAF)" : "$1-$5/month (with CloudFront)") : "$0.50-$1/month (DNS only)"
  }
}

# =========================================
# Testing Commands
# =========================================

output "testing_commands" {
  description = "Commands to test the DNS and CDN setup"
  value = {
    test_dns              = "dig ${var.domain_name}"
    test_nameservers      = "dig NS ${var.domain_name}"
    test_https            = "curl -I https://${var.domain_name}"
    test_health_check     = var.create_health_check ? "aws route53 get-health-check-status --health-check-id ${var.create_health_check ? aws_route53_health_check.main[0].id : "N/A"}" : "Health check disabled"
    test_cloudfront_cache = var.enable_cloudfront ? "curl -I https://${var.domain_name} | grep -i x-cache" : "CloudFront disabled"
    invalidate_cloudfront = var.enable_cloudfront ? "aws cloudfront create-invalidation --distribution-id ${aws_cloudfront_distribution.main[0].id} --paths '/*'" : "CloudFront disabled"
    view_waf_logs         = var.enable_cloudfront && var.enable_waf ? "aws wafv2 list-web-acls --scope=CLOUDFRONT --region=us-east-1" : "WAF disabled"
  }
}
