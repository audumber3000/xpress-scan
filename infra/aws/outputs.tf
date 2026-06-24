output "ec2_public_ip" {
  description = "Elastic IP of the backend host. Point api.molarplus.com + nexus.molarplus.com A records here at cutover."
  value       = aws_eip.backend.public_ip
}

output "ec2_instance_id" {
  value = aws_instance.backend.id
}

output "rds_endpoint" {
  description = "RDS host:port. Put the host into DATABASE_URL in .env.production (db name 'molarplus', user 'postgres')."
  value       = aws_db_instance.main.endpoint
}

output "rds_address" {
  value = aws_db_instance.main.address
}

output "database_url_hint" {
  description = "Template for .env.production. Replace <PASSWORD> ('@' -> %40) and confirm host."
  value       = "postgresql://${aws_db_instance.main.username}:<PASSWORD>@${aws_db_instance.main.address}:5432/${aws_db_instance.main.db_name}"
}
