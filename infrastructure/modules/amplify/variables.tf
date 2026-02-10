# Variables for AWS Amplify Infrastructure
# Reference: SEC-1048 - AWS Amplify deployment

# =========================================
# General Configuration
# =========================================

variable "project_name" {
  description = "Name of the project (used for resource naming)"
  type        = string
  default     = "transparent-trust"
}

variable "environment" {
  description = "Environment name (e.g., production, staging, development)"
  type        = string
  default     = "production"
}

variable "tags" {
  description = "Additional tags to apply to all resources"
  type        = map(string)
  default = {
    Project   = "transparent-trust"
    ManagedBy = "terraform"
    Component = "amplify"
  }
}

# =========================================
# Repository Configuration
# =========================================

variable "repository_url" {
  description = "GitHub repository URL (e.g., https://github.com/org/repo)"
  type        = string
}

variable "github_access_token" {
  description = "GitHub personal access token for repository access"
  type        = string
  sensitive   = true
}

# =========================================
# IAM Configuration
# =========================================

variable "amplify_service_role_arn" {
  description = "ARN of the IAM role for Amplify service (needs access to secrets, S3, etc.)"
  type        = string
}

# =========================================
# Build Configuration
# =========================================

variable "custom_build_spec" {
  description = "Custom build specification (leave empty to use default Next.js build)"
  type        = string
  default     = ""
}

# =========================================
# Environment Variables
# =========================================

variable "environment_variables" {
  description = "Environment variables for the Amplify app (non-sensitive)"
  type        = map(string)
  default     = {}
}

# Note: Sensitive environment variables should be stored in AWS Systems Manager Parameter Store
# and referenced with the AMPLIFY_ prefix. For example:
# - Store secret in Parameter Store as: /amplify/transparent-trust/production/NEXTAUTH_SECRET
# - Reference in Amplify as environment variable: AMPLIFY_NEXTAUTH_SECRET = /amplify/transparent-trust/production/NEXTAUTH_SECRET

# =========================================
# Branch Configuration
# =========================================

variable "main_branch_name" {
  description = "Name of the main branch to deploy (e.g., main, master)"
  type        = string
  default     = "main"
}

variable "main_branch_environment_variables" {
  description = "Environment variables specific to the main branch"
  type        = map(string)
  default     = {}
}

variable "additional_branches" {
  description = "Additional branches to deploy (e.g., staging, development)"
  type = map(object({
    enable_auto_build     = optional(bool, true)
    stage                 = optional(string, "DEVELOPMENT")
    environment_variables = optional(map(string), {})
    enable_pr_previews    = optional(bool, false)
    pr_environment_name   = optional(string, "pr")
    enable_basic_auth     = optional(bool, true)
  }))
  default = {}
}

variable "enable_branch_auto_build" {
  description = "Enable automatic builds when code is pushed"
  type        = bool
  default     = true
}

variable "enable_branch_auto_deletion" {
  description = "Enable automatic deletion of branches when deleted from repository"
  type        = bool
  default     = true
}

variable "enable_auto_branch_creation" {
  description = "Enable automatic creation of branches"
  type        = bool
  default     = false
}

variable "auto_branch_creation_patterns" {
  description = "Patterns for auto branch creation (e.g., ['feature/*', 'release/*'])"
  type        = list(string)
  default     = []
}

# =========================================
# Pull Request Previews
# =========================================

variable "enable_pr_previews" {
  description = "Enable pull request preview deployments"
  type        = bool
  default     = true
}

variable "pr_environment_name" {
  description = "Environment name for pull request previews"
  type        = string
  default     = "pr"
}

# =========================================
# Basic Authentication
# =========================================

variable "enable_basic_auth_for_main" {
  description = "Enable basic auth for main branch (not recommended for production)"
  type        = bool
  default     = false
}

variable "enable_basic_auth_for_branches" {
  description = "Enable basic auth for auto-created branches"
  type        = bool
  default     = true
}

variable "basic_auth_username" {
  description = "Username for basic authentication"
  type        = string
  default     = "admin"
  sensitive   = true
}

variable "basic_auth_password" {
  description = "Password for basic authentication"
  type        = string
  sensitive   = true
}

# =========================================
# Custom Domain Configuration
# =========================================

variable "custom_domain" {
  description = "Custom domain for the Amplify app (leave empty to use amplifyapp.com subdomain)"
  type        = string
  default     = ""
}

variable "domain_prefix" {
  description = "Subdomain prefix for the main branch (e.g., 'www' or '' for apex domain)"
  type        = string
  default     = ""
}

variable "wait_for_domain_verification" {
  description = "Wait for domain verification before completing"
  type        = bool
  default     = true
}

variable "domain_branch_mappings" {
  description = "Mapping of branches to domain prefixes"
  type = list(object({
    branch_name = string
    prefix      = string
  }))
  default = []
  # Example:
  # [
  #   { branch_name = "staging", prefix = "staging" },
  #   { branch_name = "develop", prefix = "dev" }
  # ]
}

# =========================================
# Custom Rules (Routing)
# =========================================

variable "custom_rules" {
  description = "Custom rewrite and redirect rules"
  type = list(object({
    source = string
    target = string
    status = optional(string)
  }))
  default = []
  # Example:
  # [
  #   { source = "/api/<*>", target = "https://api.example.com/<*>", status = "200" }
  # ]
}

# =========================================
# Webhook Configuration
# =========================================

variable "create_webhook" {
  description = "Create a webhook for manual deployments"
  type        = bool
  default     = false
}

# =========================================
# Monitoring & Alarms
# =========================================

variable "enable_alarms" {
  description = "Enable CloudWatch alarms for Amplify"
  type        = bool
  default     = true
}

variable "alarm_sns_topic_arn" {
  description = "ARN of SNS topic for alarm notifications"
  type        = string
  default     = ""
}

variable "deployment_duration_threshold" {
  description = "Threshold in seconds for deployment duration alarm"
  type        = number
  default     = 600
}
