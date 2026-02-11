# AWS Secrets Manager for Transparent Trust
#
# This module references existing secrets that must be created manually in AWS Secrets Manager.
# Secrets are NOT managed by Terraform to follow security best practices.
#
# To create secrets manually:
#   aws secretsmanager create-secret --name <secret-name> --secret-string '<value>'
#
# See docs/SECRET_MANAGEMENT.md for detailed instructions.

terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# -----------------------------------------------------------------------------
# Database Credentials Secret (managed by RDS module)
# -----------------------------------------------------------------------------

# Note: Database credentials are created and managed by the RDS module
# with automatic password rotation
data "aws_secretsmanager_secret" "database" {
  count = var.import_rds_secret ? 1 : 0
  name  = var.database_secret_name
}

# -----------------------------------------------------------------------------
# NextAuth Secret (manually created in AWS)
# -----------------------------------------------------------------------------

data "aws_secretsmanager_secret" "nextauth_secret" {
  count = var.reference_nextauth_secret ? 1 : 0
  name  = "${var.environment}/${var.project_name}-nextauth-secret"
}

# -----------------------------------------------------------------------------
# Anthropic API Key (manually created in AWS)
# -----------------------------------------------------------------------------

data "aws_secretsmanager_secret" "anthropic_api_key" {
  count = var.reference_anthropic_secret ? 1 : 0
  name  = "${var.environment}/${var.project_name}-anthropic-api-key"
}

# -----------------------------------------------------------------------------
# Google OAuth Credentials (manually created in AWS)
# -----------------------------------------------------------------------------

data "aws_secretsmanager_secret" "google_oauth" {
  count = var.reference_google_oauth_secret ? 1 : 0
  name  = "${var.environment}/${var.project_name}-google-oauth"
}

# -----------------------------------------------------------------------------
# Okta OAuth Credentials (manually created in AWS)
# -----------------------------------------------------------------------------

data "aws_secretsmanager_secret" "okta_oauth" {
  count = var.reference_okta_oauth_secret ? 1 : 0
  name  = "${var.environment}/${var.project_name}-okta-oauth"
}

# -----------------------------------------------------------------------------
# Upstash Redis Credentials (manually created in AWS)
# -----------------------------------------------------------------------------

data "aws_secretsmanager_secret" "upstash_redis" {
  count = var.reference_upstash_redis_secret ? 1 : 0
  name  = "${var.environment}/${var.project_name}-upstash-redis"
}

# -----------------------------------------------------------------------------
# Application Encryption Key (manually created in AWS)
# -----------------------------------------------------------------------------

data "aws_secretsmanager_secret" "encryption_key" {
  count = var.reference_encryption_key ? 1 : 0
  name  = "${var.environment}/${var.project_name}-encryption-key"
}

# -----------------------------------------------------------------------------
# IAM Policy for Secrets Access
# -----------------------------------------------------------------------------

resource "aws_iam_policy" "secrets_access" {
  name        = "${var.project_name}-secrets-access-${var.environment}"
  path        = "/"
  description = "Allow access to ${var.project_name} secrets (${var.environment})"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "GetSecretValues"
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue",
          "secretsmanager:DescribeSecret"
        ]
        Resource = concat(
          var.reference_nextauth_secret ? [data.aws_secretsmanager_secret.nextauth_secret[0].arn] : [],
          var.reference_anthropic_secret ? [data.aws_secretsmanager_secret.anthropic_api_key[0].arn] : [],
          var.reference_google_oauth_secret ? [data.aws_secretsmanager_secret.google_oauth[0].arn] : [],
          var.reference_okta_oauth_secret ? [data.aws_secretsmanager_secret.okta_oauth[0].arn] : [],
          var.reference_upstash_redis_secret ? [data.aws_secretsmanager_secret.upstash_redis[0].arn] : [],
          var.reference_encryption_key ? [data.aws_secretsmanager_secret.encryption_key[0].arn] : [],
          var.import_rds_secret ? [data.aws_secretsmanager_secret.database[0].arn] : []
        )
      },
      {
        Sid    = "DecryptSecrets"
        Effect = "Allow"
        Action = [
          "kms:Decrypt",
          "kms:DescribeKey"
        ]
        Resource = var.kms_key_arn != "" ? [var.kms_key_arn] : ["*"]
        Condition = {
          StringEquals = {
            "kms:ViaService" = "secretsmanager.${data.aws_region.current.name}.amazonaws.com"
          }
        }
      }
    ]
  })

  tags = merge(
    var.tags,
    {
      Name        = "${var.project_name}-secrets-access-${var.environment}"
      Environment = var.environment
    }
  )
}

# Attach policy to application role
resource "aws_iam_role_policy_attachment" "secrets_access" {
  count = var.app_role_name != "" ? 1 : 0

  role       = var.app_role_name
  policy_arn = aws_iam_policy.secrets_access.arn
}

# -----------------------------------------------------------------------------
# CloudWatch Alarms for Secret Access
# -----------------------------------------------------------------------------

resource "aws_cloudwatch_metric_alarm" "secret_access_denied" {
  count = var.enable_cloudwatch_alarms ? 1 : 0

  alarm_name          = "${var.project_name}-secret-access-denied-${var.environment}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "UserErrorCount"
  namespace           = "AWS/SecretsManager"
  period              = "300"
  statistic           = "Sum"
  threshold           = "5"
  alarm_description   = "Alert when secret access is denied multiple times"
  alarm_actions       = var.alarm_sns_topic_arn != "" ? [var.alarm_sns_topic_arn] : []

  tags = var.tags
}

# -----------------------------------------------------------------------------
# Data Sources
# -----------------------------------------------------------------------------

data "aws_region" "current" {}
data "aws_caller_identity" "current" {}
