# Network ACLs for Defense in Depth
# Reference: SEC-1053 - Security Groups and NACLs
# Provides network-level filtering in addition to security groups

# Data sources for subnets
variable "public_subnet_ids" {
  description = "List of public subnet IDs"
  type        = list(string)
}

variable "private_subnet_ids" {
  description = "List of private subnet IDs"
  type        = list(string)
}

# Public Subnet Network ACL
resource "aws_network_acl" "public" {
  count  = var.enable_custom_nacls ? 1 : 0
  vpc_id = var.vpc_id

  tags = {
    Name        = "${var.project_name}-public-nacl-${var.environment}"
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "terraform"
    Type        = "public"
  }
}

# Public NACL Inbound Rules
resource "aws_network_acl_rule" "public_inbound_https" {
  count          = var.enable_custom_nacls ? 1 : 0
  network_acl_id = aws_network_acl.public[0].id
  rule_number    = 100
  egress         = false
  protocol       = "tcp"
  rule_action    = "allow"
  cidr_block     = "0.0.0.0/0"
  from_port      = 443
  to_port        = 443
}

resource "aws_network_acl_rule" "public_inbound_http" {
  count          = var.enable_custom_nacls && var.allow_http_to_alb ? 1 : 0
  network_acl_id = aws_network_acl.public[0].id
  rule_number    = 110
  egress         = false
  protocol       = "tcp"
  rule_action    = "allow"
  cidr_block     = "0.0.0.0/0"
  from_port      = 80
  to_port        = 80
}

resource "aws_network_acl_rule" "public_inbound_ephemeral" {
  count          = var.enable_custom_nacls ? 1 : 0
  network_acl_id = aws_network_acl.public[0].id
  rule_number    = 200
  egress         = false
  protocol       = "tcp"
  rule_action    = "allow"
  cidr_block     = "0.0.0.0/0"
  from_port      = 1024
  to_port        = 65535
}

# Public NACL Outbound Rules
resource "aws_network_acl_rule" "public_outbound_http" {
  count          = var.enable_custom_nacls ? 1 : 0
  network_acl_id = aws_network_acl.public[0].id
  rule_number    = 100
  egress         = true
  protocol       = "tcp"
  rule_action    = "allow"
  cidr_block     = "0.0.0.0/0"
  from_port      = 80
  to_port        = 80
}

resource "aws_network_acl_rule" "public_outbound_https" {
  count          = var.enable_custom_nacls ? 1 : 0
  network_acl_id = aws_network_acl.public[0].id
  rule_number    = 110
  egress         = true
  protocol       = "tcp"
  rule_action    = "allow"
  cidr_block     = "0.0.0.0/0"
  from_port      = 443
  to_port        = 443
}

resource "aws_network_acl_rule" "public_outbound_ephemeral" {
  count          = var.enable_custom_nacls ? 1 : 0
  network_acl_id = aws_network_acl.public[0].id
  rule_number    = 200
  egress         = true
  protocol       = "tcp"
  rule_action    = "allow"
  cidr_block     = "0.0.0.0/0"
  from_port      = 1024
  to_port        = 65535
}

# Associate public NACL with public subnets
resource "aws_network_acl_association" "public" {
  count          = var.enable_custom_nacls ? length(var.public_subnet_ids) : 0
  subnet_id      = var.public_subnet_ids[count.index]
  network_acl_id = aws_network_acl.public[0].id
}

# Private Subnet Network ACL
resource "aws_network_acl" "private" {
  count  = var.enable_custom_nacls ? 1 : 0
  vpc_id = var.vpc_id

  tags = {
    Name        = "${var.project_name}-private-nacl-${var.environment}"
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "terraform"
    Type        = "private"
  }
}

# Private NACL Inbound Rules
resource "aws_network_acl_rule" "private_inbound_app" {
  count          = var.enable_custom_nacls ? 1 : 0
  network_acl_id = aws_network_acl.private[0].id
  rule_number    = 100
  egress         = false
  protocol       = "tcp"
  rule_action    = "allow"
  cidr_block     = var.vpc_cidr
  from_port      = var.app_port
  to_port        = var.app_port
}

resource "aws_network_acl_rule" "private_inbound_postgres" {
  count          = var.enable_custom_nacls ? 1 : 0
  network_acl_id = aws_network_acl.private[0].id
  rule_number    = 110
  egress         = false
  protocol       = "tcp"
  rule_action    = "allow"
  cidr_block     = var.vpc_cidr
  from_port      = 5432
  to_port        = 5432
}

resource "aws_network_acl_rule" "private_inbound_redis" {
  count          = var.enable_custom_nacls && var.enable_redis ? 1 : 0
  network_acl_id = aws_network_acl.private[0].id
  rule_number    = 120
  egress         = false
  protocol       = "tcp"
  rule_action    = "allow"
  cidr_block     = var.vpc_cidr
  from_port      = 6379
  to_port        = 6379
}

resource "aws_network_acl_rule" "private_inbound_ephemeral" {
  count          = var.enable_custom_nacls ? 1 : 0
  network_acl_id = aws_network_acl.private[0].id
  rule_number    = 200
  egress         = false
  protocol       = "tcp"
  rule_action    = "allow"
  cidr_block     = "0.0.0.0/0"
  from_port      = 1024
  to_port        = 65535
}

# Private NACL Outbound Rules
resource "aws_network_acl_rule" "private_outbound_http" {
  count          = var.enable_custom_nacls ? 1 : 0
  network_acl_id = aws_network_acl.private[0].id
  rule_number    = 100
  egress         = true
  protocol       = "tcp"
  rule_action    = "allow"
  cidr_block     = "0.0.0.0/0"
  from_port      = 80
  to_port        = 80
}

resource "aws_network_acl_rule" "private_outbound_https" {
  count          = var.enable_custom_nacls ? 1 : 0
  network_acl_id = aws_network_acl.private[0].id
  rule_number    = 110
  egress         = true
  protocol       = "tcp"
  rule_action    = "allow"
  cidr_block     = "0.0.0.0/0"
  from_port      = 443
  to_port        = 443
}

resource "aws_network_acl_rule" "private_outbound_postgres" {
  count          = var.enable_custom_nacls ? 1 : 0
  network_acl_id = aws_network_acl.private[0].id
  rule_number    = 120
  egress         = true
  protocol       = "tcp"
  rule_action    = "allow"
  cidr_block     = var.vpc_cidr
  from_port      = 5432
  to_port        = 5432
}

resource "aws_network_acl_rule" "private_outbound_redis" {
  count          = var.enable_custom_nacls && var.enable_redis ? 1 : 0
  network_acl_id = aws_network_acl.private[0].id
  rule_number    = 130
  egress         = true
  protocol       = "tcp"
  rule_action    = "allow"
  cidr_block     = var.vpc_cidr
  from_port      = 6379
  to_port        = 6379
}

resource "aws_network_acl_rule" "private_outbound_ephemeral" {
  count          = var.enable_custom_nacls ? 1 : 0
  network_acl_id = aws_network_acl.private[0].id
  rule_number    = 200
  egress         = true
  protocol       = "tcp"
  rule_action    = "allow"
  cidr_block     = "0.0.0.0/0"
  from_port      = 1024
  to_port        = 65535
}

# Associate private NACL with private subnets
resource "aws_network_acl_association" "private" {
  count          = var.enable_custom_nacls ? length(var.private_subnet_ids) : 0
  subnet_id      = var.private_subnet_ids[count.index]
  network_acl_id = aws_network_acl.private[0].id
}
