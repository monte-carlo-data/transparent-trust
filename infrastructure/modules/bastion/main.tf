# Bastion Host (Jumpbox) for secure access to private resources
# Connects to Tailscale for secure access via your Tailnet
# Also supports AWS SSM Session Manager as a backup access method

# Get latest Amazon Linux 2023 AMI using SSM Parameter Store
# This always returns the current latest AMI ID - recommended by AWS
# https://docs.aws.amazon.com/linux/al2023/ug/ec2.html
data "aws_ssm_parameter" "al2023_ami" {
  name = "/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-x86_64"
}

# Security Group for Bastion
resource "aws_security_group" "bastion" {
  name        = "${var.project_name}-bastion-${var.environment}"
  description = "Security group for bastion host (Tailscale + SSM)"
  vpc_id      = var.vpc_id

  # No inbound rules needed:
  # - Tailscale uses outbound connections (DERP relay or direct via UDP 41641)
  # - SSM uses outbound HTTPS

  # Allow all outbound (needed for Tailscale, SSM, RDS access, etc.)
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Allow all outbound traffic (Tailscale, SSM, RDS)"
  }

  tags = {
    Name        = "${var.project_name}-bastion-sg-${var.environment}"
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

# IAM Role for Bastion (SSM access + Secrets Manager for Tailscale auth key)
resource "aws_iam_role" "bastion" {
  name = "${var.project_name}-bastion-role-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ec2.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name        = "${var.project_name}-bastion-role-${var.environment}"
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

# Attach SSM policy for Session Manager access (backup access method)
resource "aws_iam_role_policy_attachment" "bastion_ssm" {
  role       = aws_iam_role.bastion.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

# Policy to read Tailscale auth key from Secrets Manager
resource "aws_iam_role_policy" "bastion_secrets" {
  count = var.tailscale_auth_key_secret_arn != "" ? 1 : 0
  name  = "${var.project_name}-bastion-secrets-${var.environment}"
  role  = aws_iam_role.bastion.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue"
        ]
        Resource = [var.tailscale_auth_key_secret_arn]
      }
    ]
  })
}

# Instance Profile
resource "aws_iam_instance_profile" "bastion" {
  name = "${var.project_name}-bastion-profile-${var.environment}"
  role = aws_iam_role.bastion.name

  tags = {
    Name        = "${var.project_name}-bastion-profile-${var.environment}"
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

# Bastion EC2 Instance with Tailscale
resource "aws_instance" "bastion" {
  ami                    = data.aws_ssm_parameter.al2023_ami.value
  instance_type          = var.instance_type
  subnet_id              = var.subnet_id
  vpc_security_group_ids = [aws_security_group.bastion.id]
  iam_instance_profile   = aws_iam_instance_profile.bastion.name

  # No key pair needed - we use Tailscale SSH or SSM Session Manager
  key_name = null

  # Enable detailed monitoring for better visibility
  monitoring = var.enable_detailed_monitoring

  # Root volume
  root_block_device {
    volume_type           = "gp3"
    volume_size           = 20
    encrypted             = true
    delete_on_termination = true

    tags = {
      Name        = "${var.project_name}-bastion-root-${var.environment}"
      Project     = var.project_name
      Environment = var.environment
    }
  }

  # User data to install Tailscale and useful tools
  user_data = base64encode(templatefile("${path.module}/user-data.sh.tftpl", {
    tailscale_auth_key_secret_arn = var.tailscale_auth_key_secret_arn
    aws_region                    = var.aws_region
    hostname                      = var.tailscale_hostname != "" ? var.tailscale_hostname : "${var.project_name}-bastion-${var.environment}"
    tailscale_tags                = var.tailscale_tags
  }))

  tags = {
    Name        = "${var.project_name}-bastion-${var.environment}"
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "terraform"
    Purpose     = "jumpbox-tailscale"
  }

  lifecycle {
    ignore_changes = [ami] # Don't force replacement on AMI updates
  }
}
