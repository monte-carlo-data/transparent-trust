# Security Groups for Transparent Trust
# Reference: SEC-1053 - Security Groups and NACLs
# Creates security groups for ALB, ECS, RDS, and ElastiCache with least privilege rules

# Data source for VPC (assumes VPC module has been applied)
variable "vpc_id" {
  description = "VPC ID where security groups will be created"
  type        = string
}

# Application Load Balancer Security Group
# Internal ALB for Tailscale-only access
resource "aws_security_group" "alb" {
  name        = "${var.project_name}-alb-sg-${var.environment}"
  description = "Security group for Internal ALB - allows HTTPS from VPC only (Tailscale access)"
  vpc_id      = var.vpc_id

  tags = {
    Name        = "${var.project_name}-alb-sg-${var.environment}"
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "terraform"
    Purpose     = "Internal ALB for Tailscale"
  }
}

# ALB Ingress Rules - VPC Only (Tailscale will route through VPC)
resource "aws_vpc_security_group_ingress_rule" "alb_https_vpc" {
  security_group_id = aws_security_group.alb.id
  description       = "Allow HTTPS traffic from VPC (Tailscale access)"

  cidr_ipv4   = var.vpc_cidr # Only from VPC CIDR (Tailscale routes through VPC)
  from_port   = 443
  to_port     = 443
  ip_protocol = "tcp"

  tags = {
    Name = "allow-https-from-vpc"
  }
}

resource "aws_vpc_security_group_ingress_rule" "alb_http_vpc" {
  count             = var.allow_http_to_alb ? 1 : 0
  security_group_id = aws_security_group.alb.id
  description       = "Allow HTTP traffic from VPC (redirects to HTTPS)"

  cidr_ipv4   = var.vpc_cidr # Only from VPC CIDR
  from_port   = 80
  to_port     = 80
  ip_protocol = "tcp"

  tags = {
    Name = "allow-http-from-vpc"
  }
}

# ALB Ingress Rules - App Connector VPC (for Tailscale example.com routing)
resource "aws_vpc_security_group_ingress_rule" "alb_https_app_connector" {
  count             = var.app_connector_vpc_cidr != "" ? 1 : 0
  security_group_id = aws_security_group.alb.id
  description       = "Allow HTTPS traffic from Tailscale app connector VPC"

  cidr_ipv4   = var.app_connector_vpc_cidr
  from_port   = 443
  to_port     = 443
  ip_protocol = "tcp"

  tags = {
    Name = "allow-https-from-app-connector"
  }
}

resource "aws_vpc_security_group_ingress_rule" "alb_http_app_connector" {
  count             = var.allow_http_to_alb && var.app_connector_vpc_cidr != "" ? 1 : 0
  security_group_id = aws_security_group.alb.id
  description       = "Allow HTTP traffic from Tailscale app connector VPC (redirects to HTTPS)"

  cidr_ipv4   = var.app_connector_vpc_cidr
  from_port   = 80
  to_port     = 80
  ip_protocol = "tcp"

  tags = {
    Name = "allow-http-from-app-connector"
  }
}

# ALB Egress Rules
resource "aws_vpc_security_group_egress_rule" "alb_to_app" {
  security_group_id = aws_security_group.alb.id
  description       = "Allow traffic to application containers"

  referenced_security_group_id = aws_security_group.app.id
  from_port                    = var.app_port
  to_port                      = var.app_port
  ip_protocol                  = "tcp"

  tags = {
    Name = "allow-to-app-containers"
  }
}

# Application/ECS Security Group
resource "aws_security_group" "app" {
  name        = "${var.project_name}-app-sg-${var.environment}"
  description = "Security group for ECS application containers - allows traffic from ALB only"
  vpc_id      = var.vpc_id

  tags = {
    Name        = "${var.project_name}-app-sg-${var.environment}"
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "terraform"
    Purpose     = "Application"
  }
}

# App Ingress Rules
resource "aws_vpc_security_group_ingress_rule" "app_from_alb" {
  security_group_id = aws_security_group.app.id
  description       = "Allow traffic from ALB"

  referenced_security_group_id = aws_security_group.alb.id
  from_port                    = var.app_port
  to_port                      = var.app_port
  ip_protocol                  = "tcp"

  tags = {
    Name = "allow-from-alb"
  }
}

# App Egress Rules
resource "aws_vpc_security_group_egress_rule" "app_to_internet" {
  security_group_id = aws_security_group.app.id
  description       = "Allow outbound internet access (for API calls, package downloads)"

  cidr_ipv4   = "0.0.0.0/0"
  ip_protocol = "-1"

  tags = {
    Name = "allow-outbound-internet"
  }
}

resource "aws_vpc_security_group_egress_rule" "app_to_rds" {
  security_group_id = aws_security_group.app.id
  description       = "Allow traffic to RDS PostgreSQL"

  referenced_security_group_id = aws_security_group.rds.id
  from_port                    = 5432
  to_port                      = 5432
  ip_protocol                  = "tcp"

  tags = {
    Name = "allow-to-rds"
  }
}

resource "aws_vpc_security_group_egress_rule" "app_to_redis" {
  count             = var.enable_redis ? 1 : 0
  security_group_id = aws_security_group.app.id
  description       = "Allow traffic to ElastiCache Redis"

  referenced_security_group_id = aws_security_group.redis[0].id
  from_port                    = 6379
  to_port                      = 6379
  ip_protocol                  = "tcp"

  tags = {
    Name = "allow-to-redis"
  }
}

# RDS Security Group
resource "aws_security_group" "rds" {
  name        = "${var.project_name}-rds-sg-${var.environment}"
  description = "Security group for RDS PostgreSQL - allows traffic from app only"
  vpc_id      = var.vpc_id

  tags = {
    Name        = "${var.project_name}-rds-sg-${var.environment}"
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "terraform"
    Purpose     = "RDS"
  }
}

# RDS Ingress Rules
resource "aws_vpc_security_group_ingress_rule" "rds_from_app" {
  security_group_id = aws_security_group.rds.id
  description       = "Allow PostgreSQL traffic from application"

  referenced_security_group_id = aws_security_group.app.id
  from_port                    = 5432
  to_port                      = 5432
  ip_protocol                  = "tcp"

  tags = {
    Name = "allow-postgres-from-app"
  }
}

# RDS Ingress from ECS Tasks (for migrations and background jobs)
resource "aws_vpc_security_group_ingress_rule" "rds_from_ecs_tasks" {
  security_group_id = aws_security_group.rds.id
  description       = "Allow PostgreSQL traffic from ECS tasks (migrations, workers)"

  cidr_ipv4   = var.vpc_cidr
  from_port   = 5432
  to_port     = 5432
  ip_protocol = "tcp"

  tags = {
    Name = "allow-postgres-from-ecs-tasks"
  }
}

# RDS Egress Rules (none needed - RDS doesn't initiate outbound connections)

# ElastiCache Redis Security Group
resource "aws_security_group" "redis" {
  count       = var.enable_redis ? 1 : 0
  name        = "${var.project_name}-redis-sg-${var.environment}"
  description = "Security group for ElastiCache Redis - allows traffic from app only"
  vpc_id      = var.vpc_id

  tags = {
    Name        = "${var.project_name}-redis-sg-${var.environment}"
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "terraform"
    Purpose     = "Redis"
  }
}

# Redis Ingress Rules
resource "aws_vpc_security_group_ingress_rule" "redis_from_app" {
  count             = var.enable_redis ? 1 : 0
  security_group_id = aws_security_group.redis[0].id
  description       = "Allow Redis traffic from application"

  referenced_security_group_id = aws_security_group.app.id
  from_port                    = 6379
  to_port                      = 6379
  ip_protocol                  = "tcp"

  tags = {
    Name = "allow-redis-from-app"
  }
}

# Redis Egress Rules (none needed - Redis doesn't initiate outbound connections)

# Optional: VPC Endpoints Security Group (for AWS services like S3, Secrets Manager)
resource "aws_security_group" "vpc_endpoints" {
  count       = var.enable_vpc_endpoints ? 1 : 0
  name        = "${var.project_name}-vpc-endpoints-sg-${var.environment}"
  description = "Security group for VPC endpoints - allows traffic from app"
  vpc_id      = var.vpc_id

  tags = {
    Name        = "${var.project_name}-vpc-endpoints-sg-${var.environment}"
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "terraform"
    Purpose     = "VPC Endpoints"
  }
}

resource "aws_vpc_security_group_ingress_rule" "vpc_endpoints_from_app" {
  count             = var.enable_vpc_endpoints ? 1 : 0
  security_group_id = aws_security_group.vpc_endpoints[0].id
  description       = "Allow HTTPS traffic from application to VPC endpoints"

  referenced_security_group_id = aws_security_group.app.id
  from_port                    = 443
  to_port                      = 443
  ip_protocol                  = "tcp"

  tags = {
    Name = "allow-https-from-app"
  }
}
