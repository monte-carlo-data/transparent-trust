# RDS Enhanced Monitoring Role
# This role allows RDS to send enhanced monitoring metrics to CloudWatch
# Reference: SEC-1046 - IAM Roles for Application Services
# AWS Documentation: https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_Monitoring.OS.html

resource "aws_iam_role" "rds_enhanced_monitoring" {
  name        = "transparent-trust-rds-monitoring-role"
  description = "IAM role for RDS Enhanced Monitoring to publish metrics to CloudWatch"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "monitoring.rds.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })

  tags = {
    Project     = "${var.project_name}"
    Environment = var.environment
    ManagedBy   = "terraform"
    Purpose     = "RDS enhanced monitoring"
  }
}

# Attach AWS managed policy for RDS enhanced monitoring
resource "aws_iam_role_policy_attachment" "rds_enhanced_monitoring_policy" {
  role       = aws_iam_role.rds_enhanced_monitoring.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonRDSEnhancedMonitoringRole"
}

# Output the role ARN for use in RDS instance configuration
output "rds_enhanced_monitoring_role_arn" {
  description = "ARN of the RDS enhanced monitoring role - use this when creating RDS instances"
  value       = aws_iam_role.rds_enhanced_monitoring.arn
}

output "rds_enhanced_monitoring_role_name" {
  description = "Name of the RDS enhanced monitoring role"
  value       = aws_iam_role.rds_enhanced_monitoring.name
}
