variable "project" {
  type    = string
  default = "molarplus"
}

variable "region" {
  type    = string
  default = "ap-south-1" # Mumbai
}

# ── EC2 ──
variable "instance_type" {
  type    = string
  default = "t3.large"
}

variable "ec2_disk_gb" {
  type    = number
  default = 30
}

variable "key_name" {
  type        = string
  description = "Name of an existing EC2 key pair in this region (for SSH)."
}

variable "allowed_ssh_cidrs" {
  type        = list(string)
  description = "CIDRs allowed to SSH (e.g. [\"203.0.113.10/32\"]). Avoid 0.0.0.0/0."
}

# ── RDS ──
variable "postgres_version" {
  type    = string
  default = "16"
}

variable "db_instance_class" {
  type    = string
  default = "db.t3.small"
}

variable "db_storage_gb" {
  type    = number
  default = 20
}

variable "db_max_storage_gb" {
  type    = number
  default = 100
}

variable "db_name" {
  type    = string
  default = "molarplus"
}

variable "db_username" {
  type    = string
  default = "postgres"
}

variable "db_password" {
  type        = string
  sensitive   = true
  description = "RDS master password. Set via TF_VAR_db_password or terraform.tfvars (gitignored). If it contains '@', encode as %40 in DATABASE_URL."
}
