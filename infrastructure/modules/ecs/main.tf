# ECS/Fargate Infrastructure for Transparent Trust
# Reference: SEC-1047 - ECS/Fargate deployment

# =========================================
# ECS Cluster
# =========================================

resource "aws_ecs_cluster" "main" {
  name = "${var.project_name}-cluster-${var.environment}"

  setting {
    name  = "containerInsights"
    value = var.enable_container_insights ? "enabled" : "disabled"
  }

  tags = merge(var.tags, {
    Name        = "${var.project_name}-cluster-${var.environment}"
    Environment = var.environment
  })
}

# Container Insights for enhanced monitoring
resource "aws_ecs_cluster_capacity_providers" "main" {
  cluster_name = aws_ecs_cluster.main.name

  capacity_providers = ["FARGATE", "FARGATE_SPOT"]

  default_capacity_provider_strategy {
    capacity_provider = var.use_fargate_spot ? "FARGATE_SPOT" : "FARGATE"
    weight            = 100
    base              = 1
  }
}

# =========================================
# ECR Repository
# =========================================

resource "aws_ecr_repository" "app" {
  name                 = "${var.project_name}-${var.environment}"
  image_tag_mutability = var.ecr_image_tag_mutability

  image_scanning_configuration {
    scan_on_push = var.ecr_scan_on_push
  }

  encryption_configuration {
    encryption_type = "KMS"
    kms_key         = var.ecr_kms_key_arn != "" ? var.ecr_kms_key_arn : null
  }

  tags = merge(var.tags, {
    Name        = "${var.project_name}-ecr-${var.environment}"
    Environment = var.environment
  })
}

# Lifecycle policy for ECR to manage old images
resource "aws_ecr_lifecycle_policy" "app" {
  repository = aws_ecr_repository.app.name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Keep last ${var.ecr_image_count} images"
        selection = {
          tagStatus     = "tagged"
          tagPrefixList = ["v"]
          countType     = "imageCountMoreThan"
          countNumber   = var.ecr_image_count
        }
        action = {
          type = "expire"
        }
      },
      {
        rulePriority = 2
        description  = "Remove untagged images after ${var.ecr_untagged_days} days"
        selection = {
          tagStatus   = "untagged"
          countType   = "sinceImagePushed"
          countUnit   = "days"
          countNumber = var.ecr_untagged_days
        }
        action = {
          type = "expire"
        }
      }
    ]
  })
}

# =========================================
# CloudWatch Log Group
# =========================================

resource "aws_cloudwatch_log_group" "app" {
  name              = "/aws/ecs/${var.project_name}-${var.environment}"
  retention_in_days = var.log_retention_days

  kms_key_id = var.cloudwatch_kms_key_arn != "" ? var.cloudwatch_kms_key_arn : null

  tags = merge(var.tags, {
    Name        = "${var.project_name}-logs-${var.environment}"
    Environment = var.environment
  })
}

# =========================================
# ECS Task Definition
# =========================================

resource "aws_ecs_task_definition" "app" {
  family                   = "${var.project_name}-${var.environment}"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.task_cpu
  memory                   = var.task_memory
  execution_role_arn       = var.ecs_execution_role_arn
  task_role_arn            = var.ecs_task_role_arn

  container_definitions = jsonencode([
    {
      name      = var.container_name
      image     = "${aws_ecr_repository.app.repository_url}:${var.image_tag}"
      essential = true

      portMappings = [
        {
          containerPort = var.container_port
          protocol      = "tcp"
        }
      ]

      # Environment variables (non-sensitive)
      environment = concat(
        [
          {
            name  = "NODE_ENV"
            value = var.environment == "production" ? "production" : "development"
          },
          {
            name  = "ENVIRONMENT"
            value = var.environment == "production" ? "production" : "development"
          },
          {
            name  = "PORT"
            value = tostring(var.container_port)
          },
          {
            name  = "HOSTNAME"
            value = "0.0.0.0"
          },
          {
            name  = "NEXTAUTH_URL"
            value = var.nextauth_url
          }
        ],
        # Add RDS connection info if using RDS-managed secret (for runtime DATABASE_URL construction)
        var.rds_secret_arn != "" ? [
          {
            name  = "DB_HOST"
            value = var.rds_endpoint
          },
          {
            name  = "DB_PORT"
            value = "5432"
          },
          {
            name  = "DB_NAME"
            value = var.rds_database_name
          },
          {
            name  = "DB_SSL"
            value = "true"
          }
        ] : [],
        # Add ElastiCache Redis connection info if configured
        var.redis_host != "" ? [
          {
            name  = "REDIS_HOST"
            value = var.redis_host
          },
          {
            name  = "REDIS_PORT"
            value = var.redis_port
          },
          {
            name  = "REDIS_TLS"
            value = var.redis_tls_enabled ? "true" : "false"
          }
        ] : [],
        var.additional_environment_variables
      )

      # Secrets from Secrets Manager
      secrets = concat(
        [
          {
            name      = "NEXTAUTH_SECRET"
            valueFrom = var.nextauth_secret_arn
          },
          {
            name      = "ANTHROPIC_API_KEY"
            valueFrom = var.anthropic_secret_arn
          },
          {
            name      = "ENCRYPTION_KEY"
            valueFrom = var.encryption_key_secret_arn
          }
        ],
        # Database credentials: Use RDS-managed secret if provided, otherwise fall back to legacy DATABASE_URL secret
        var.rds_secret_arn != "" ? [
          {
            name      = "DB_USERNAME"
            valueFrom = "${var.rds_secret_arn}:username::"
          },
          {
            name      = "DB_PASSWORD"
            valueFrom = "${var.rds_secret_arn}:password::"
          }
          ] : var.database_secret_arn != "" ? [
          {
            name      = "DATABASE_URL"
            valueFrom = "${var.database_secret_arn}:url::"
          }
        ] : [],
        # Add Google OAuth secrets if enabled
        var.google_oauth_secret_arn != null && var.google_oauth_secret_arn != "" ? [
          {
            name      = "GOOGLE_CLIENT_ID"
            valueFrom = "${var.google_oauth_secret_arn}:client_id::"
          },
          {
            name      = "GOOGLE_CLIENT_SECRET"
            valueFrom = "${var.google_oauth_secret_arn}:client_secret::"
          }
        ] : [],
        # Add Okta OAuth secrets if enabled
        var.okta_oauth_secret_arn != null && var.okta_oauth_secret_arn != "" ? [
          {
            name      = "OKTA_CLIENT_ID"
            valueFrom = "${var.okta_oauth_secret_arn}:clientId::"
          },
          {
            name      = "OKTA_CLIENT_SECRET"
            valueFrom = "${var.okta_oauth_secret_arn}:clientSecret::"
          },
          {
            name      = "OKTA_ISSUER"
            valueFrom = "${var.okta_oauth_secret_arn}:issuer::"
          }
        ] : [],
        # Add Upstash Redis secrets if enabled
        var.redis_secret_arn != "" ? [
          {
            name      = "UPSTASH_REDIS_REST_URL"
            valueFrom = "${var.redis_secret_arn}:url::"
          },
          {
            name      = "UPSTASH_REDIS_REST_TOKEN"
            valueFrom = "${var.redis_secret_arn}:token::"
          }
        ] : [],
        # Add ElastiCache Redis auth token if TLS enabled
        var.redis_auth_token_secret_arn != "" ? [
          {
            name      = "REDIS_AUTH_TOKEN"
            valueFrom = var.redis_auth_token_secret_arn
          }
        ] : []
      )

      # Logging
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.app.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "ecs"
        }
      }

      # Health check - using Node.js HTTP module (no curl required in Alpine)
      healthCheck = {
        command     = ["CMD-SHELL", "node -e \"require('http').get('http://127.0.0.1:${var.container_port}${var.health_check_path}', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)}).on('error', () => process.exit(1))\""]
        interval    = var.health_check_interval
        timeout     = var.health_check_timeout
        retries     = var.health_check_retries
        startPeriod = var.health_check_start_period
      }

      # Resource limits
      ulimits = [
        {
          name      = "nofile"
          softLimit = 65536
          hardLimit = 65536
        }
      ]
    }
  ])

  tags = merge(var.tags, {
    Name        = "${var.project_name}-task-${var.environment}"
    Environment = var.environment
  })
}

# =========================================
# ECS Service
# =========================================

resource "aws_ecs_service" "app" {
  name            = "${var.project_name}-service-${var.environment}"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.app.arn
  desired_count   = var.desired_count
  launch_type     = var.use_fargate_spot ? null : "FARGATE"

  # Use capacity provider if Fargate Spot is enabled
  dynamic "capacity_provider_strategy" {
    for_each = var.use_fargate_spot ? [1] : []
    content {
      capacity_provider = "FARGATE_SPOT"
      weight            = 100
      base              = 1
    }
  }

  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = [aws_security_group.ecs_tasks.id]
    assign_public_ip = false
  }

  # Load balancer configuration
  dynamic "load_balancer" {
    for_each = var.target_group_arn != "" ? [1] : []
    content {
      target_group_arn = var.target_group_arn
      container_name   = var.container_name
      container_port   = var.container_port
    }
  }

  # Deployment configuration
  # TODO: Investigate why deployment_configuration block is being rejected
  # deployment_configuration {
  #   maximum_percent         = var.deployment_maximum_percent
  #   minimum_healthy_percent = var.deployment_minimum_healthy_percent
  # }

  # Enable ECS managed tags
  enable_ecs_managed_tags = true
  propagate_tags          = "SERVICE"

  # Health check grace period for ALB
  health_check_grace_period_seconds = var.health_check_grace_period

  # Enable Execute Command for debugging (optional)
  enable_execute_command = var.enable_execute_command

  tags = merge(var.tags, {
    Name        = "${var.project_name}-service-${var.environment}"
    Environment = var.environment
  })

  depends_on = [
    aws_ecs_cluster_capacity_providers.main
  ]
}

# =========================================
# Security Group for ECS Tasks
# =========================================

resource "aws_security_group" "ecs_tasks" {
  name        = "${var.project_name}-ecs-tasks-${var.environment}"
  description = "Security group for ECS tasks"
  vpc_id      = var.vpc_id

  # Allow inbound from ALB on container port
  dynamic "ingress" {
    for_each = var.alb_security_group_id != "" ? [1] : []
    content {
      description     = "Allow traffic from ALB"
      from_port       = var.container_port
      to_port         = var.container_port
      protocol        = "tcp"
      security_groups = [var.alb_security_group_id]
    }
  }

  # Allow all outbound traffic
  egress {
    description = "Allow all outbound traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(var.tags, {
    Name        = "${var.project_name}-ecs-tasks-sg-${var.environment}"
    Environment = var.environment
  })
}

# =========================================
# Auto Scaling
# =========================================

resource "aws_appautoscaling_target" "ecs" {
  count = var.enable_autoscaling ? 1 : 0

  max_capacity       = var.autoscaling_max_capacity
  min_capacity       = var.autoscaling_min_capacity
  resource_id        = "service/${aws_ecs_cluster.main.name}/${aws_ecs_service.app.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

# Scale up based on CPU utilization
resource "aws_appautoscaling_policy" "ecs_cpu" {
  count = var.enable_autoscaling ? 1 : 0

  name               = "${var.project_name}-cpu-scaling-${var.environment}"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.ecs[0].resource_id
  scalable_dimension = aws_appautoscaling_target.ecs[0].scalable_dimension
  service_namespace  = aws_appautoscaling_target.ecs[0].service_namespace

  target_tracking_scaling_policy_configuration {
    target_value       = var.autoscaling_cpu_target
    scale_in_cooldown  = var.autoscaling_scale_in_cooldown
    scale_out_cooldown = var.autoscaling_scale_out_cooldown

    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
  }
}

# Scale up based on memory utilization
resource "aws_appautoscaling_policy" "ecs_memory" {
  count = var.enable_autoscaling ? 1 : 0

  name               = "${var.project_name}-memory-scaling-${var.environment}"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.ecs[0].resource_id
  scalable_dimension = aws_appautoscaling_target.ecs[0].scalable_dimension
  service_namespace  = aws_appautoscaling_target.ecs[0].service_namespace

  target_tracking_scaling_policy_configuration {
    target_value       = var.autoscaling_memory_target
    scale_in_cooldown  = var.autoscaling_scale_in_cooldown
    scale_out_cooldown = var.autoscaling_scale_out_cooldown

    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageMemoryUtilization"
    }
  }
}

# =========================================
# CloudWatch Alarms
# =========================================

# High CPU utilization alarm
resource "aws_cloudwatch_metric_alarm" "cpu_high" {
  count = var.enable_alarms ? 1 : 0

  alarm_name          = "${var.project_name}-cpu-high-${var.environment}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "CPUUtilization"
  namespace           = "AWS/ECS"
  period              = "300"
  statistic           = "Average"
  threshold           = var.cpu_alarm_threshold
  alarm_description   = "This metric monitors ECS CPU utilization"
  alarm_actions       = var.alarm_sns_topic_arn != "" ? [var.alarm_sns_topic_arn] : []

  dimensions = {
    ClusterName = aws_ecs_cluster.main.name
    ServiceName = aws_ecs_service.app.name
  }

  tags = merge(var.tags, {
    Name        = "${var.project_name}-cpu-alarm-${var.environment}"
    Environment = var.environment
  })
}

# High memory utilization alarm
resource "aws_cloudwatch_metric_alarm" "memory_high" {
  count = var.enable_alarms ? 1 : 0

  alarm_name          = "${var.project_name}-memory-high-${var.environment}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "MemoryUtilization"
  namespace           = "AWS/ECS"
  period              = "300"
  statistic           = "Average"
  threshold           = var.memory_alarm_threshold
  alarm_description   = "This metric monitors ECS memory utilization"
  alarm_actions       = var.alarm_sns_topic_arn != "" ? [var.alarm_sns_topic_arn] : []

  dimensions = {
    ClusterName = aws_ecs_cluster.main.name
    ServiceName = aws_ecs_service.app.name
  }

  tags = merge(var.tags, {
    Name        = "${var.project_name}-memory-alarm-${var.environment}"
    Environment = var.environment
  })
}

# Task count alarm (no tasks running)
resource "aws_cloudwatch_metric_alarm" "task_count_low" {
  count = var.enable_alarms ? 1 : 0

  alarm_name          = "${var.project_name}-task-count-low-${var.environment}"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "RunningTaskCount"
  namespace           = "ECS/ContainerInsights"
  period              = "60"
  statistic           = "Average"
  threshold           = var.desired_count
  alarm_description   = "Alert when no ECS tasks are running"
  alarm_actions       = var.alarm_sns_topic_arn != "" ? [var.alarm_sns_topic_arn] : []
  treat_missing_data  = "breaching"

  dimensions = {
    ClusterName = aws_ecs_cluster.main.name
    ServiceName = aws_ecs_service.app.name
  }

  tags = merge(var.tags, {
    Name        = "${var.project_name}-task-count-alarm-${var.environment}"
    Environment = var.environment
  })
}

# =========================================
# Worker Service for Background Jobs
# =========================================

# CloudWatch Log Group for worker
resource "aws_cloudwatch_log_group" "worker" {
  count = var.enable_worker ? 1 : 0

  name              = "/aws/ecs/${var.project_name}-worker-${var.environment}"
  retention_in_days = var.log_retention_days

  kms_key_id = var.cloudwatch_kms_key_arn != "" ? var.cloudwatch_kms_key_arn : null

  tags = merge(var.tags, {
    Name        = "${var.project_name}-worker-logs-${var.environment}"
    Environment = var.environment
  })
}

# Worker Task Definition
resource "aws_ecs_task_definition" "worker" {
  count = var.enable_worker ? 1 : 0

  family                   = "${var.project_name}-worker-${var.environment}"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.worker_task_cpu
  memory                   = var.worker_task_memory
  execution_role_arn       = var.ecs_execution_role_arn
  task_role_arn            = var.ecs_task_role_arn

  container_definitions = jsonencode([
    {
      name      = "worker"
      image     = "${aws_ecr_repository.app.repository_url}:${var.image_tag}"
      essential = true

      # Override entrypoint to run worker instead of web server
      command = ["node", "-r", "tsx/register", "src/lib/queue/workers.ts"]

      # No port mappings - worker doesn't serve HTTP

      # Environment variables (non-sensitive)
      environment = concat(
        [
          {
            name  = "NODE_ENV"
            value = var.environment == "production" ? "production" : "development"
          },
          {
            name  = "ENVIRONMENT"
            value = var.environment == "production" ? "production" : "development"
          },
          {
            name  = "WORKER_MODE"
            value = "true"
          }
        ],
        # Add RDS connection info if using RDS-managed secret (for runtime DATABASE_URL construction)
        var.rds_secret_arn != "" ? [
          {
            name  = "DB_HOST"
            value = var.rds_endpoint
          },
          {
            name  = "DB_PORT"
            value = "5432"
          },
          {
            name  = "DB_NAME"
            value = var.rds_database_name
          },
          {
            name  = "DB_SSL"
            value = "true"
          }
        ] : [],
        # Add ElastiCache Redis connection info if configured
        var.redis_host != "" ? [
          {
            name  = "REDIS_HOST"
            value = var.redis_host
          },
          {
            name  = "REDIS_PORT"
            value = var.redis_port
          },
          {
            name  = "REDIS_TLS"
            value = var.redis_tls_enabled ? "true" : "false"
          }
        ] : [],
        var.additional_environment_variables
      )

      # Secrets from Secrets Manager
      secrets = concat(
        [
          {
            name      = "ANTHROPIC_API_KEY"
            valueFrom = var.anthropic_secret_arn
          }
        ],
        # Database credentials: Use RDS-managed secret if provided, otherwise fall back to legacy DATABASE_URL secret
        var.rds_secret_arn != "" ? [
          {
            name      = "DB_USERNAME"
            valueFrom = "${var.rds_secret_arn}:username::"
          },
          {
            name      = "DB_PASSWORD"
            valueFrom = "${var.rds_secret_arn}:password::"
          }
          ] : var.database_secret_arn != "" ? [
          {
            name      = "DATABASE_URL"
            valueFrom = "${var.database_secret_arn}:url::"
          }
        ] : [],
        # Add Upstash Redis secrets if enabled
        var.redis_secret_arn != "" ? [
          {
            name      = "UPSTASH_REDIS_REST_URL"
            valueFrom = "${var.redis_secret_arn}:url::"
          },
          {
            name      = "UPSTASH_REDIS_REST_TOKEN"
            valueFrom = "${var.redis_secret_arn}:token::"
          }
        ] : [],
        # Add ElastiCache Redis auth token if TLS enabled
        var.redis_auth_token_secret_arn != "" ? [
          {
            name      = "REDIS_AUTH_TOKEN"
            valueFrom = var.redis_auth_token_secret_arn
          }
        ] : []
      )

      # Logging
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.worker[0].name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "ecs"
        }
      }

      # No health check - worker doesn't serve HTTP
      # BullMQ will handle job failures and retries

      # Resource limits
      ulimits = [
        {
          name      = "nofile"
          softLimit = 65536
          hardLimit = 65536
        }
      ]
    }
  ])

  tags = merge(var.tags, {
    Name        = "${var.project_name}-worker-task-${var.environment}"
    Environment = var.environment
  })
}

# Worker ECS Service
resource "aws_ecs_service" "worker" {
  count = var.enable_worker ? 1 : 0

  name            = "${var.project_name}-worker-${var.environment}"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.worker[0].arn
  desired_count   = var.worker_desired_count
  launch_type     = var.use_fargate_spot ? null : "FARGATE"

  # Use capacity provider if Fargate Spot is enabled
  dynamic "capacity_provider_strategy" {
    for_each = var.use_fargate_spot ? [1] : []
    content {
      capacity_provider = "FARGATE_SPOT"
      weight            = 100
      base              = 1
    }
  }

  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = [aws_security_group.ecs_tasks.id]
    assign_public_ip = false
  }

  # No load balancer - worker doesn't serve HTTP

  # Enable ECS managed tags
  enable_ecs_managed_tags = true
  propagate_tags          = "SERVICE"

  # Enable Execute Command for debugging (optional)
  enable_execute_command = var.enable_execute_command

  tags = merge(var.tags, {
    Name        = "${var.project_name}-worker-service-${var.environment}"
    Environment = var.environment
  })

  depends_on = [
    aws_ecs_cluster_capacity_providers.main
  ]
}
