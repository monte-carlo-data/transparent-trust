# Outputs for Security Groups module
# Reference: SEC-1053 - Security Groups and NACLs

# ALB Security Group
output "alb_security_group_id" {
  description = "ID of the ALB security group"
  value       = aws_security_group.alb.id
}

output "alb_security_group_arn" {
  description = "ARN of the ALB security group"
  value       = aws_security_group.alb.arn
}

# Application Security Group
output "app_security_group_id" {
  description = "ID of the application security group"
  value       = aws_security_group.app.id
}

output "app_security_group_arn" {
  description = "ARN of the application security group"
  value       = aws_security_group.app.arn
}

# RDS Security Group
output "rds_security_group_id" {
  description = "ID of the RDS security group"
  value       = aws_security_group.rds.id
}

output "rds_security_group_arn" {
  description = "ARN of the RDS security group"
  value       = aws_security_group.rds.arn
}

# Redis Security Group
output "redis_security_group_id" {
  description = "ID of the Redis security group (if enabled)"
  value       = var.enable_redis ? aws_security_group.redis[0].id : null
}

output "redis_security_group_arn" {
  description = "ARN of the Redis security group (if enabled)"
  value       = var.enable_redis ? aws_security_group.redis[0].arn : null
}

# VPC Endpoints Security Group
output "vpc_endpoints_security_group_id" {
  description = "ID of the VPC endpoints security group (if enabled)"
  value       = var.enable_vpc_endpoints ? aws_security_group.vpc_endpoints[0].id : null
}

output "vpc_endpoints_security_group_arn" {
  description = "ARN of the VPC endpoints security group (if enabled)"
  value       = var.enable_vpc_endpoints ? aws_security_group.vpc_endpoints[0].arn : null
}

# Network ACLs
output "public_nacl_id" {
  description = "ID of the public Network ACL (if custom NACLs enabled)"
  value       = var.enable_custom_nacls ? aws_network_acl.public[0].id : null
}

output "private_nacl_id" {
  description = "ID of the private Network ACL (if custom NACLs enabled)"
  value       = var.enable_custom_nacls ? aws_network_acl.private[0].id : null
}

# Summary Output
output "security_groups_summary" {
  description = "Summary of created security groups"
  value = {
    alb_sg_id            = aws_security_group.alb.id
    app_sg_id            = aws_security_group.app.id
    rds_sg_id            = aws_security_group.rds.id
    redis_sg_id          = var.enable_redis ? aws_security_group.redis[0].id : null
    vpc_endpoints_sg_id  = var.enable_vpc_endpoints ? aws_security_group.vpc_endpoints[0].id : null
    custom_nacls_enabled = var.enable_custom_nacls
  }
}
