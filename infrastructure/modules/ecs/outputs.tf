# Outputs for ECS/Fargate Infrastructure
# Reference: SEC-1047 - ECS/Fargate deployment

# =========================================
# ECS Cluster Outputs
# =========================================

output "cluster_id" {
  description = "ID of the ECS cluster"
  value       = aws_ecs_cluster.main.id
}

output "cluster_arn" {
  description = "ARN of the ECS cluster"
  value       = aws_ecs_cluster.main.arn
}

output "cluster_name" {
  description = "Name of the ECS cluster"
  value       = aws_ecs_cluster.main.name
}

# =========================================
# ECR Repository Outputs
# =========================================

output "ecr_repository_url" {
  description = "URL of the ECR repository"
  value       = aws_ecr_repository.app.repository_url
}

output "ecr_repository_arn" {
  description = "ARN of the ECR repository"
  value       = aws_ecr_repository.app.arn
}

output "ecr_repository_name" {
  description = "Name of the ECR repository"
  value       = aws_ecr_repository.app.name
}

output "ecr_registry_id" {
  description = "Registry ID of the ECR repository"
  value       = aws_ecr_repository.app.registry_id
}

# =========================================
# ECS Task Definition Outputs
# =========================================

output "task_definition_arn" {
  description = "ARN of the ECS task definition"
  value       = aws_ecs_task_definition.app.arn
}

output "task_definition_family" {
  description = "Family name of the ECS task definition"
  value       = aws_ecs_task_definition.app.family
}

output "task_definition_revision" {
  description = "Revision number of the ECS task definition"
  value       = aws_ecs_task_definition.app.revision
}

# =========================================
# ECS Service Outputs
# =========================================

output "service_id" {
  description = "ID of the ECS service"
  value       = aws_ecs_service.app.id
}

output "service_name" {
  description = "Name of the ECS service"
  value       = aws_ecs_service.app.name
}

output "service_cluster" {
  description = "ARN of the cluster the service is running on"
  value       = aws_ecs_service.app.cluster
}

output "service_desired_count" {
  description = "Desired number of tasks for the service"
  value       = aws_ecs_service.app.desired_count
}

# =========================================
# Security Group Outputs
# =========================================

output "ecs_tasks_security_group_id" {
  description = "ID of the security group for ECS tasks"
  value       = aws_security_group.ecs_tasks.id
}

output "ecs_tasks_security_group_arn" {
  description = "ARN of the security group for ECS tasks"
  value       = aws_security_group.ecs_tasks.arn
}

# =========================================
# CloudWatch Outputs
# =========================================

output "cloudwatch_log_group_name" {
  description = "Name of the CloudWatch log group"
  value       = aws_cloudwatch_log_group.app.name
}

output "cloudwatch_log_group_arn" {
  description = "ARN of the CloudWatch log group"
  value       = aws_cloudwatch_log_group.app.arn
}

# =========================================
# Auto Scaling Outputs
# =========================================

output "autoscaling_target_resource_id" {
  description = "Resource ID of the auto scaling target"
  value       = var.enable_autoscaling ? aws_appautoscaling_target.ecs[0].resource_id : null
}

output "autoscaling_cpu_policy_arn" {
  description = "ARN of the CPU-based auto scaling policy"
  value       = var.enable_autoscaling ? aws_appautoscaling_policy.ecs_cpu[0].arn : null
}

output "autoscaling_memory_policy_arn" {
  description = "ARN of the memory-based auto scaling policy"
  value       = var.enable_autoscaling ? aws_appautoscaling_policy.ecs_memory[0].arn : null
}

# =========================================
# Alarm Outputs
# =========================================

output "cpu_alarm_arn" {
  description = "ARN of the CPU utilization alarm"
  value       = var.enable_alarms ? aws_cloudwatch_metric_alarm.cpu_high[0].arn : null
}

output "memory_alarm_arn" {
  description = "ARN of the memory utilization alarm"
  value       = var.enable_alarms ? aws_cloudwatch_metric_alarm.memory_high[0].arn : null
}

output "task_count_alarm_arn" {
  description = "ARN of the task count alarm"
  value       = var.enable_alarms ? aws_cloudwatch_metric_alarm.task_count_low[0].arn : null
}

# =========================================
# Deployment Information
# =========================================

output "deployment_info" {
  description = "Summary of deployment configuration"
  value = {
    cluster_name       = aws_ecs_cluster.main.name
    service_name       = aws_ecs_service.app.name
    ecr_url            = aws_ecr_repository.app.repository_url
    container_name     = var.container_name
    container_port     = var.container_port
    desired_count      = var.desired_count
    task_cpu           = var.task_cpu
    task_memory        = var.task_memory
    environment        = var.environment
    log_group          = aws_cloudwatch_log_group.app.name
    autoscaling        = var.enable_autoscaling
    container_insights = var.enable_container_insights
    fargate_spot       = var.use_fargate_spot
  }
}

# =========================================
# Quick Reference Commands
# =========================================

output "useful_commands" {
  description = "Useful commands for managing the ECS deployment"
  value = {
    docker_login     = "aws ecr get-login-password --region ${var.aws_region} | docker login --username AWS --password-stdin ${aws_ecr_repository.app.repository_url}"
    docker_build     = "docker build -t ${aws_ecr_repository.app.name}:latest ."
    docker_tag       = "docker tag ${aws_ecr_repository.app.name}:latest ${aws_ecr_repository.app.repository_url}:latest"
    docker_push      = "docker push ${aws_ecr_repository.app.repository_url}:latest"
    view_logs        = "aws logs tail ${aws_cloudwatch_log_group.app.name} --follow"
    list_tasks       = "aws ecs list-tasks --cluster ${aws_ecs_cluster.main.name} --service-name ${aws_ecs_service.app.name}"
    update_service   = "aws ecs update-service --cluster ${aws_ecs_cluster.main.name} --service ${aws_ecs_service.app.name} --force-new-deployment"
    describe_service = "aws ecs describe-services --cluster ${aws_ecs_cluster.main.name} --services ${aws_ecs_service.app.name}"
  }
}

# =========================================
# Worker Service Outputs
# =========================================

output "worker_service_id" {
  description = "ID of the worker ECS service"
  value       = var.enable_worker ? aws_ecs_service.worker[0].id : null
}

output "worker_service_name" {
  description = "Name of the worker ECS service"
  value       = var.enable_worker ? aws_ecs_service.worker[0].name : null
}

output "worker_task_definition_arn" {
  description = "ARN of the worker ECS task definition"
  value       = var.enable_worker ? aws_ecs_task_definition.worker[0].arn : null
}

output "worker_log_group_name" {
  description = "Name of the worker CloudWatch log group"
  value       = var.enable_worker ? aws_cloudwatch_log_group.worker[0].name : null
}

output "worker_deployment_info" {
  description = "Summary of worker deployment configuration"
  value = var.enable_worker ? {
    service_name  = aws_ecs_service.worker[0].name
    desired_count = var.worker_desired_count
    task_cpu      = var.worker_task_cpu
    task_memory   = var.worker_task_memory
    log_group     = aws_cloudwatch_log_group.worker[0].name
  } : null
}
