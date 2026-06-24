###############################################################################
# MolarPlus backend — AWS infra (lift-and-shift from Hetzner)
#
# Provisions: 1x EC2 (Docker-Compose host, nginx+certbot on box) + Elastic IP,
#             RDS PostgreSQL 16 (single-AZ), security groups.
#
# Deliberately does NOT manage: DNS (lives elsewhere — see outputs), TLS certs
# (certbot runs on the box), R2 (unchanged), an ALB (TLS is on the box).
#
# Region: ap-south-1 (Mumbai)
###############################################################################

terraform {
  required_version = ">= 1.5"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.region
}

# ── Network: use the account's default VPC + subnets (simple, lift-and-shift) ──
data "aws_vpc" "default" {
  default = true
}

data "aws_subnets" "default" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
}

# Latest Ubuntu 22.04 LTS AMI (Canonical)
data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"] # Canonical

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*"]
  }
  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

# ── Security groups ───────────────────────────────────────────────────────────
resource "aws_security_group" "ec2" {
  name        = "${var.project}-ec2"
  description = "MolarPlus backend EC2 - public 80/443, SSH restricted"
  vpc_id      = data.aws_vpc.default.id

  ingress {
    description = "HTTP"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  ingress {
    description = "HTTPS"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  ingress {
    description = "SSH (restricted)"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = var.allowed_ssh_cidrs
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Project = var.project }
}

resource "aws_security_group" "rds" {
  name        = "${var.project}-rds"
  description = "MolarPlus RDS - 5432 only from the EC2 SG"
  vpc_id      = data.aws_vpc.default.id

  ingress {
    description     = "Postgres from backend EC2"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.ec2.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Project = var.project }
}

# ── EC2 host ──────────────────────────────────────────────────────────────────
resource "aws_instance" "backend" {
  ami                    = data.aws_ami.ubuntu.id
  instance_type          = var.instance_type
  key_name               = var.key_name
  vpc_security_group_ids = [aws_security_group.ec2.id]
  subnet_id              = tolist(data.aws_subnets.default.ids)[0]

  root_block_device {
    volume_size = var.ec2_disk_gb
    volume_type = "gp3"
    encrypted   = true
  }

  # Installs Docker, the compose plugin, postgresql-client (for deploy-aws.sh
  # migrations against RDS), nginx + certbot. App deploy itself is done by you
  # via deploy-aws.sh after cutover.
  user_data = <<-EOF
    #!/bin/bash
    set -e
    apt-get update
    apt-get install -y ca-certificates curl gnupg git nginx certbot python3-certbot-nginx postgresql-client
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" > /etc/apt/sources.list.d/docker.list
    apt-get update
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    usermod -aG docker ubuntu
    systemctl enable --now docker
  EOF

  tags = { Project = var.project, Name = "${var.project}-backend" }
}

resource "aws_eip" "backend" {
  instance = aws_instance.backend.id
  domain   = "vpc"
  tags     = { Project = var.project }
}

# ── RDS PostgreSQL 16 (single-AZ) ─────────────────────────────────────────────
resource "aws_db_subnet_group" "main" {
  name       = "${var.project}-db-subnets"
  subnet_ids = data.aws_subnets.default.ids
  tags       = { Project = var.project }
}

resource "aws_db_instance" "main" {
  identifier     = "${var.project}-db"
  engine         = "postgres"
  engine_version = var.postgres_version
  instance_class = var.db_instance_class

  allocated_storage     = var.db_storage_gb
  max_allocated_storage = var.db_max_storage_gb
  storage_type          = "gp3"
  storage_encrypted     = true

  db_name  = var.db_name
  username = var.db_username
  password = var.db_password

  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.rds.id]
  publicly_accessible    = false
  multi_az               = false

  backup_retention_period   = 7
  skip_final_snapshot       = false
  final_snapshot_identifier = "${var.project}-db-final"
  deletion_protection       = true
  apply_immediately         = true

  tags = { Project = var.project }
}
