output "prod_url" {
  description = "URL de production"
  value       = "https://${var.domain_name}"
}

output "staging_url" {
  description = "URL de staging"
  value       = "https://${var.staging_domain}"
}

output "prod_origin_url" {
  description = "URL origin prod locale derrière le gateway"
  value       = "https://127.0.0.1:${var.prod_origin_https_port}"
}

output "staging_origin_url" {
  description = "URL origin staging locale derrière le gateway"
  value       = "http://127.0.0.1:${var.staging_port}"
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
    "dockerfx-gateway.conf",
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
