# Outputs for S3 Policies Module

# -----------------------------------------------------------------------------
# IAM Policy Outputs
# -----------------------------------------------------------------------------

output "app_s3_access_policy_arn" {
  description = "ARN of the application S3 access policy"
  value       = aws_iam_policy.app_s3_access.arn
}

output "app_s3_access_policy_name" {
  description = "Name of the application S3 access policy"
  value       = aws_iam_policy.app_s3_access.name
}

output "s3_readonly_policy_arn" {
  description = "ARN of the S3 read-only access policy (if created)"
  value       = var.create_readonly_policy ? aws_iam_policy.s3_readonly_access[0].arn : null
}

output "lambda_s3_policy_arn" {
  description = "ARN of the Lambda S3 access policy (if created)"
  value       = var.create_lambda_policy ? aws_iam_policy.lambda_s3_access[0].arn : null
}

output "s3_replication_policy_arn" {
  description = "ARN of the S3 replication policy (if created)"
  value       = var.enable_replication ? aws_iam_policy.s3_replication_policy[0].arn : null
}

# -----------------------------------------------------------------------------
# IAM Role Outputs
# -----------------------------------------------------------------------------

output "s3_replication_role_arn" {
  description = "ARN of the S3 replication IAM role (if created)"
  value       = var.enable_replication ? aws_iam_role.s3_replication_role[0].arn : null
}

output "s3_replication_role_name" {
  description = "Name of the S3 replication IAM role (if created)"
  value       = var.enable_replication ? aws_iam_role.s3_replication_role[0].name : null
}

# -----------------------------------------------------------------------------
# S3 Access Point Outputs
# -----------------------------------------------------------------------------

output "access_point_arn" {
  description = "ARN of the S3 Access Point (if created)"
  value       = var.create_access_point ? aws_s3_access_point.app_uploads_access_point[0].arn : null
}

output "access_point_alias" {
  description = "Alias of the S3 Access Point (if created)"
  value       = var.create_access_point ? aws_s3_access_point.app_uploads_access_point[0].alias : null
}

output "access_point_domain_name" {
  description = "Domain name of the S3 Access Point (if created)"
  value       = var.create_access_point ? "${aws_s3_access_point.app_uploads_access_point[0].name}-${data.aws_caller_identity.current.account_id}.s3-accesspoint.${var.access_point_vpc_id != "" ? "vpc-" : ""}${data.aws_region.current.name}.amazonaws.com" : null
}

# -----------------------------------------------------------------------------
# Summary Output
# -----------------------------------------------------------------------------

output "policies_summary" {
  description = "Summary of all S3 policies created"
  value = {
    app_access_policy = {
      arn  = aws_iam_policy.app_s3_access.arn
      name = aws_iam_policy.app_s3_access.name
    }
    readonly_policy = var.create_readonly_policy ? {
      arn  = aws_iam_policy.s3_readonly_access[0].arn
      name = aws_iam_policy.s3_readonly_access[0].name
    } : null
    lambda_policy = var.create_lambda_policy ? {
      arn  = aws_iam_policy.lambda_s3_access[0].arn
      name = aws_iam_policy.lambda_s3_access[0].name
    } : null
    replication_policy = var.enable_replication ? {
      arn       = aws_iam_policy.s3_replication_policy[0].arn
      role_arn  = aws_iam_role.s3_replication_role[0].arn
      role_name = aws_iam_role.s3_replication_role[0].name
    } : null
    access_point = var.create_access_point ? {
      arn   = aws_s3_access_point.app_uploads_access_point[0].arn
      alias = aws_s3_access_point.app_uploads_access_point[0].alias
    } : null
    bucket_policy_enforcements = var.create_bucket_policies ? [
      "SSL/TLS only",
      "Encryption enforcement",
      "Application role access only"
    ] : []
  }
}
