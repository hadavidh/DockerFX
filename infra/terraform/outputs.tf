output "prod_url" {
  description = "URL de production"
  value       = "http://${var.vps_ip}"
}

output "staging_url" {
  description = "URL de staging"
  value       = "http://${var.vps_ip}:${var.staging_port}"
}

output "files_generated" {
  description = "Fichiers générés par Terraform"
  value = [
    "docker-compose.prod.yml",
    "docker-compose.staging.yml",
    "nginx/nginx.conf",
    "infra/ansible/inventory.yml",
    ".env.staging.example",
  ]
}

output "next_step" {
  description = "Prochaine étape après terraform apply"
  value       = "ansible-playbook -i infra/ansible/inventory.yml infra/ansible/playbook.yml"
}
