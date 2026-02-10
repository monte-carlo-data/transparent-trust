# Outputs for AWS Amplify Infrastructure
# Reference: SEC-1048 - AWS Amplify deployment

# =========================================
# Amplify App Outputs
# =========================================

output "app_id" {
  description = "ID of the Amplify app"
  value       = aws_amplify_app.main.id
}

output "app_arn" {
  description = "ARN of the Amplify app"
  value       = aws_amplify_app.main.arn
}

output "app_name" {
  description = "Name of the Amplify app"
  value       = aws_amplify_app.main.name
}

output "default_domain" {
  description = "Default Amplify domain (amplifyapp.com subdomain)"
  value       = aws_amplify_app.main.default_domain
}

# =========================================
# Branch Outputs
# =========================================

output "main_branch_name" {
  description = "Name of the main branch"
  value       = aws_amplify_branch.main.branch_name
}

output "main_branch_url" {
  description = "URL of the main branch deployment"
  value       = "https://${aws_amplify_branch.main.branch_name}.${aws_amplify_app.main.default_domain}"
}

output "main_branch_arn" {
  description = "ARN of the main branch"
  value       = aws_amplify_branch.main.arn
}

output "additional_branch_urls" {
  description = "URLs of additional branch deployments"
  value = {
    for k, v in aws_amplify_branch.additional :
    k => "https://${v.branch_name}.${aws_amplify_app.main.default_domain}"
  }
}

# =========================================
# Custom Domain Outputs
# =========================================

output "custom_domain" {
  description = "Custom domain configuration"
  value       = var.custom_domain != "" ? var.custom_domain : null
}

output "custom_domain_url" {
  description = "URL of the custom domain (if configured)"
  value       = var.custom_domain != "" && var.domain_prefix != "" ? "https://${var.domain_prefix}.${var.custom_domain}" : (var.custom_domain != "" ? "https://${var.custom_domain}" : null)
}

output "domain_association_arn" {
  description = "ARN of the domain association"
  value       = var.custom_domain != "" ? aws_amplify_domain_association.main[0].arn : null
}

output "certificate_verification_dns_record" {
  description = "DNS record for certificate verification"
  value       = var.custom_domain != "" ? aws_amplify_domain_association.main[0].certificate_verification_dns_record : null
}

# =========================================
# Webhook Outputs
# =========================================

output "webhook_url" {
  description = "Webhook URL for manual deployments"
  value       = var.create_webhook ? aws_amplify_webhook.main[0].url : null
  sensitive   = true
}

output "webhook_arn" {
  description = "ARN of the webhook"
  value       = var.create_webhook ? aws_amplify_webhook.main[0].arn : null
}

# =========================================
# Alarm Outputs
# =========================================

output "build_failures_alarm_arn" {
  description = "ARN of the build failures alarm"
  value       = var.enable_alarms ? aws_cloudwatch_metric_alarm.build_failures[0].arn : null
}

output "deployment_duration_alarm_arn" {
  description = "ARN of the deployment duration alarm"
  value       = var.enable_alarms ? aws_cloudwatch_metric_alarm.deployment_duration[0].arn : null
}

# =========================================
# Deployment Information
# =========================================

output "deployment_info" {
  description = "Summary of Amplify deployment configuration"
  value = {
    app_id              = aws_amplify_app.main.id
    app_name            = aws_amplify_app.main.name
    default_domain      = aws_amplify_app.main.default_domain
    main_branch         = aws_amplify_branch.main.branch_name
    main_branch_url     = "https://${aws_amplify_branch.main.branch_name}.${aws_amplify_app.main.default_domain}"
    custom_domain       = var.custom_domain != "" ? var.custom_domain : null
    custom_domain_url   = var.custom_domain != "" && var.domain_prefix != "" ? "https://${var.domain_prefix}.${var.custom_domain}" : (var.custom_domain != "" ? "https://${var.custom_domain}" : null)
    environment         = var.environment
    auto_build_enabled  = var.enable_branch_auto_build
    pr_previews_enabled = var.enable_pr_previews
    additional_branches = keys(aws_amplify_branch.additional)
  }
}

# =========================================
# Quick Reference Commands
# =========================================

output "useful_commands" {
  description = "Useful commands for managing the Amplify deployment"
  value = {
    view_app          = "aws amplify get-app --app-id ${aws_amplify_app.main.id}"
    list_branches     = "aws amplify list-branches --app-id ${aws_amplify_app.main.id}"
    start_deployment  = "aws amplify start-job --app-id ${aws_amplify_app.main.id} --branch-name ${aws_amplify_branch.main.branch_name} --job-type RELEASE"
    view_deployments  = "aws amplify list-jobs --app-id ${aws_amplify_app.main.id} --branch-name ${aws_amplify_branch.main.branch_name}"
    get_domain_status = var.custom_domain != "" ? "aws amplify get-domain-association --app-id ${aws_amplify_app.main.id} --domain-name ${var.custom_domain}" : "N/A - No custom domain configured"
    console_url       = "https://console.aws.amazon.com/amplify/home#/${aws_amplify_app.main.id}"
  }
}

# =========================================
# Parameter Store Paths for Secrets
# =========================================

output "parameter_store_paths" {
  description = "Recommended Parameter Store paths for secrets (to be created separately)"
  value = {
    nextauth_secret      = "/amplify/${var.project_name}/${var.environment}/NEXTAUTH_SECRET"
    nextauth_url         = "/amplify/${var.project_name}/${var.environment}/NEXTAUTH_URL"
    database_url         = "/amplify/${var.project_name}/${var.environment}/DATABASE_URL"
    anthropic_api_key    = "/amplify/${var.project_name}/${var.environment}/ANTHROPIC_API_KEY"
    google_client_id     = "/amplify/${var.project_name}/${var.environment}/GOOGLE_CLIENT_ID"
    google_client_secret = "/amplify/${var.project_name}/${var.environment}/GOOGLE_CLIENT_SECRET"
    upstash_redis_url    = "/amplify/${var.project_name}/${var.environment}/UPSTASH_REDIS_REST_URL"
    upstash_redis_token  = "/amplify/${var.project_name}/${var.environment}/UPSTASH_REDIS_REST_TOKEN"
    encryption_key       = "/amplify/${var.project_name}/${var.environment}/ENCRYPTION_KEY"
  }
}
