# ACM Certificate Module Outputs

output "certificate_arn" {
  description = "ARN of the ACM certificate"
  value       = aws_acm_certificate.main.arn
}

output "certificate_domain_name" {
  description = "Domain name of the certificate"
  value       = aws_acm_certificate.main.domain_name
}

output "certificate_status" {
  description = "Status of the certificate"
  value       = aws_acm_certificate.main.status
}

output "validation_records" {
  description = "DNS validation records (for manual creation if needed)"
  value = [
    for dvo in aws_acm_certificate.main.domain_validation_options : {
      domain_name  = dvo.domain_name
      record_name  = dvo.resource_record_name
      record_type  = dvo.resource_record_type
      record_value = dvo.resource_record_value
    }
  ]
}

output "ssm_parameter_name" {
  description = "SSM Parameter Store name for the certificate ARN"
  value       = var.store_in_ssm ? aws_ssm_parameter.certificate_arn[0].name : null
}
