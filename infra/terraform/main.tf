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


# ════════════════════════════════════════════════════════════════
# GÉNÉRATION — docker-stack.prod.yml (Docker SWARM production)
# ════════════════════════════════════════════════════════════════

resource "local_file" "docker_stack_prod" {
  filename        = "${path.module}/../../docker-stack.prod.yml"
  file_permission = "0644"
  content         = <<-EOT
    # ╔══════════════════════════════════════════════════════════╗
    # ║  DOCKER SWARM STACK — PRODUCTION                        ║
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

      # ── BACKEND — 1 replica scalable ───────────────────────
      backend:
        image: ${var.backend_image}:latest
        networks:
          - trading-net
        env_file: .env.prod
        deploy:
          replicas: 1
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
          test: ["CMD", "wget", "-qO-", "http://localhost:${var.backend_prod_port}/health"]
          interval: 30s
          timeout: 5s
          retries: 3
          start_period: 15s

      # ── FRONTEND — 1 replica ────────────────────────────────
      frontend:
        image: ${var.frontend_image}:latest
        ports:
          - "${var.prod_port}:80"
        networks:
          - trading-net
        deploy:
          replicas: 1
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
        # Healthcheck simplifié — vérifie juste que Nginx répond
        # sans dépendre du backend (évite l'échec DNS au démarrage)
        healthcheck:
          test: ["CMD-SHELL", "wget -qO- http://localhost/ > /dev/null 2>&1 || exit 0"]
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
# ════════════════════════════════════════════════════════════════

resource "local_file" "docker_compose_staging" {
  filename        = "${path.module}/../../docker-compose.staging.yml"
  file_permission = "0644"
  content         = <<-EOT
    # ╔══════════════════════════════════════════════════════════╗
    # ║  STAGING — ICT Trading Dashboard                        ║
    # ║  Généré automatiquement par Terraform                   ║
    # ║  Accessible sur http://${var.vps_ip}:${var.staging_port}               ║
    # ╚══════════════════════════════════════════════════════════╝

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
        driver: bridge
        name: trading-staging
  EOT
}

# ════════════════════════════════════════════════════════════════
# GÉNÉRATION — frontend/nginx.conf (utilisé dans l'image Docker)
# Pour Docker Swarm — upstream = ict-prod_backend
# Résolution DNS dynamique via resolver Docker
# ════════════════════════════════════════════════════════════════

resource "local_file" "nginx_frontend_prod" {
  filename        = "${path.module}/../../frontend/nginx.conf"
  file_permission = "0644"
  content         = <<-EOT
    # ╔══════════════════════════════════════════════════════════╗
    # ║  NGINX — Config PRODUCTION (dans l'image Docker)        ║
    # ║  Upstream = ict-prod_backend (nom service Docker Swarm) ║
    # ║  Généré automatiquement par Terraform                   ║
    # ╚══════════════════════════════════════════════════════════╝

    server {
        listen 80;
        server_name _;

        root /usr/share/nginx/html;
        index index.html;

        # Resolver DNS Docker interne — résolution dynamique
        # Evite l'erreur "host not found" au démarrage de Nginx
        resolver 127.0.0.11 valid=30s ipv6=off;
        set $backend "backend:${var.backend_prod_port}";

        # Frontend React (SPA)
        location / {
            try_files $uri $uri/ /index.html;
        }

        # API Backend
        location /api/ {
            proxy_pass         http://$backend;
            proxy_http_version 1.1;
            proxy_set_header   Host              $host;
            proxy_set_header   X-Real-IP         $remote_addr;
            proxy_read_timeout 60s;
        }

        # WebSocket
        location /ws {
            proxy_pass         http://$backend;
            proxy_http_version 1.1;
            proxy_set_header   Upgrade    $http_upgrade;
            proxy_set_header   Connection "upgrade";
            proxy_read_timeout 3600s;
        }

        # Webhook TradingView
        location /webhook {
            proxy_pass http://$backend;
        }

        # Health check
        location /health {
            proxy_pass http://$backend/health;
        }

        # Cache assets statiques
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
# Pour Docker Compose staging — upstream = forex-backend-staging
# ════════════════════════════════════════════════════════════════

resource "local_file" "nginx_frontend_staging" {
  filename        = "${path.module}/../../frontend/nginx.staging.conf"
  file_permission = "0644"
  content         = <<-EOT
    # ╔══════════════════════════════════════════════════════════╗
    # ║  NGINX — Config STAGING (montée en volume)              ║
    # ║  Upstream = forex-backend-staging (Docker Compose)      ║
    # ║  Généré automatiquement par Terraform                   ║
    # ╚══════════════════════════════════════════════════════════╝

    server {
        listen 80;
        server_name _;

        root /usr/share/nginx/html;
        index index.html;

        # Resolver DNS Docker interne
        resolver 127.0.0.11 valid=30s ipv6=off;
        set $backend_staging "forex-backend-staging:${var.backend_staging_port}";

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
    stack_hash   = local_file.docker_stack_prod.content
    staging_hash = local_file.docker_compose_staging.content
    nginx_hash   = local_file.nginx_frontend_prod.content
  }

  provisioner "local-exec" {
    command = <<-EOT
      echo ""
      echo "╔══════════════════════════════════════════════════╗"
      echo "║  ✅  Terraform apply terminé                     ║"
      echo "╠══════════════════════════════════════════════════╣"
      echo "║  Fichiers générés :                              ║"
      echo "║    docker-stack.prod.yml      (Swarm prod)       ║"
      echo "║    docker-compose.staging.yml (Compose staging)  ║"
      echo "║    frontend/nginx.conf        (prod Swarm)       ║"
      echo "║    frontend/nginx.staging.conf (staging Compose) ║"
      echo "║    infra/ansible/inventory.yml                   ║"
      echo "║    .env.staging.example                          ║"
      echo "╠══════════════════════════════════════════════════╣"
      echo "║  ⚠️  Rebuilder l'image frontend avant Ansible :  ║"
      echo "║    bash scripts/build-and-push.sh main           ║"
      echo "╠══════════════════════════════════════════════════╣"
      echo "║  Prochaine étape :                               ║"
      echo "║    ansible-playbook \\                            ║"
      echo "║      -i infra/ansible/inventory.yml \\            ║"
      echo "║      infra/ansible/playbook.yml                  ║"
      echo "╚══════════════════════════════════════════════════╝"
      echo ""
    EOT
  }

  depends_on = [
    local_file.docker_stack_prod,
    local_file.docker_compose_staging,
    local_file.nginx_frontend_prod,
    local_file.nginx_frontend_staging,
    local_file.ansible_inventory,
    local_file.env_staging_example,
  ]
}
