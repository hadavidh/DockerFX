terraform {
  required_version = ">= 1.5.0"

  required_providers {
    local = {
      source  = "hashicorp/local"
      version = "~> 2.4"
    }
    null = {
      source  = "hashicorp/null"
      version = "~> 3.2"
    }
  }

  backend "local" {
    path = "terraform.tfstate"
  }
}


# ════════════════════════════════════════════════════════════════
# GÉNÉRATION — docker-compose.prod.yml
# ════════════════════════════════════════════════════════════════

resource "local_file" "docker_compose_prod" {
  filename        = "${path.module}/../../docker-compose.prod.yml"
  file_permission = "0644"
  content         = <<-EOT
    # ╔══════════════════════════════════════════════════════════╗
    # ║  PRODUCTION — ICT Trading Dashboard                     ║
    # ║  Généré automatiquement par Terraform                   ║
    # ║  Ne pas modifier manuellement                           ║
    # ║  Pour modifier : éditer infra/terraform/main.tf         ║
    # ╚══════════════════════════════════════════════════════════╝

    version: '3.9'

    services:

      backend:
        image: ${var.backend_image}:latest
        container_name: forex-backend-prod
        restart: unless-stopped
        env_file: .env.prod
        expose:
          - "${var.backend_prod_port}"
        healthcheck:
          test: ["CMD","wget","-qO-","http://localhost:${var.backend_prod_port}/health"]
          interval: 30s
          timeout: 5s
          retries: 3
          start_period: 10s
        networks:
          - trading-prod
        labels:
          - "environment=production"
          - "project=${var.project_name}"

      frontend:
        image: ${var.frontend_image}:latest
        container_name: forex-frontend-prod
        restart: unless-stopped
        ports:
          - "${var.prod_port}:80"
        depends_on:
          backend:
            condition: service_healthy
        networks:
          - trading-prod
        labels:
          - "environment=production"
          - "project=${var.project_name}"

    networks:
      trading-prod:
        driver: bridge
        name: trading-prod
  EOT
}

# ════════════════════════════════════════════════════════════════
# GÉNÉRATION — docker-compose.staging.yml
# ════════════════════════════════════════════════════════════════

resource "local_file" "docker_compose_staging" {
  filename        = "${path.module}/../../docker-compose.staging.yml"
  file_permission = "0644"
  content         = <<-EOT
    # ╔══════════════════════════════════════════════════════════╗
    # ║  STAGING — ICT Trading Dashboard                        ║
    # ║  Généré automatiquement par Terraform                   ║
    # ║  Accessible sur http://${var.vps_ip}:${var.staging_port}             ║
    # ╚══════════════════════════════════════════════════════════╝

    version: '3.9'

    services:

      backend:
        image: ${var.backend_image}:develop
        container_name: forex-backend-staging
        restart: unless-stopped
        env_file: .env.staging
        expose:
          - "${var.backend_staging_port}"
        environment:
          - PORT=${var.backend_staging_port}
          - NODE_ENV=staging
        healthcheck:
          test: ["CMD","wget","-qO-","http://localhost:${var.backend_staging_port}/health"]
          interval: 30s
          timeout: 5s
          retries: 3
          start_period: 10s
        networks:
          - trading-staging
        labels:
          - "environment=staging"
          - "project=${var.project_name}"

      frontend:
        image: ${var.frontend_image}:develop
        container_name: forex-frontend-staging
        restart: unless-stopped
        ports:
          - "${var.staging_port}:80"
        depends_on:
          backend:
            condition: service_healthy
        networks:
          - trading-staging
        labels:
          - "environment=staging"
          - "project=${var.project_name}"

    networks:
      trading-staging:
        driver: bridge
        name: trading-staging
  EOT
}

# ════════════════════════════════════════════════════════════════
# GÉNÉRATION — nginx/nginx.conf
# ════════════════════════════════════════════════════════════════

resource "local_file" "nginx_conf" {
  filename        = "${path.module}/../../nginx/nginx.conf"
  file_permission = "0644"
  content         = <<-EOT
    # ╔══════════════════════════════════════════════════════════╗
    # ║  NGINX — Reverse Proxy                                  ║
    # ║  Généré automatiquement par Terraform                   ║
    # ║  Production  : http://${var.vps_ip}                     ║
    # ║  Staging     : http://${var.vps_ip}:${var.staging_port}               ║
    # ╚══════════════════════════════════════════════════════════╝

    events {
      worker_connections 1024;
    }

    http {

      # ── PRODUCTION (:${var.prod_port}) ───────────────────────────────────
      server {
        listen ${var.prod_port};
        server_name ${var.vps_ip};

        # Frontend React
        location / {
          proxy_pass         http://forex-frontend-prod:80;
          proxy_http_version 1.1;
          proxy_set_header   Host              $host;
          proxy_set_header   X-Real-IP         $remote_addr;
          proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        }

        # API Backend
        location /api/ {
          proxy_pass         http://forex-backend-prod:${var.backend_prod_port};
          proxy_http_version 1.1;
          proxy_set_header   Host              $host;
          proxy_read_timeout 60s;
        }

        # WebSocket
        location /ws {
          proxy_pass         http://forex-backend-prod:${var.backend_prod_port};
          proxy_http_version 1.1;
          proxy_set_header   Upgrade    $http_upgrade;
          proxy_set_header   Connection "upgrade";
          proxy_read_timeout 3600s;
        }

        # Webhook TradingView
        location /webhook {
          proxy_pass         http://forex-backend-prod:${var.backend_prod_port};
          proxy_http_version 1.1;
        }

        # Health check
        location /health {
          proxy_pass http://forex-backend-prod:${var.backend_prod_port}/health;
        }
      }

      # ── STAGING (:${var.staging_port}) ─────────────────────────────────
      server {
        listen ${var.staging_port};
        server_name ${var.vps_ip};

        # Bandeau staging visible dans les headers
        add_header X-Environment "staging" always;

        location / {
          proxy_pass         http://forex-frontend-staging:80;
          proxy_http_version 1.1;
          proxy_set_header   Host $host;
        }

        location /api/ {
          proxy_pass         http://forex-backend-staging:${var.backend_staging_port};
          proxy_http_version 1.1;
        }

        location /ws {
          proxy_pass         http://forex-backend-staging:${var.backend_staging_port};
          proxy_http_version 1.1;
          proxy_set_header   Upgrade    $http_upgrade;
          proxy_set_header   Connection "upgrade";
        }

        location /webhook {
          proxy_pass http://forex-backend-staging:${var.backend_staging_port};
        }

        location /health {
          proxy_pass http://forex-backend-staging:${var.backend_staging_port}/health;
        }
      }
    }
  EOT
}

# ════════════════════════════════════════════════════════════════
# GÉNÉRATION — infra/ansible/inventory.yml
# ════════════════════════════════════════════════════════════════

resource "local_file" "ansible_inventory" {
  filename        = "${path.module}/../ansible/inventory.yml"
  file_permission = "0644"
  content         = <<-EOT
    # Généré automatiquement par Terraform
    # Ne pas modifier manuellement

    all:
      hosts:
        vps_prod:
          ansible_host: ${var.vps_ip}
          ansible_user: ${var.vps_user}
          ansible_ssh_private_key_file: ~/.ssh/id_rsa
          ansible_ssh_common_args: '-o StrictHostKeyChecking=no'

      vars:
        project_name:        ${var.project_name}
        project_dir:         /home/${var.vps_user}/dockerFX
        prod_port:           ${var.prod_port}
        staging_port:        ${var.staging_port}
        backend_image:       ${var.backend_image}
        frontend_image:      ${var.frontend_image}
  EOT
}

# ════════════════════════════════════════════════════════════════
# GÉNÉRATION — .env.staging.example
# ════════════════════════════════════════════════════════════════

resource "local_file" "env_staging_example" {
  filename        = "${path.module}/../../.env.staging.example"
  file_permission = "0644"
  content         = <<-EOT
    # ════════════════════════════════════════════════════════════
    # STAGING — Template variables d'environnement
    # Généré par Terraform
    # Copier en .env.staging et remplir les valeurs réelles
    # Ne jamais committer .env.staging dans Git
    # ════════════════════════════════════════════════════════════

    PORT=${var.backend_staging_port}
    NODE_ENV=staging

    # cTrader (compte DEMO uniquement pour le staging)
    CTRADER_HOST=demo.ctraderapi.com
    CTRADER_CLIENT_ID=
    CTRADER_CLIENT_SECRET=
    CTRADER_ACCESS_TOKEN=
    CTRADER_REFRESH_TOKEN=
    CTRADER_ACCOUNT_ID=

    # Risk management réduit en staging
    RISK_PERCENT=0.1
    FALLBACK_BALANCE=10000
    MAX_OPEN_TRADES=2
    MAX_CORR_EXPOSURE=1

    # Telegram (peut être le même bot)
    TELEGRAM_TOKEN=
    TELEGRAM_CHATID=

    # Auth dashboard
    JWT_SECRET=staging-secret-32-chars-minimum-change-me
    DASHBOARD_LOGIN=
    DASHBOARD_PASSWORD=

    # Drawdown
    MAX_DAILY_DD=4
    HARD_STOP_DD=5
    MAX_TOTAL_DD=10

    DATA_DIR=/app/data
  EOT
}

# ════════════════════════════════════════════════════════════════
# VÉRIFICATION — Affiche un résumé après terraform apply
# ════════════════════════════════════════════════════════════════

resource "null_resource" "summary" {
  triggers = {
    prod_hash    = local_file.docker_compose_prod.content
    staging_hash = local_file.docker_compose_staging.content
    nginx_hash   = local_file.nginx_conf.content
  }

  provisioner "local-exec" {
    command = <<-EOT
      echo ""
      echo "╔══════════════════════════════════════════════════╗"
      echo "║  ✅  Terraform apply terminé                     ║"
      echo "╠══════════════════════════════════════════════════╣"
      echo "║  Fichiers générés :                              ║"
      echo "║    docker-compose.prod.yml                       ║"
      echo "║    docker-compose.staging.yml                    ║"
      echo "║    nginx/nginx.conf                              ║"
      echo "║    infra/ansible/inventory.yml                   ║"
      echo "║    .env.staging.example                          ║"
      echo "╠══════════════════════════════════════════════════╣"
      echo "║  Prochaine étape :                               ║"
      echo "║  ansible-playbook \\                              ║"
      echo "║    -i infra/ansible/inventory.yml \\              ║"
      echo "║    infra/ansible/playbook.yml                    ║"
      echo "╚══════════════════════════════════════════════════╝"
      echo ""
    EOT
  }

  depends_on = [
    local_file.docker_compose_prod,
    local_file.docker_compose_staging,
    local_file.nginx_conf,
    local_file.ansible_inventory,
    local_file.env_staging_example,
  ]
}
