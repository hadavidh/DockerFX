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
# VARIABLES
# ════════════════════════════════════════════════════════════════
# (inchangé ici — tes variables existantes restent valides)

# ════════════════════════════════════════════════════════════════
# GÉNÉRATION — docker-stack.prod.yml (LEGACY Docker SWARM prod)
# On le garde pour ne rien casser à l'existant
# ════════════════════════════════════════════════════════════════

resource "local_file" "docker_stack_prod" {
  filename        = "${path.module}/../../docker-stack.prod.yml"
  file_permission = "0644"
  content         = <<-EOT
    # ╔══════════════════════════════════════════════════════════╗
    # ║  DOCKER SWARM STACK — PRODUCTION (LEGACY)               ║
    # ║  Généré automatiquement par Terraform                   ║
    # ║  Ne pas modifier manuellement                           ║
    # ║                                                         ║
    # ║  Déploiement :                                          ║
    # ║    docker stack deploy -c docker-stack.prod.yml ict-prod║
    # ║                                                         ║
    # ║  Scaling :                                              ║
    # ║    docker service scale ict-prod_backend=3              ║
    # ╚══════════════════════════════════════════════════════════╝

    services:

      backend:
        image: dave67000/ict-trading-backend:latest
        networks:
          - trading-net
        env_file: .env.prod
        deploy:
          replicas: 2
          update_config:
            parallelism: 1
            delay: 10s
            order: start-first
            failure_action: rollback
          rollback_config:
            parallelism: 1
            delay: 5s
          restart_policy:
            condition: on-failure
            delay: 5s
            max_attempts: 3
            window: 120s
          resources:
            limits:
              cpus: '0.5'
              memory: 300M
            reservations:
              cpus: '0.1'
              memory: 100M
        healthcheck:
          test: ["CMD", "wget", "-qO-", "http://localhost:3001/health"]
          interval: 30s
          timeout: 5s
          retries: 3
          start_period: 15s

      frontend:
        image: dave67000/ict-trading-frontend:latest
        ports:
          - "80:80"
          - "443:443"
        volumes:
          - /home/ubuntu/dockerFX/ssl:/etc/nginx/ssl:ro
        networks:
          - trading-net
        deploy:
          replicas: 2
          update_config:
            parallelism: 1
            delay: 10s
            order: start-first
            failure_action: rollback
          restart_policy:
            condition: on-failure
            delay: 5s
            max_attempts: 3
          resources:
            limits:
              cpus: '0.3'
              memory: 100M
            reservations:
              cpus: '0.05'
              memory: 50M
        healthcheck:
          test: ["CMD-SHELL", "wget --no-check-certificate -qO- https://localhost/ > /dev/null 2>&1 || exit 1"]
          interval: 30s
          timeout: 5s
          retries: 3
          start_period: 30s

    networks:
      trading-net:
        driver: overlay
        attachable: true
  EOT
}

# ════════════════════════════════════════════════════════════════
# GÉNÉRATION — docker-compose.staging.yml
# Compatible avec staging-build.yml / staging-deploy.yml
# ════════════════════════════════════════════════════════════════

resource "local_file" "docker_compose_staging" {
  filename        = "${path.module}/../../docker-compose.staging.yml"
  file_permission = "0644"
  content         = <<-EOT
    # ╔══════════════════════════════════════════════════════════╗
    # ║  STAGING — ICT Trading Dashboard                        ║
    # ║  Généré automatiquement par Terraform                   ║
    # ║  Accessible sur http://${var.vps_ip}:${var.staging_port} ║
    # ╚══════════════════════════════════════════════════════════╝

    services:

      backend:
        image: $${BACKEND_IMAGE:-${var.backend_image}:develop}
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
        image: $${FRONTEND_IMAGE:-${var.frontend_image}:develop}
        restart: unless-stopped
        ports:
          - "${var.staging_port}:80"
        volumes:
          - ./frontend/nginx.staging.conf:/etc/nginx/conf.d/default.conf:ro
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
        external: true
        name: trading-staging
  EOT
}

# ════════════════════════════════════════════════════════════════
# GÉNÉRATION — docker-compose.prod.yml
# Compatible avec production-build.yml / production-deploy.yml
# ════════════════════════════════════════════════════════════════

resource "local_file" "docker_compose_prod" {
  filename        = "${path.module}/../../docker-compose.prod.yml"
  file_permission = "0644"
  content         = <<-EOT
    # ╔══════════════════════════════════════════════════════════╗
    # ║  PRODUCTION — ICT Trading Dashboard                     ║
    # ║  Généré automatiquement par Terraform                   ║
    # ║  Accessible sur http://${var.vps_ip}:${var.prod_port}   ║
    # ╚══════════════════════════════════════════════════════════╝

    services:

      backend:
        image: $${BACKEND_IMAGE:-${var.backend_image}:latest}
        restart: unless-stopped
        env_file: .env.prod
        expose:
          - "${var.backend_prod_port}"
        environment:
          - PORT=${var.backend_prod_port}
          - NODE_ENV=production
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
        image: $${FRONTEND_IMAGE:-${var.frontend_image}:latest}
        restart: unless-stopped
        ports:
          - "${var.prod_port}:80"
        volumes:
          - ./frontend/nginx.conf:/etc/nginx/conf.d/default.conf:ro
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
        external: true
        name: trading-prod
  EOT
}

# ════════════════════════════════════════════════════════════════
# GÉNÉRATION — frontend/nginx.conf
# PROD — utilisé dans l'image Docker / ou monté en compose prod
# ════════════════════════════════════════════════════════════════

resource "local_file" "nginx_frontend_prod" {
  filename        = "${path.module}/../../frontend/nginx.conf"
  file_permission = "0644"
  content         = <<-EOT
    # ╔══════════════════════════════════════════════════════════╗
    # ║  NGINX — Config PRODUCTION HTTPS                        ║
    # ║  Généré automatiquement par Terraform                   ║
    # ╚══════════════════════════════════════════════════════════╝

    server {
        listen 80;
        server_name dockerfx.trade www.dockerfx.trade;

        return 301 https://$host$request_uri;
    }

    server {
        listen 443 ssl http2;
        server_name dockerfx.trade www.dockerfx.trade;

        ssl_certificate     /etc/nginx/ssl/cloudflare-origin.crt;
        ssl_certificate_key /etc/nginx/ssl/cloudflare-origin.key;

        root /usr/share/nginx/html;
        index index.html;

        resolver 127.0.0.11 valid=30s ipv6=off;
        set $backend "backend:3001";

        location / {
            try_files $uri $uri/ /index.html;
        }

        location /api/ {
            proxy_pass         http://$backend;
            proxy_http_version 1.1;
            proxy_set_header   Host              $host;
            proxy_set_header   X-Real-IP         $remote_addr;
            proxy_read_timeout 60s;
        }

        location /ws {
            proxy_pass         http://$backend;
            proxy_http_version 1.1;
            proxy_set_header   Upgrade    $http_upgrade;
            proxy_set_header   Connection "upgrade";
            proxy_read_timeout 3600s;
        }

        location /webhook {
            proxy_pass http://$backend;
        }

        location /health {
            proxy_pass http://$backend/health;
        }

        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }

        server_tokens off;
    }
  EOT
}

# ════════════════════════════════════════════════════════════════
# GÉNÉRATION — frontend/nginx.staging.conf
# STAGING — upstream = backend (service Compose)
# ════════════════════════════════════════════════════════════════

resource "local_file" "nginx_frontend_staging" {
  filename        = "${path.module}/../../frontend/nginx.staging.conf"
  file_permission = "0644"
  content         = <<-EOT
    # ╔══════════════════════════════════════════════════════════╗
    # ║  NGINX — Config STAGING (montée en volume)              ║
    # ║  Upstream = backend (service Docker Compose)            ║
    # ║  Généré automatiquement par Terraform                   ║
    # ╚══════════════════════════════════════════════════════════╝

    server {
        listen 80;
        server_name _;

        root /usr/share/nginx/html;
        index index.html;

        resolver 127.0.0.11 valid=30s ipv6=off;
        set $backend_staging "backend:${var.backend_staging_port}";

        location / {
            try_files $uri $uri/ /index.html;
        }

        location /api/ {
            proxy_pass         http://$backend_staging;
            proxy_http_version 1.1;
            proxy_set_header   Host $host;
            proxy_read_timeout 60s;
        }

        location /ws {
            proxy_pass         http://$backend_staging;
            proxy_http_version 1.1;
            proxy_set_header   Upgrade    $http_upgrade;
            proxy_set_header   Connection "upgrade";
        }

        location /webhook {
            proxy_pass http://$backend_staging;
        }

        location /health {
            proxy_pass http://$backend_staging/health;
        }

        server_tokens off;
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
    # Généré automatiquement par Terraform — ne pas modifier

    all:
      hosts:
        vps_prod:
          ansible_host:       localhost
          ansible_connection: local
          ansible_user:       ${var.vps_user}

      vars:
        project_name:   ${var.project_name}
        project_dir:    /home/${var.vps_user}/dockerFX
        prod_port:      ${var.prod_port}
        staging_port:   ${var.staging_port}
        backend_image:  ${var.backend_image}
        frontend_image: ${var.frontend_image}
  EOT
}

# ════════════════════════════════════════════════════════════════
# GÉNÉRATION — .env.staging.example
# ════════════════════════════════════════════════════════════════

resource "local_file" "env_staging_example" {
  filename        = "${path.module}/../../.env.staging.example"
  file_permission = "0644"
  content         = <<-EOT
    # STAGING — Template variables d'environnement
    # Généré par Terraform
    # Copier en .env.staging et remplir les valeurs réelles
    # Ne jamais committer .env.staging dans Git

    PORT=${var.backend_staging_port}
    NODE_ENV=staging

    CTRADER_HOST=demo.ctraderapi.com
    CTRADER_CLIENT_ID=
    CTRADER_CLIENT_SECRET=
    CTRADER_ACCESS_TOKEN=
    CTRADER_REFRESH_TOKEN=
    CTRADER_ACCOUNT_ID=

    RISK_PERCENT=0.1
    FALLBACK_BALANCE=10000
    MAX_OPEN_TRADES=2
    MAX_CORR_EXPOSURE=1

    TELEGRAM_TOKEN=
    TELEGRAM_CHATID=

    JWT_SECRET=staging-secret-32-chars-minimum-change-me
    DASHBOARD_LOGIN=
    DASHBOARD_PASSWORD=

    MAX_DAILY_DD=4
    HARD_STOP_DD=5
    MAX_TOTAL_DD=10

    DATA_DIR=/app/data
  EOT
}

# ════════════════════════════════════════════════════════════════
# RÉSUMÉ — Affiché après terraform apply
# ════════════════════════════════════════════════════════════════

resource "null_resource" "summary" {
  triggers = {
    stack_hash        = local_file.docker_stack_prod.content
    staging_hash      = local_file.docker_compose_staging.content
    prod_compose_hash = local_file.docker_compose_prod.content
    nginx_hash        = local_file.nginx_frontend_prod.content
  }

  provisioner "local-exec" {
    command = <<-EOT
      echo ""
      echo "╔══════════════════════════════════════════════════╗"
      echo "║  ✅  Terraform apply terminé                     ║"
      echo "╠══════════════════════════════════════════════════╣"
      echo "║  Fichiers générés :                              ║"
      echo "║    docker-stack.prod.yml       (legacy Swarm)    ║"
      echo "║    docker-compose.staging.yml  (staging Compose) ║"
      echo "║    docker-compose.prod.yml     (prod Compose)    ║"
      echo "║    frontend/nginx.conf         (prod Nginx)      ║"
      echo "║    frontend/nginx.staging.conf (staging Nginx)   ║"
      echo "║    infra/ansible/inventory.yml                   ║"
      echo "║    .env.staging.example                          ║"
      echo "╠══════════════════════════════════════════════════╣"
      echo "║  Prochaine étape :                               ║"
      echo "║    vérifier les workflows GitHub Actions         ║"
      echo "║    puis déployer staging / production            ║"
      echo "╚══════════════════════════════════════════════════╝"
      echo ""
    EOT
  }

  depends_on = [
    local_file.docker_stack_prod,
    local_file.docker_compose_staging,
    local_file.docker_compose_prod,
    local_file.nginx_frontend_prod,
    local_file.nginx_frontend_staging,
    local_file.ansible_inventory,
    local_file.env_staging_example,
  ]
}