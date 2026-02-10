# Environment Outputs

# =========================================
# VPC Outputs
# =========================================

output "vpc_id" {
  description = "ID of the VPC"
  value       = module.vpc.vpc_id
}

output "vpc_cidr_block" {
  description = "CIDR block of the VPC"
  value       = module.vpc.vpc_cidr
}

output "public_subnet_ids" {
  description = "IDs of the public subnets"
  value       = module.vpc.public_subnet_ids
}

output "private_subnet_ids" {
  description = "IDs of the private subnets"
  value       = module.vpc.private_subnet_ids
}

output "nat_gateway_ids" {
  description = "IDs of the NAT Gateways"
  value       = module.vpc.nat_gateway_ids
}

# =========================================
# Security Groups Outputs
# =========================================

output "alb_security_group_id" {
  description = "ID of the ALB security group"
  value       = module.security_groups.alb_security_group_id
}

output "app_security_group_id" {
  description = "ID of the application security group"
  value       = module.security_groups.app_security_group_id
}

output "rds_security_group_id" {
  description = "ID of the RDS security group"
  value       = module.security_groups.rds_security_group_id
}

# =========================================
# S3 Outputs
# =========================================

output "uploads_bucket_name" {
  description = "Name of the uploads S3 bucket"
  value       = module.s3.app_uploads_bucket_id
}

output "uploads_bucket_arn" {
  description = "ARN of the uploads S3 bucket"
  value       = module.s3.app_uploads_bucket_arn
}

output "logs_bucket_name" {
  description = "Name of the logs S3 bucket"
  value       = module.s3.logs_bucket_id
}

# =========================================
# IAM Outputs
# =========================================

output "ecs_execution_role_arn" {
  description = "ARN of the ECS execution role"
  value       = module.iam.ecs_task_execution_role_arn
}

output "ecs_task_role_arn" {
  description = "ARN of the ECS task role"
  value       = module.iam.app_runtime_role_arn
}

output "app_s3_policy_arn" {
  description = "ARN of the application S3 access policy"
  value       = module.s3_policies.app_s3_access_policy_arn
}

# =========================================
# Secrets Manager Outputs
# =========================================

output "nextauth_secret_arn" {
  description = "ARN of the NextAuth secret"
  value       = module.secrets_manager.nextauth_secret_arn
  sensitive   = true
}

output "anthropic_api_key_secret_arn" {
  description = "ARN of the Anthropic API key secret"
  value       = module.secrets_manager.anthropic_api_key_arn
  sensitive   = true
}

output "encryption_key_secret_arn" {
  description = "ARN of the encryption key secret"
  value       = module.secrets_manager.encryption_key_arn
  sensitive   = true
}

output "secrets_policy_arn" {
  description = "ARN of the secrets access policy"
  value       = module.secrets_manager.secrets_access_policy_arn
}

# =========================================
# RDS Outputs
# =========================================

output "db_instance_endpoint" {
  description = "Endpoint of the RDS instance"
  value       = module.rds.db_instance_endpoint
}

output "db_instance_id" {
  description = "ID of the RDS instance"
  value       = module.rds.db_instance_id
}

output "db_credentials_secret_arn" {
  description = "ARN of the database credentials secret"
  value       = module.rds.db_credentials_secret_arn
  sensitive   = true
}

output "database_url_secret_arn" {
  description = "ARN of the database URL secret"
  value       = aws_secretsmanager_secret.database_url.arn
  sensitive   = true
}

# =========================================
# Redis Outputs
# =========================================

output "redis_endpoint" {
  description = "Endpoint of the Redis cluster"
  value       = var.enable_elasticache_redis ? (length(module.redis) > 0 ? module.redis[0].redis_endpoint : null) : null
}

# =========================================
# ALB Outputs
# =========================================

output "alb_dns_name" {
  description = "DNS name of the ALB"
  value       = module.alb.alb_dns_name
}

output "alb_arn" {
  description = "ARN of the ALB"
  value       = module.alb.alb_arn
}

output "alb_zone_id" {
  description = "Zone ID of the ALB"
  value       = module.alb.alb_zone_id
}

output "target_group_arn" {
  description = "ARN of the target group"
  value       = module.alb.target_group_arn
}

# =========================================
# Certificate Outputs
# =========================================

output "certificate_arn" {
  description = "ARN of the ACM certificate"
  value       = aws_acm_certificate.app.arn
}

# =========================================
# DNS Outputs
# =========================================

output "domain_name" {
  description = "Domain name for the application"
  value       = var.domain_name
}

output "dns_setup_instructions" {
  description = "Instructions for DNS setup"
  value       = <<-EOT
    Create an A record in your DNS zone:
      Name: ${var.domain_name}
      Type: A (Alias)
      Target: ${module.alb.alb_dns_name}
      Zone ID: ${module.alb.alb_zone_id}
  EOT
}

# =========================================
# DNS & CDN Outputs
# =========================================

output "cloudfront_distribution_id" {
  description = "ID of the CloudFront distribution"
  value       = var.enable_dns_cdn && var.enable_cloudfront ? (length(module.dns_cdn) > 0 ? module.dns_cdn[0].cloudfront_distribution_id : null) : null
}

output "cloudfront_domain_name" {
  description = "Domain name of the CloudFront distribution"
  value       = var.enable_dns_cdn && var.enable_cloudfront ? (length(module.dns_cdn) > 0 ? module.dns_cdn[0].cloudfront_domain_name : null) : null
}

# =========================================
# ECS Outputs
# =========================================

output "ecs_cluster_name" {
  description = "Name of the ECS cluster"
  value       = var.deployment_type == "ecs" ? (length(module.ecs) > 0 ? module.ecs[0].cluster_name : null) : null
}

output "ecs_service_name" {
  description = "Name of the ECS service"
  value       = var.deployment_type == "ecs" ? (length(module.ecs) > 0 ? module.ecs[0].service_name : null) : null
}

output "ecr_repository_url" {
  description = "URL of the ECR repository"
  value       = var.deployment_type == "ecs" ? (length(module.ecs) > 0 ? module.ecs[0].ecr_repository_url : null) : null
}

# =========================================
# Amplify Outputs
# =========================================

output "amplify_app_id" {
  description = "ID of the Amplify app"
  value       = var.deployment_type == "amplify" ? (length(module.amplify) > 0 ? module.amplify[0].app_id : null) : null
}

output "amplify_default_domain" {
  description = "Default domain of the Amplify app"
  value       = var.deployment_type == "amplify" ? (length(module.amplify) > 0 ? module.amplify[0].default_domain : null) : null
}

# =========================================
# Monitoring Outputs
# =========================================

output "critical_sns_topic_arn" {
  description = "ARN of the critical alerts SNS topic"
  value       = var.enable_monitoring ? (length(module.monitoring) > 0 ? module.monitoring[0].critical_alerts_topic_arn : null) : null
}

output "warning_sns_topic_arn" {
  description = "ARN of the warning alerts SNS topic"
  value       = var.enable_monitoring ? (length(module.monitoring) > 0 ? module.monitoring[0].warning_alerts_topic_arn : null) : null
}

output "dashboard_url" {
  description = "URL of the CloudWatch dashboard"
  value       = var.enable_monitoring && var.monitoring_create_dashboard ? (length(module.monitoring) > 0 ? module.monitoring[0].dashboard_name : null) : null
}

# =========================================
# Bastion Host Outputs
# =========================================

output "bastion_instance_id" {
  description = "ID of the bastion EC2 instance"
  value       = var.enable_bastion ? (length(module.bastion) > 0 ? module.bastion[0].instance_id : null) : null
}

output "bastion_tailscale_hostname" {
  description = "Tailscale hostname for the bastion"
  value       = var.enable_bastion ? (length(module.bastion) > 0 ? module.bastion[0].tailscale_hostname : null) : null
}

output "bastion_tailscale_ssh_command" {
  description = "SSH command to connect to bastion via Tailscale"
  value       = var.enable_bastion ? (length(module.bastion) > 0 ? module.bastion[0].tailscale_ssh_command : null) : null
}

output "bastion_ssm_command" {
  description = "AWS CLI command to start an SSM session to the bastion"
  value       = var.enable_bastion ? (length(module.bastion) > 0 ? module.bastion[0].ssm_start_session_command : null) : null
}

output "bastion_port_forward_command" {
  description = "AWS CLI command for port forwarding to RDS"
  value       = var.enable_bastion ? (length(module.bastion) > 0 ? replace(module.bastion[0].ssm_port_forward_command, "RDS_ENDPOINT", module.rds.db_endpoint) : null) : null
}
