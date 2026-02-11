# Outputs for S3 Buckets Module

# -----------------------------------------------------------------------------
# Application Uploads Bucket Outputs
# -----------------------------------------------------------------------------

output "app_uploads_bucket_id" {
  description = "The name of the application uploads bucket"
  value       = aws_s3_bucket.app_uploads.id
}

output "app_uploads_bucket_arn" {
  description = "The ARN of the application uploads bucket"
  value       = aws_s3_bucket.app_uploads.arn
}

output "app_uploads_bucket_domain_name" {
  description = "The domain name of the application uploads bucket"
  value       = aws_s3_bucket.app_uploads.bucket_domain_name
}

output "app_uploads_bucket_regional_domain_name" {
  description = "The regional domain name of the application uploads bucket"
  value       = aws_s3_bucket.app_uploads.bucket_regional_domain_name
}

# -----------------------------------------------------------------------------
# ALB Logs Bucket Outputs
# -----------------------------------------------------------------------------

output "alb_logs_bucket_id" {
  description = "The name of the ALB logs bucket"
  value       = aws_s3_bucket.alb_logs.id
}

output "alb_logs_bucket_arn" {
  description = "The ARN of the ALB logs bucket"
  value       = aws_s3_bucket.alb_logs.arn
}

# -----------------------------------------------------------------------------
# CloudTrail Logs Bucket Outputs
# -----------------------------------------------------------------------------

output "cloudtrail_logs_bucket_id" {
  description = "The name of the CloudTrail logs bucket"
  value       = aws_s3_bucket.cloudtrail_logs.id
}

output "cloudtrail_logs_bucket_arn" {
  description = "The ARN of the CloudTrail logs bucket"
  value       = aws_s3_bucket.cloudtrail_logs.arn
}

# -----------------------------------------------------------------------------
# General Logs Bucket Outputs
# -----------------------------------------------------------------------------

output "logs_bucket_id" {
  description = "The name of the general logs bucket"
  value       = aws_s3_bucket.logs.id
}

output "logs_bucket_arn" {
  description = "The ARN of the general logs bucket"
  value       = aws_s3_bucket.logs.arn
}

# -----------------------------------------------------------------------------
# KMS Key Outputs
# -----------------------------------------------------------------------------

output "kms_key_id" {
  description = "The ID of the KMS key used for S3 encryption (if enabled)"
  value       = var.use_kms_encryption ? aws_kms_key.s3[0].id : null
}

output "kms_key_arn" {
  description = "The ARN of the KMS key used for S3 encryption (if enabled)"
  value       = var.use_kms_encryption ? aws_kms_key.s3[0].arn : null
}

output "kms_key_alias" {
  description = "The alias of the KMS key used for S3 encryption (if enabled)"
  value       = var.use_kms_encryption ? aws_kms_alias.s3[0].name : null
}

# -----------------------------------------------------------------------------
# Summary Output
# -----------------------------------------------------------------------------

output "buckets_summary" {
  description = "Summary of all S3 buckets created"
  value = {
    app_uploads = {
      id         = aws_s3_bucket.app_uploads.id
      arn        = aws_s3_bucket.app_uploads.arn
      versioning = var.enable_versioning
      encryption = var.use_kms_encryption ? "KMS" : "AES256"
    }
    alb_logs = {
      id         = aws_s3_bucket.alb_logs.id
      arn        = aws_s3_bucket.alb_logs.arn
      retention  = var.alb_logs_retention_days
      encryption = "AES256"
    }
    cloudtrail_logs = {
      id         = aws_s3_bucket.cloudtrail_logs.id
      arn        = aws_s3_bucket.cloudtrail_logs.arn
      retention  = var.cloudtrail_logs_retention_days
      encryption = "AES256"
    }
    general_logs = {
      id         = aws_s3_bucket.logs.id
      arn        = aws_s3_bucket.logs.arn
      retention  = var.general_logs_retention_days
      encryption = "AES256"
    }
  }
}
