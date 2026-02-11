# AWS Amplify Infrastructure for Transparent Trust
# Reference: SEC-1048 - AWS Amplify deployment (alternative to ECS/Fargate)

# =========================================
# Amplify App
# =========================================

resource "aws_amplify_app" "main" {
  name       = "${var.project_name}-${var.environment}"
  repository = var.repository_url

  # Build settings for Next.js
  build_spec = var.custom_build_spec != "" ? var.custom_build_spec : <<-EOT
    version: 1
    frontend:
      phases:
        preBuild:
          commands:
            - npm ci --legacy-peer-deps
            - npx prisma generate
        build:
          commands:
            - npm run build
      artifacts:
        baseDirectory: .next
        files:
          - '**/*'
      cache:
        paths:
          - node_modules/**/*
          - .next/cache/**/*
  EOT

  # Environment variables (non-sensitive)
  environment_variables = merge(
    {
      NODE_ENV        = var.environment == "production" ? "production" : "development"
      NEXT_PUBLIC_ENV = var.environment
      _LIVE_UPDATES   = "[{\"pkg\":\"next-version\",\"type\":\"internal\",\"version\":\"latest\"}]"
    },
    var.environment_variables
  )

  # OAuth token for GitHub access
  access_token = var.github_access_token

  # Enable auto branch creation
  enable_auto_branch_creation   = var.enable_auto_branch_creation
  auto_branch_creation_patterns = var.auto_branch_creation_patterns

  # Custom rules for routing
  dynamic "custom_rule" {
    for_each = var.custom_rules
    content {
      source = custom_rule.value.source
      target = custom_rule.value.target
      status = lookup(custom_rule.value, "status", null)
    }
  }

  # Default custom rules for Next.js
  custom_rule {
    source = "/<*>"
    target = "/index.html"
    status = "404-200"
  }

  custom_rule {
    source = "</^[^.]+$|\\.(?!(css|gif|ico|jpg|js|png|txt|svg|woff|woff2|ttf|map|json|webp)$)([^.]+$)/>"
    target = "/index.html"
    status = "200"
  }

  # IAM service role for Amplify
  iam_service_role_arn = var.amplify_service_role_arn

  # Platform (WEB for hosting)
  platform = "WEB_COMPUTE"

  # Enable branch auto-build
  enable_branch_auto_build = var.enable_branch_auto_build

  # Enable branch auto-deletion
  enable_branch_auto_deletion = var.enable_branch_auto_deletion

  # Basic auth for non-production branches
  dynamic "auto_branch_creation_config" {
    for_each = var.enable_basic_auth_for_branches ? [1] : []
    content {
      enable_auto_build           = true
      enable_basic_auth           = true
      basic_auth_credentials      = base64encode("${var.basic_auth_username}:${var.basic_auth_password}")
      enable_pull_request_preview = var.enable_pr_previews
    }
  }

  tags = merge(var.tags, {
    Name        = "${var.project_name}-amplify-${var.environment}"
    Environment = var.environment
  })
}

# =========================================
# Branch Configuration
# =========================================

resource "aws_amplify_branch" "main" {
  app_id      = aws_amplify_app.main.id
  branch_name = var.main_branch_name

  # Enable auto build on push
  enable_auto_build = true

  # Framework for the branch
  framework = "Next.js - SSR"

  # Stage (PRODUCTION, BETA, DEVELOPMENT, EXPERIMENTAL)
  stage = var.environment == "production" ? "PRODUCTION" : upper(var.environment)

  # Environment variables specific to this branch
  environment_variables = var.main_branch_environment_variables

  # Enable pull request previews
  enable_pull_request_preview = var.enable_pr_previews

  # Pull request environment name
  pull_request_environment_name = var.pr_environment_name

  # Basic auth (disabled for production)
  enable_basic_auth      = var.enable_basic_auth_for_main && var.environment != "production"
  basic_auth_credentials = var.enable_basic_auth_for_main && var.environment != "production" ? base64encode("${var.basic_auth_username}:${var.basic_auth_password}") : null

  tags = merge(var.tags, {
    Name        = "${var.project_name}-${var.main_branch_name}-${var.environment}"
    Environment = var.environment
    Branch      = var.main_branch_name
  })
}

# Additional branches (e.g., staging, development)
resource "aws_amplify_branch" "additional" {
  for_each = var.additional_branches

  app_id      = aws_amplify_app.main.id
  branch_name = each.key

  enable_auto_build = lookup(each.value, "enable_auto_build", true)
  framework         = "Next.js - SSR"
  stage             = lookup(each.value, "stage", "DEVELOPMENT")

  environment_variables = lookup(each.value, "environment_variables", {})

  enable_pull_request_preview   = lookup(each.value, "enable_pr_previews", false)
  pull_request_environment_name = lookup(each.value, "pr_environment_name", "pr")

  enable_basic_auth      = lookup(each.value, "enable_basic_auth", true)
  basic_auth_credentials = lookup(each.value, "enable_basic_auth", true) ? base64encode("${var.basic_auth_username}:${var.basic_auth_password}") : null

  tags = merge(var.tags, {
    Name        = "${var.project_name}-${each.key}-${var.environment}"
    Environment = var.environment
    Branch      = each.key
  })
}

# =========================================
# Custom Domain (Optional)
# =========================================

resource "aws_amplify_domain_association" "main" {
  count = var.custom_domain != "" ? 1 : 0

  app_id      = aws_amplify_app.main.id
  domain_name = var.custom_domain

  # Wait for certificate validation
  wait_for_verification = var.wait_for_domain_verification

  # Main branch subdomain
  sub_domain {
    branch_name = aws_amplify_branch.main.branch_name
    prefix      = var.domain_prefix
  }

  # Additional branch subdomains
  dynamic "sub_domain" {
    for_each = var.domain_branch_mappings
    content {
      branch_name = sub_domain.value.branch_name
      prefix      = sub_domain.value.prefix
    }
  }
}

# =========================================
# Webhook for Manual Deployments
# =========================================

resource "aws_amplify_webhook" "main" {
  count = var.create_webhook ? 1 : 0

  app_id      = aws_amplify_app.main.id
  branch_name = aws_amplify_branch.main.branch_name
  description = "Webhook for ${var.main_branch_name} branch deployments"
}

# =========================================
# CloudWatch Alarms for Amplify
# =========================================

resource "aws_cloudwatch_metric_alarm" "build_failures" {
  count = var.enable_alarms ? 1 : 0

  alarm_name          = "${var.project_name}-amplify-build-failures-${var.environment}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "BuildFailures"
  namespace           = "AWS/AmplifyHosting"
  period              = "300"
  statistic           = "Sum"
  threshold           = "0"
  alarm_description   = "Alert when Amplify builds fail"
  alarm_actions       = var.alarm_sns_topic_arn != "" ? [var.alarm_sns_topic_arn] : []

  dimensions = {
    App = aws_amplify_app.main.id
  }

  tags = merge(var.tags, {
    Name        = "${var.project_name}-build-failures-${var.environment}"
    Environment = var.environment
  })
}

resource "aws_cloudwatch_metric_alarm" "deployment_duration" {
  count = var.enable_alarms ? 1 : 0

  alarm_name          = "${var.project_name}-amplify-slow-deployment-${var.environment}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "DeploymentDuration"
  namespace           = "AWS/AmplifyHosting"
  period              = "300"
  statistic           = "Average"
  threshold           = var.deployment_duration_threshold
  alarm_description   = "Alert when Amplify deployments take too long"
  alarm_actions       = var.alarm_sns_topic_arn != "" ? [var.alarm_sns_topic_arn] : []

  dimensions = {
    App = aws_amplify_app.main.id
  }

  tags = merge(var.tags, {
    Name        = "${var.project_name}-slow-deployment-${var.environment}"
    Environment = var.environment
  })
}

# =========================================
# Backend Environment for Secrets (Optional)
# =========================================

# Note: Amplify backend environments are managed through Amplify Studio
# Secrets should be added via AWS Systems Manager Parameter Store
# and referenced in environment variables with prefix "AMPLIFY_"
