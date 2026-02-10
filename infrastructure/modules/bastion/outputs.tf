# Outputs for Bastion Host module

output "instance_id" {
  description = "ID of the bastion EC2 instance"
  value       = aws_instance.bastion.id
}

output "instance_arn" {
  description = "ARN of the bastion EC2 instance"
  value       = aws_instance.bastion.arn
}

output "private_ip" {
  description = "Private IP address of the bastion"
  value       = aws_instance.bastion.private_ip
}

output "security_group_id" {
  description = "ID of the bastion security group"
  value       = aws_security_group.bastion.id
}

output "iam_role_arn" {
  description = "ARN of the bastion IAM role"
  value       = aws_iam_role.bastion.arn
}

# Tailscale outputs
output "tailscale_hostname" {
  description = "Hostname of the bastion in Tailscale"
  value       = var.tailscale_hostname != "" ? var.tailscale_hostname : "${var.project_name}-bastion-${var.environment}"
}

output "tailscale_ssh_command" {
  description = "SSH command to connect via Tailscale"
  value       = "ssh root@${var.tailscale_hostname != "" ? var.tailscale_hostname : "${var.project_name}-bastion-${var.environment}"}"
}

# SSM outputs (backup access method)
output "ssm_start_session_command" {
  description = "AWS CLI command to start an SSM session to the bastion (backup access)"
  value       = "aws ssm start-session --target ${aws_instance.bastion.id}"
}

output "ssm_port_forward_command" {
  description = "AWS CLI command template for port forwarding (replace HOST and PORT)"
  value       = "aws ssm start-session --target ${aws_instance.bastion.id} --document-name AWS-StartPortForwardingSessionToRemoteHost --parameters '{\"host\":[\"RDS_ENDPOINT\"],\"portNumber\":[\"5432\"],\"localPortNumber\":[\"5432\"]}'"
}
