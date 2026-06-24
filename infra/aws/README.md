# AWS infra (Terraform) — MolarPlus backend

Provisions the lift-and-shift target: **1× EC2** (Docker-Compose host, nginx+certbot
on the box) + **Elastic IP**, **RDS PostgreSQL 16** (single-AZ), security groups.
Region: **ap-south-1 (Mumbai)**.

Does **not** manage DNS (lives elsewhere), TLS certs (certbot on the box), R2, or an ALB.

## Prereqs
- AWS CLI configured (`aws configure`) or env creds, with rights to create EC2/RDS/VPC SGs.
- An EC2 **key pair** created in ap-south-1 (note its name).
- Terraform >= 1.5.

## Use
```bash
cd infra/aws
cp terraform.tfvars.example terraform.tfvars   # fill in key_name, allowed_ssh_cidrs, db_password
terraform init
terraform plan        # review
terraform apply
```

## Outputs you'll need
- `ec2_public_ip` — the Elastic IP. Point `api.molarplus.com` + `nexus.molarplus.com`
  A records here **at cutover** (see `docs/aws-migration-cutover-runbook.md`).
- `rds_endpoint` / `rds_address` — put the host into `DATABASE_URL` in `.env.production`
  (db `molarplus`, user `postgres`, password `@` → `%40`).

## After apply (on the EC2 box)
1. SSH in (`ssh ubuntu@<ec2_public_ip>`), clone the repo, copy `.env.production`
   with `DATABASE_URL` pointed at RDS.
2. Put the Firebase JSON on the box at `FIREBASE_JSON_PATH`.
3. Run the cutover (dump/restore, `./deploy-aws.sh`, certbot for both hostnames, DNS flip)
   per the runbook.

## Notes
- `deletion_protection = true` on RDS and a final snapshot are on by default — safe.
  To tear down later you must disable deletion protection first.
- Single-AZ now; flip `multi_az = true` later with no app change if you want HA.
- State is local by default. For team use, configure an S3 backend (not included).
