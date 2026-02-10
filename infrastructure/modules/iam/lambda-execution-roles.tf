# Lambda Execution Roles
# Optional roles for Lambda functions (e.g., async processing, scheduled tasks)
# Reference: SEC-1046 - IAM Roles for Application Services

# Base Lambda Execution Role
resource "aws_iam_role" "lambda_execution_role" {
  count       = var.enable_lambda ? 1 : 0
  name        = "transparent-trust-lambda-execution-role"
  description = "Execution role for Lambda functions with access to CloudWatch Logs"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })

  tags = {
    Project     = "${var.project_name}"
    Environment = var.environment
    ManagedBy   = "terraform"
    Purpose     = "Lambda execution"
  }
}

# Attach AWS managed policy for basic Lambda execution
resource "aws_iam_role_policy_attachment" "lambda_basic_execution" {
  count      = var.enable_lambda ? 1 : 0
  role       = aws_iam_role.lambda_execution_role[0].name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# Lambda role for VPC access (if Lambda needs to access RDS/ElastiCache)
resource "aws_iam_role_policy_attachment" "lambda_vpc_execution" {
  count      = var.enable_lambda && var.lambda_vpc_access ? 1 : 0
  role       = aws_iam_role.lambda_execution_role[0].name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole"
}

# Custom policy for Lambda to access Secrets Manager
resource "aws_iam_role_policy" "lambda_secrets_access" {
  count = var.enable_lambda ? 1 : 0
  name  = "transparent-trust-lambda-secrets-policy"
  role  = aws_iam_role.lambda_execution_role[0].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue"
        ]
        Resource = [
          "arn:aws:secretsmanager:${var.aws_region}:${data.aws_caller_identity.current.account_id}:secret:transparent-trust/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "kms:Decrypt"
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

# Custom policy for Lambda to access S3
resource "aws_iam_role_policy" "lambda_s3_access" {
  count = var.enable_lambda ? 1 : 0
  name  = "transparent-trust-lambda-s3-policy"
  role  = aws_iam_role.lambda_execution_role[0].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject"
        ]
        Resource = [
          "arn:aws:s3:::transparent-trust-uploads-${var.environment}/*"
        ]
      }
    ]
  })
}

# Lambda role for document processing (example use case)
resource "aws_iam_role" "lambda_document_processor_role" {
  count       = var.enable_lambda ? 1 : 0
  name        = "transparent-trust-lambda-doc-processor-role"
  description = "Role for Lambda functions processing uploaded documents"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })

  tags = {
    Project     = "${var.project_name}"
    Environment = var.environment
    ManagedBy   = "terraform"
    Purpose     = "Document processing Lambda"
  }
}

# Attach basic execution policy to document processor
resource "aws_iam_role_policy_attachment" "lambda_doc_processor_basic" {
  count      = var.enable_lambda ? 1 : 0
  role       = aws_iam_role.lambda_document_processor_role[0].name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# Custom policy for document processor Lambda
resource "aws_iam_role_policy" "lambda_doc_processor_custom" {
  count = var.enable_lambda ? 1 : 0
  name  = "transparent-trust-lambda-doc-processor-policy"
  role  = aws_iam_role.lambda_document_processor_role[0].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject"
        ]
        Resource = [
          "arn:aws:s3:::transparent-trust-uploads-${var.environment}/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "textract:DetectDocumentText",
          "textract:AnalyzeDocument"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue"
        ]
        Resource = [
          "arn:aws:secretsmanager:${var.aws_region}:${data.aws_caller_identity.current.account_id}:secret:transparent-trust/anthropic-api-key-*"
        ]
      }
    ]
  })
}

# Outputs
output "lambda_execution_role_arn" {
  description = "ARN of the Lambda execution role"
  value       = var.enable_lambda ? aws_iam_role.lambda_execution_role[0].arn : null
}

output "lambda_execution_role_name" {
  description = "Name of the Lambda execution role"
  value       = var.enable_lambda ? aws_iam_role.lambda_execution_role[0].name : null
}

output "lambda_document_processor_role_arn" {
  description = "ARN of the Lambda document processor role"
  value       = var.enable_lambda ? aws_iam_role.lambda_document_processor_role[0].arn : null
}
