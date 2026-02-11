# RDS PostgreSQL for Transparent Trust
# Reference: SEC-1049 - RDS PostgreSQL
# Creates a production-ready PostgreSQL 16 database with Multi-AZ, encryption, and backups

# Data sources (assume VPC and security groups modules exist)
variable "vpc_id" {
  description = "VPC ID where RDS will be created"
  type        = string
}

variable "private_subnet_ids" {
  description = "List of private subnet IDs for RDS placement"
  type        = list(string)
}

variable "rds_security_group_id" {
  description = "Security group ID for RDS"
  type        = string
}

variable "rds_monitoring_role_arn" {
  description = "IAM role ARN for RDS enhanced monitoring"
  type        = string
  default     = ""
}

# Password is now managed by RDS via manage_master_user_password = true
# RDS will automatically create and store the password in Secrets Manager

# DB Subnet Group
resource "aws_db_subnet_group" "main" {
  name       = "${var.project_name}-db-subnet-${var.environment}"
  subnet_ids = var.private_subnet_ids

  tags = {
    Name        = "${var.project_name}-db-subnet-${var.environment}"
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

# DB Parameter Group (for PostgreSQL configuration)
resource "aws_db_parameter_group" "main" {
  name   = "${var.project_name}-postgres16-${var.environment}"
  family = "postgres16"

  # Enforce SSL connections
  parameter {
    name  = "rds.force_ssl"
    value = var.force_ssl ? "1" : "0"
  }

  # Log connections
  parameter {
    name  = "log_connections"
    value = "1"
  }

  # Log disconnections
  parameter {
    name  = "log_disconnections"
    value = "1"
  }

  # Log statements (for debugging - can be expensive)
  dynamic "parameter" {
    for_each = var.log_statements ? [1] : []
    content {
      name  = "log_statement"
      value = "all"
    }
  }

  tags = {
    Name        = "${var.project_name}-postgres16-${var.environment}"
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

# KMS Key for encryption at rest
resource "aws_kms_key" "rds" {
  count               = var.create_kms_key ? 1 : 0
  description         = "KMS key for ${var.project_name} RDS encryption"
  enable_key_rotation = true

  tags = {
    Name        = "${var.project_name}-rds-kms-${var.environment}"
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

resource "aws_kms_alias" "rds" {
  count         = var.create_kms_key ? 1 : 0
  name          = "alias/${var.project_name}-rds-${var.environment}"
  target_key_id = aws_kms_key.rds[0].key_id
}

# RDS PostgreSQL Instance
resource "aws_db_instance" "main" {
  identifier = "${var.project_name}-db-${var.environment}"

  # Engine configuration
  engine                = "postgres"
  engine_version        = var.postgres_version
  instance_class        = var.instance_class
  allocated_storage     = var.allocated_storage
  max_allocated_storage = var.max_allocated_storage
  storage_type          = var.storage_type
  storage_encrypted     = true
  kms_key_id            = var.create_kms_key ? aws_kms_key.rds[0].arn : var.kms_key_id

  # Database configuration
  db_name  = var.database_name
  username = var.master_username
  # Use RDS managed password in Secrets Manager (AWS manages rotation automatically)
  manage_master_user_password = true
  port                        = 5432

  # Multi-AZ and availability
  multi_az               = var.multi_az
  availability_zone      = var.multi_az ? null : var.availability_zone
  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [var.rds_security_group_id]
  publicly_accessible    = false

  # Parameter and option groups
  parameter_group_name = aws_db_parameter_group.main.name

  # Backup configuration
  backup_retention_period   = var.backup_retention_period
  backup_window             = var.backup_window
  maintenance_window        = var.maintenance_window
  delete_automated_backups  = var.delete_automated_backups
  skip_final_snapshot       = var.skip_final_snapshot
  final_snapshot_identifier = var.skip_final_snapshot ? null : "${var.project_name}-db-final-snapshot-${var.environment}-${formatdate("YYYY-MM-DD-hhmm", timestamp())}"
  copy_tags_to_snapshot     = true

  # Enhanced monitoring
  enabled_cloudwatch_logs_exports = var.enabled_cloudwatch_logs_exports
  monitoring_interval             = var.monitoring_interval
  monitoring_role_arn             = var.monitoring_interval > 0 ? var.rds_monitoring_role_arn : null

  # Performance Insights
  performance_insights_enabled          = var.performance_insights_enabled
  performance_insights_retention_period = var.performance_insights_enabled ? var.performance_insights_retention : null
  performance_insights_kms_key_id       = var.performance_insights_enabled && var.create_kms_key ? aws_kms_key.rds[0].arn : null

  # Deletion protection
  deletion_protection = var.deletion_protection

  # Auto minor version upgrades
  auto_minor_version_upgrade = var.auto_minor_version_upgrade

  # IAM database authentication
  iam_database_authentication_enabled = var.iam_database_authentication_enabled

  tags = {
    Name        = "${var.project_name}-db-${var.environment}"
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "terraform"
  }

  lifecycle {
    ignore_changes = [
      password, # Password managed in Secrets Manager after initial creation
    ]
  }
}

# Create a reference secret with our preferred naming convention
# This allows using transparent-trust-* IAM pattern instead of rds!*
# Note: The secret value must be manually copied from the RDS-managed secret
# Command to sync:
# aws secretsmanager put-secret-value \
#   --secret-id transparent-trust-rds-password-${environment} \
#   --secret-string "$(aws secretsmanager get-secret-value \
#     --secret-id $(terraform output -raw master_user_secret_arn) \
#     --query SecretString --output text)"
resource "aws_secretsmanager_secret" "rds_password_reference" {
  name = "${var.project_name}-rds-password-${var.environment}"
  # Include SourceSecretARN in description since AWS rejects '!' character in tag values
  description = "Reference to RDS-managed password for ${var.project_name} ${var.environment}. Source: ${length(aws_db_instance.main.master_user_secret) > 0 ? aws_db_instance.main.master_user_secret[0].secret_arn : "pending"}"

  tags = {
    Name        = "${var.project_name}-rds-password-${var.environment}"
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "terraform"
    Purpose     = "rds-password-reference"
  }
}

# CloudWatch Alarms for RDS
resource "aws_cloudwatch_metric_alarm" "database_cpu" {
  count               = var.enable_cloudwatch_alarms ? 1 : 0
  alarm_name          = "${var.project_name}-db-cpu-${var.environment}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "CPUUtilization"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = var.cpu_threshold
  alarm_description   = "Database CPU utilization is too high"
  alarm_actions       = var.alarm_sns_topic_arns

  dimensions = {
    DBInstanceIdentifier = aws_db_instance.main.identifier
  }

  tags = {
    Name        = "${var.project_name}-db-cpu-alarm-${var.environment}"
    Project     = var.project_name
    Environment = var.environment
  }
}

resource "aws_cloudwatch_metric_alarm" "database_memory" {
  count               = var.enable_cloudwatch_alarms ? 1 : 0
  alarm_name          = "${var.project_name}-db-memory-${var.environment}"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = 2
  metric_name         = "FreeableMemory"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = var.freeable_memory_threshold
  alarm_description   = "Database freeable memory is too low"
  alarm_actions       = var.alarm_sns_topic_arns

  dimensions = {
    DBInstanceIdentifier = aws_db_instance.main.identifier
  }

  tags = {
    Name        = "${var.project_name}-db-memory-alarm-${var.environment}"
    Project     = var.project_name
    Environment = var.environment
  }
}

resource "aws_cloudwatch_metric_alarm" "database_storage" {
  count               = var.enable_cloudwatch_alarms ? 1 : 0
  alarm_name          = "${var.project_name}-db-storage-${var.environment}"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = 1
  metric_name         = "FreeStorageSpace"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = var.free_storage_threshold
  alarm_description   = "Database free storage space is too low"
  alarm_actions       = var.alarm_sns_topic_arns

  dimensions = {
    DBInstanceIdentifier = aws_db_instance.main.identifier
  }

  tags = {
    Name        = "${var.project_name}-db-storage-alarm-${var.environment}"
    Project     = var.project_name
    Environment = var.environment
  }
}

resource "aws_cloudwatch_metric_alarm" "database_connections" {
  count               = var.enable_cloudwatch_alarms ? 1 : 0
  alarm_name          = "${var.project_name}-db-connections-${var.environment}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "DatabaseConnections"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = var.connection_threshold
  alarm_description   = "Database connection count is too high"
  alarm_actions       = var.alarm_sns_topic_arns

  dimensions = {
    DBInstanceIdentifier = aws_db_instance.main.identifier
  }

  tags = {
    Name        = "${var.project_name}-db-connections-alarm-${var.environment}"
    Project     = var.project_name
    Environment = var.environment
  }
}
