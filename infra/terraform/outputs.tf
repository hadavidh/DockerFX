output "prod_url" {
  description = "URL de production"
  value       = "https://${var.domain_name}"
}

output "prod_http_url" {
  description = "URL HTTP production (redirigée vers HTTPS)"
  value       = "http://${var.domain_name}"
}

output "staging_url" {
  description = "URL de staging"
  value       = "http://${var.vps_ip}:${var.staging_port}"
}

output "ssl_directory" {
  description = "Dossier VPS contenant les certificats Cloudflare Origin CA"
  value       = var.ssl_dir
}

output "files_generated" {
  description = "Fichiers générés par Terraform"
  value = [
    "docker-stack.prod.yml",
    "docker-compose.staging.yml",
    "frontend/nginx.conf",
    "frontend/nginx.staging.conf",
    "infra/ansible/inventory.yml",
    ".env.staging.example",
  ]
}

output "next_step" {
  description = "Prochaine étape après terraform apply"
  value       = "ansible-playbook -i infra/ansible/inventory.yml infra/ansible/playbook.yml"
}
