# Outputs for Secrets Manager Module

# -----------------------------------------------------------------------------
# Secret ARNs (for referencing in other modules)
# -----------------------------------------------------------------------------

output "nextauth_secret_arn" {
  description = "ARN of the NextAuth.js secret"
  value       = var.reference_nextauth_secret ? data.aws_secretsmanager_secret.nextauth_secret[0].arn : null
  sensitive   = true
}

output "anthropic_api_key_arn" {
  description = "ARN of the Anthropic API key secret"
  value       = var.reference_anthropic_secret ? data.aws_secretsmanager_secret.anthropic_api_key[0].arn : null
  sensitive   = true
}

output "google_oauth_arn" {
  description = "ARN of the Google OAuth credentials secret"
  value       = var.reference_google_oauth_secret ? data.aws_secretsmanager_secret.google_oauth[0].arn : null
  sensitive   = true
}

output "okta_oauth_arn" {
  description = "ARN of the Okta OAuth credentials secret"
  value       = var.reference_okta_oauth_secret ? data.aws_secretsmanager_secret.okta_oauth[0].arn : null
  sensitive   = true
}

output "upstash_redis_arn" {
  description = "ARN of the Upstash Redis credentials secret"
  value       = var.reference_upstash_redis_secret ? data.aws_secretsmanager_secret.upstash_redis[0].arn : null
  sensitive   = true
}

output "encryption_key_arn" {
  description = "ARN of the application encryption key secret"
  value       = var.reference_encryption_key ? data.aws_secretsmanager_secret.encryption_key[0].arn : null
  sensitive   = true
}

output "database_secret_arn" {
  description = "ARN of the database credentials secret (RDS-managed)"
  value       = var.import_rds_secret ? data.aws_secretsmanager_secret.database[0].arn : null
  sensitive   = true
}

# -----------------------------------------------------------------------------
# IAM Policy
# -----------------------------------------------------------------------------

output "secrets_access_policy_arn" {
  description = "ARN of the IAM policy for secrets access"
  value       = aws_iam_policy.secrets_access.arn
}

output "secrets_access_policy_name" {
  description = "Name of the IAM policy for secrets access"
  value       = aws_iam_policy.secrets_access.name
}
