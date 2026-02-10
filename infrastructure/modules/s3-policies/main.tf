# S3 IAM Policies for Transparent RFP Copilot
#
# This module creates IAM policies for S3 bucket access with least privilege principles

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
# Application S3 Access Policy
# -----------------------------------------------------------------------------

# IAM policy for application to access S3 buckets
resource "aws_iam_policy" "app_s3_access" {
  name        = "${var.project_name}-app-s3-access-${var.environment}"
  path        = "/"
  description = "IAM policy for ${var.project_name} application S3 access (${var.environment})"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = concat(
      [
        # Application uploads bucket - full access
        {
          Sid    = "AppUploadsBucketFullAccess"
          Effect = "Allow"
          Action = [
            "s3:PutObject",
            "s3:GetObject",
            "s3:DeleteObject",
            "s3:ListBucket",
            "s3:GetObjectVersion",
            "s3:DeleteObjectVersion"
          ]
          Resource = [
            var.app_uploads_bucket_arn,
            "${var.app_uploads_bucket_arn}/*"
          ]
        },
        # Generate presigned URLs
        {
          Sid    = "GeneratePresignedUrls"
          Effect = "Allow"
          Action = [
            "s3:GetObject",
            "s3:PutObject"
          ]
          Resource = "${var.app_uploads_bucket_arn}/*"
          Condition = {
            StringEquals = {
              "s3:x-amz-server-side-encryption" = var.use_kms_encryption ? "aws:kms" : "AES256"
            }
          }
        }
      ],
      # KMS access if using KMS encryption
      var.use_kms_encryption ? [{
        Sid    = "KMSAccess"
        Effect = "Allow"
        Action = [
          "kms:Decrypt",
          "kms:GenerateDataKey",
          "kms:DescribeKey"
        ]
        Resource = var.kms_key_arn
      }] : []
    )
  })

  tags = merge(
    var.tags,
    {
      Name        = "${var.project_name}-app-s3-access-${var.environment}"
      Environment = var.environment
    }
  )
}

# Attach policy to application role
resource "aws_iam_role_policy_attachment" "app_s3_access" {
  count = var.app_role_name != "" ? 1 : 0

  role       = var.app_role_name
  policy_arn = aws_iam_policy.app_s3_access.arn
}

# -----------------------------------------------------------------------------
# Read-Only S3 Access Policy (for analytics, reporting)
# -----------------------------------------------------------------------------

resource "aws_iam_policy" "s3_readonly_access" {
  count = var.create_readonly_policy ? 1 : 0

  name        = "${var.project_name}-s3-readonly-${var.environment}"
  path        = "/"
  description = "Read-only access to ${var.project_name} S3 buckets (${var.environment})"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = concat(
      [
        {
          Sid    = "S3ReadOnlyAccess"
          Effect = "Allow"
          Action = [
            "s3:GetObject",
            "s3:GetObjectVersion",
            "s3:ListBucket",
            "s3:GetBucketLocation",
            "s3:GetBucketVersioning"
          ]
          Resource = [
            var.app_uploads_bucket_arn,
            "${var.app_uploads_bucket_arn}/*"
          ]
        }
      ],
      var.use_kms_encryption ? [{
        Sid    = "KMSDecryptOnly"
        Effect = "Allow"
        Action = [
          "kms:Decrypt",
          "kms:DescribeKey"
        ]
        Resource = var.kms_key_arn
      }] : []
    )
  })

  tags = merge(
    var.tags,
    {
      Name        = "${var.project_name}-s3-readonly-${var.environment}"
      Environment = var.environment
    }
  )
}

# -----------------------------------------------------------------------------
# Lambda S3 Access Policy (for file processing)
# -----------------------------------------------------------------------------

resource "aws_iam_policy" "lambda_s3_access" {
  count = var.create_lambda_policy ? 1 : 0

  name        = "${var.project_name}-lambda-s3-access-${var.environment}"
  path        = "/"
  description = "Lambda function S3 access for ${var.project_name} (${var.environment})"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = concat(
      [
        {
          Sid    = "LambdaS3Access"
          Effect = "Allow"
          Action = [
            "s3:GetObject",
            "s3:PutObject",
            "s3:ListBucket"
          ]
          Resource = [
            var.app_uploads_bucket_arn,
            "${var.app_uploads_bucket_arn}/*"
          ]
        }
      ],
      var.use_kms_encryption ? [{
        Sid    = "KMSAccessForLambda"
        Effect = "Allow"
        Action = [
          "kms:Decrypt",
          "kms:GenerateDataKey"
        ]
        Resource = var.kms_key_arn
      }] : []
    )
  })

  tags = merge(
    var.tags,
    {
      Name        = "${var.project_name}-lambda-s3-access-${var.environment}"
      Environment = var.environment
    }
  )
}

# -----------------------------------------------------------------------------
# Backup/Replication Policy
# -----------------------------------------------------------------------------

resource "aws_iam_policy" "s3_replication_policy" {
  count = var.enable_replication ? 1 : 0

  name        = "${var.project_name}-s3-replication-${var.environment}"
  path        = "/"
  description = "S3 replication policy for ${var.project_name} (${var.environment})"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = concat(
      [
        {
          Sid    = "ReplicationSourceRead"
          Effect = "Allow"
          Action = [
            "s3:GetReplicationConfiguration",
            "s3:ListBucket",
            "s3:GetObjectVersionForReplication",
            "s3:GetObjectVersionAcl"
          ]
          Resource = [
            var.app_uploads_bucket_arn,
            "${var.app_uploads_bucket_arn}/*"
          ]
        },
        {
          Sid    = "ReplicationDestinationWrite"
          Effect = "Allow"
          Action = [
            "s3:ReplicateObject",
            "s3:ReplicateDelete",
            "s3:ReplicateTags"
          ]
          Resource = "${var.replication_destination_bucket_arn}/*"
        }
      ],
      var.use_kms_encryption ? [{
        Sid    = "KMSReplicationAccess"
        Effect = "Allow"
        Action = [
          "kms:Decrypt",
          "kms:DescribeKey"
        ]
        Resource = var.kms_key_arn
      }] : [],
      var.use_kms_encryption && var.replication_destination_kms_key_arn != "" ? [{
        Sid    = "KMSDestinationEncrypt"
        Effect = "Allow"
        Action = [
          "kms:Encrypt",
          "kms:GenerateDataKey"
        ]
        Resource = var.replication_destination_kms_key_arn
      }] : []
    )
  })

  tags = merge(
    var.tags,
    {
      Name        = "${var.project_name}-s3-replication-${var.environment}"
      Environment = var.environment
    }
  )
}

# IAM role for S3 replication
resource "aws_iam_role" "s3_replication_role" {
  count = var.enable_replication ? 1 : 0

  name = "${var.project_name}-s3-replication-role-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "s3.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })

  tags = merge(
    var.tags,
    {
      Name        = "${var.project_name}-s3-replication-role-${var.environment}"
      Environment = var.environment
    }
  )
}

resource "aws_iam_role_policy_attachment" "s3_replication_policy_attachment" {
  count = var.enable_replication ? 1 : 0

  role       = aws_iam_role.s3_replication_role[0].name
  policy_arn = aws_iam_policy.s3_replication_policy[0].arn
}

# -----------------------------------------------------------------------------
# Bucket Policy for Application Uploads (resource-based policy)
# -----------------------------------------------------------------------------

resource "aws_s3_bucket_policy" "app_uploads_policy" {
  count = var.create_bucket_policies ? 1 : 0

  bucket = var.app_uploads_bucket_id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = concat(
      [
        # Enforce SSL/TLS
        {
          Sid       = "EnforceSSLOnly"
          Effect    = "Deny"
          Principal = "*"
          Action    = "s3:*"
          Resource = [
            var.app_uploads_bucket_arn,
            "${var.app_uploads_bucket_arn}/*"
          ]
          Condition = {
            Bool = {
              "aws:SecureTransport" = "false"
            }
          }
        },
        # Enforce encryption
        {
          Sid       = "DenyUnencryptedObjectUploads"
          Effect    = "Deny"
          Principal = "*"
          Action    = "s3:PutObject"
          Resource  = "${var.app_uploads_bucket_arn}/*"
          Condition = {
            StringNotEquals = {
              "s3:x-amz-server-side-encryption" = var.use_kms_encryption ? "aws:kms" : "AES256"
            }
          }
        }
      ],
      # Application role access
      var.app_role_arn != "" ? [{
        Sid    = "ApplicationRoleAccess"
        Effect = "Allow"
        Principal = {
          AWS = var.app_role_arn
        }
        Action = [
          "s3:PutObject",
          "s3:GetObject",
          "s3:DeleteObject",
          "s3:ListBucket"
        ]
        Resource = [
          var.app_uploads_bucket_arn,
          "${var.app_uploads_bucket_arn}/*"
        ]
      }] : []
    )
  })
}

# -----------------------------------------------------------------------------
# S3 Access Point (optional, for advanced access control)
# -----------------------------------------------------------------------------

resource "aws_s3_access_point" "app_uploads_access_point" {
  count = var.create_access_point ? 1 : 0

  bucket = var.app_uploads_bucket_id
  name   = "${var.project_name}-uploads-ap-${var.environment}"

  public_access_block_configuration {
    block_public_acls       = true
    block_public_policy     = true
    ignore_public_acls      = true
    restrict_public_buckets = true
  }

  # VPC configuration (optional)
  dynamic "vpc_configuration" {
    for_each = var.access_point_vpc_id != "" ? [1] : []
    content {
      vpc_id = var.access_point_vpc_id
    }
  }
}

resource "aws_s3control_access_point_policy" "app_uploads_access_point_policy" {
  count = var.create_access_point ? 1 : 0

  access_point_arn = aws_s3_access_point.app_uploads_access_point[0].arn

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          AWS = var.app_role_arn
        }
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject"
        ]
        Resource = "${aws_s3_access_point.app_uploads_access_point[0].arn}/object/*"
      }
    ]
  })
}

# -----------------------------------------------------------------------------
# Data Sources
# -----------------------------------------------------------------------------

data "aws_caller_identity" "current" {}

data "aws_region" "current" {}
