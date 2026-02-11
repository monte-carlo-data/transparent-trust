# Application Runtime Role (Task Role)
# This role is used by the application container at runtime
# Provides access to RDS, S3, Secrets Manager, and CloudWatch
# Reference: SEC-1046 - IAM Roles for Application Services

resource "aws_iam_role" "app_runtime_role" {
  name        = "transparent-trust-app-runtime-role"
  description = "Runtime role for the Transparent Trust application with access to RDS, S3, Secrets Manager, and CloudWatch"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })

  tags = {
    Project     = "${var.project_name}"
    Environment = var.environment
    ManagedBy   = "terraform"
    Purpose     = "Application runtime"
  }
}

# S3 Access Policy - File uploads and downloads
resource "aws_iam_role_policy" "app_s3_access" {
  name = "transparent-trust-app-s3-policy"
  role = aws_iam_role.app_runtime_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject",
          "s3:ListBucket"
        ]
        Resource = [
          "arn:aws:s3:::transparent-trust-uploads-${var.environment}",
          "arn:aws:s3:::transparent-trust-uploads-${var.environment}/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "s3:GetBucketLocation",
          "s3:ListBucket"
        ]
        Resource = [
          "arn:aws:s3:::transparent-trust-uploads-${var.environment}"
        ]
      }
    ]
  })
}

# Secrets Manager Access Policy - Read application secrets
resource "aws_iam_role_policy" "app_secrets_access" {
  name = "transparent-trust-app-secrets-policy"
  role = aws_iam_role.app_runtime_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue",
          "secretsmanager:DescribeSecret",
          "secretsmanager:PutSecretValue"
        ]
        Resource = [
          "arn:aws:secretsmanager:${var.aws_region}:${data.aws_caller_identity.current.account_id}:secret:transparent-trust*",
          "arn:aws:secretsmanager:${var.aws_region}:${data.aws_caller_identity.current.account_id}:secret:${var.environment}/transparent-trust-*",
          "arn:aws:secretsmanager:${var.aws_region}:${data.aws_caller_identity.current.account_id}:secret:rds!*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "kms:Decrypt",
          "kms:DescribeKey"
        ]
        Resource = [
          "arn:aws:kms:${var.aws_region}:${data.aws_caller_identity.current.account_id}:key/*"
        ]
        Condition = {
          StringEquals = {
            "kms:ViaService" = "secretsmanager.${var.aws_region}.amazonaws.com"
          }
        }
      }
    ]
  })
}

# CloudWatch Logs Access Policy - Application logging
resource "aws_iam_role_policy" "app_cloudwatch_logs" {
  name = "transparent-trust-app-cloudwatch-policy"
  role = aws_iam_role.app_runtime_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents",
          "logs:DescribeLogStreams"
        ]
        Resource = [
          "arn:aws:logs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:log-group:/aws/ecs/transparent-trust-${var.environment}",
          "arn:aws:logs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:log-group:/aws/ecs/transparent-trust-${var.environment}:*"
        ]
      }
    ]
  })
}

# RDS Connect Policy - Database connections using IAM authentication (optional, but recommended)
resource "aws_iam_role_policy" "app_rds_connect" {
  name = "transparent-trust-app-rds-policy"
  role = aws_iam_role.app_runtime_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "rds-db:connect"
        ]
        Resource = [
          "arn:aws:rds-db:${var.aws_region}:${data.aws_caller_identity.current.account_id}:dbuser:*/*"
        ]
      }
    ]
  })
}

# Optional: CloudWatch Metrics - Custom application metrics
resource "aws_iam_role_policy" "app_cloudwatch_metrics" {
  name = "transparent-trust-app-metrics-policy"
  role = aws_iam_role.app_runtime_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "cloudwatch:PutMetricData"
        ]
        Resource = "*"
        Condition = {
          StringEquals = {
            "cloudwatch:namespace" = "TransparentTrust/${var.environment}"
          }
        }
      }
    ]
  })
}

# Optional: X-Ray Tracing - Distributed tracing (if enabled)
resource "aws_iam_role_policy" "app_xray_access" {
  count = var.enable_xray ? 1 : 0
  name  = "transparent-trust-app-xray-policy"
  role  = aws_iam_role.app_runtime_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "xray:PutTraceSegments",
          "xray:PutTelemetryRecords"
        ]
        Resource = "*"
      }
    ]
  })
}

# Output the role ARN for use in ECS task definitions
output "app_runtime_role_arn" {
  description = "ARN of the application runtime role"
  value       = aws_iam_role.app_runtime_role.arn
}

output "app_runtime_role_name" {
  description = "Name of the application runtime role"
  value       = aws_iam_role.app_runtime_role.name
}
