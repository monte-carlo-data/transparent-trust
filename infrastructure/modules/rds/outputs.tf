# Outputs for RDS module
# Reference: SEC-1049 - RDS PostgreSQL

# RDS Instance
output "db_instance_id" {
  description = "ID of the RDS instance"
  value       = aws_db_instance.main.id
}

output "db_instance_arn" {
  description = "ARN of the RDS instance"
  value       = aws_db_instance.main.arn
}

output "db_instance_endpoint" {
  description = "Connection endpoint (host:port)"
  value       = aws_db_instance.main.endpoint
}

output "db_instance_address" {
  description = "Hostname of the RDS instance"
  value       = aws_db_instance.main.address
}

output "db_instance_port" {
  description = "Port of the RDS instance"
  value       = aws_db_instance.main.port
}

output "db_instance_name" {
  description = "Name of the database"
  value       = aws_db_instance.main.db_name
}

output "db_instance_username" {
  description = "Master username"
  value       = aws_db_instance.main.username
  sensitive   = true
}

output "db_instance_resource_id" {
  description = "Resource ID of the RDS instance"
  value       = aws_db_instance.main.resource_id
}

# Connection String
output "database_url" {
  description = "PostgreSQL connection URL (without password)"
  value       = "postgresql://${aws_db_instance.main.username}@${aws_db_instance.main.address}:${aws_db_instance.main.port}/${aws_db_instance.main.db_name}"
  sensitive   = true
}

output "db_endpoint" {
  description = "Database endpoint (address without port)"
  value       = aws_db_instance.main.address
  sensitive   = false
}

# RDS Managed Secret (AWS manages password automatically)
output "master_user_secret_arn" {
  description = "ARN of the RDS-managed Secrets Manager secret containing master credentials"
  value       = length(aws_db_instance.main.master_user_secret) > 0 ? aws_db_instance.main.master_user_secret[0].secret_arn : null
  sensitive   = true
}

output "master_user_secret_status" {
  description = "Status of the RDS-managed secret"
  value       = length(aws_db_instance.main.master_user_secret) > 0 ? aws_db_instance.main.master_user_secret[0].secret_status : null
}

# RDS Password Reference Secret (with our naming convention)
output "rds_password_reference_arn" {
  description = "ARN of the reference secret containing RDS password (uses transparent-trust-* naming)"
  value       = aws_secretsmanager_secret.rds_password_reference.arn
  sensitive   = true
}

# Legacy outputs for backwards compatibility (deprecated - use master_user_secret_arn)
output "db_credentials_secret_arn" {
  description = "DEPRECATED: Use rds_password_reference_arn instead. ARN of database credentials secret"
  value       = aws_secretsmanager_secret.rds_password_reference.arn
  sensitive   = true
}

# Subnet Group
output "db_subnet_group_id" {
  description = "ID of the DB subnet group"
  value       = aws_db_subnet_group.main.id
}

output "db_subnet_group_arn" {
  description = "ARN of the DB subnet group"
  value       = aws_db_subnet_group.main.arn
}

# Parameter Group
output "db_parameter_group_id" {
  description = "ID of the DB parameter group"
  value       = aws_db_parameter_group.main.id
}

output "db_parameter_group_arn" {
  description = "ARN of the DB parameter group"
  value       = aws_db_parameter_group.main.arn
}

# KMS
output "kms_key_id" {
  description = "ID of the KMS key used for encryption"
  value       = var.create_kms_key ? aws_kms_key.rds[0].id : null
}

output "kms_key_arn" {
  description = "ARN of the KMS key used for encryption"
  value       = var.create_kms_key ? aws_kms_key.rds[0].arn : null
}

# CloudWatch Alarms
output "cpu_alarm_id" {
  description = "ID of the CPU utilization alarm"
  value       = var.enable_cloudwatch_alarms ? aws_cloudwatch_metric_alarm.database_cpu[0].id : null
}

output "memory_alarm_id" {
  description = "ID of the memory alarm"
  value       = var.enable_cloudwatch_alarms ? aws_cloudwatch_metric_alarm.database_memory[0].id : null
}

output "storage_alarm_id" {
  description = "ID of the storage alarm"
  value       = var.enable_cloudwatch_alarms ? aws_cloudwatch_metric_alarm.database_storage[0].id : null
}

output "connections_alarm_id" {
  description = "ID of the connections alarm"
  value       = var.enable_cloudwatch_alarms ? aws_cloudwatch_metric_alarm.database_connections[0].id : null
}

# Summary
output "rds_summary" {
  description = "Summary of RDS configuration"
  value = {
    endpoint                = aws_db_instance.main.endpoint
    database_name           = aws_db_instance.main.db_name
    engine_version          = aws_db_instance.main.engine_version
    instance_class          = aws_db_instance.main.instance_class
    multi_az                = aws_db_instance.main.multi_az
    storage_encrypted       = aws_db_instance.main.storage_encrypted
    backup_retention_period = aws_db_instance.main.backup_retention_period
    monitoring_interval     = aws_db_instance.main.monitoring_interval
    performance_insights    = aws_db_instance.main.performance_insights_enabled
    secrets_manager_arn     = length(aws_db_instance.main.master_user_secret) > 0 ? aws_db_instance.main.master_user_secret[0].secret_arn : null
  }
}
