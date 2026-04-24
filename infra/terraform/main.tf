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
# GÉNÉRATION — docker-stack.prod.yml
# PROD derrière un gateway Nginx hôte
# ════════════════════════════════════════════════════════════════

resource "local_file" "docker_stack_prod" {
  filename        = "${path.module}/../../docker-stack.prod.yml"
  file_permission = "0644"
  content         = <<-EOT
    # ╔══════════════════════════════════════════════════════════╗
    # ║  DOCKER SWARM STACK — PRODUCTION (GATEWAY READY)        ║
    # ║  Généré automatiquement par Terraform                   ║
    # ║  Ne pas modifier manuellement                           ║
    # ║                                                         ║
    # ║  Accès public : https://${var.domain_name}              ║
    # ║  Gateway hôte : 80/443                                  ║
    # ║  Origin prod  : 127.0.0.1:${var.prod_origin_https_port} ║
    # ╚══════════════════════════════════════════════════════════╝

    services:

      backend:
        image: ${var.backend_image}:latest
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
          test: ["CMD", "wget", "-qO-", "http://127.0.0.1:${var.backend_prod_port}/health"]
          interval: 30s
          timeout: 5s
          retries: 3
          start_period: 15s

      frontend:
        image: ${var.frontend_image}:latest
        ports:
          - "${var.prod_origin_https_port}:443"
        volumes:
          - ${var.ssl_dir}:/etc/nginx/ssl:ro
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
            condition: any
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
          test: ["CMD-SHELL", "wget --no-check-certificate -qO- https://127.0.0.1/ > /dev/null 2>&1 || exit 1"]
          interval: 30s
          timeout: 5s
          retries: 3
          start_period: 45s

    networks:
      trading-net:
        driver: overlay
        attachable: true
  EOT
}

# ════════════════════════════════════════════════════════════════
# GÉNÉRATION — docker-compose.staging.yml
# STAGING derrière le gateway Nginx hôte
# Exposition locale uniquement sur 127.0.0.1:${var.staging_port}
# Réseau external: true pour éviter le conflit de labels Compose
# ════════════════════════════════════════════════════════════════

resource "local_file" "docker_compose_staging" {
  filename        = "${path.module}/../../docker-compose.staging.yml"
  file_permission = "0644"
  content         = <<-EOT
    # ╔══════════════════════════════════════════════════════════╗
    # ║  STAGING — ICT Trading Dashboard (GATEWAY READY)        ║
    # ║  Généré automatiquement par Terraform                   ║
    # ║  Accès public : https://${var.staging_domain}           ║
    # ║  Origin local : http://127.0.0.1:${var.staging_port}    ║
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
          test: ["CMD","wget","-qO-","http://127.0.0.1:${var.backend_staging_port}/health"]
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
          - "127.0.0.1:${var.staging_port}:80"
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
# GÉNÉRATION — dockerfx-gateway.conf
# ════════════════════════════════════════════════════════════════

resource "local_file" "dockerfx_gateway_conf" {
  filename        = "${path.module}/../../dockerfx-gateway.conf"
  file_permission = "0644"
  content         = <<-EOT
    # /etc/nginx/sites-available/dockerfx-gateway.conf

    server {
        listen 80;
        listen [::]:80;
        server_name ${var.domain_name} ${var.domain_www} ${var.staging_domain};

        return 301 https://$host$request_uri;
    }

    server {
        listen 443 ssl;
        listen [::]:443 ssl;
        http2 on;
        server_name ${var.domain_name} ${var.domain_www};

        ssl_certificate     ${var.ssl_dir}/cloudflare-origin.crt;
        ssl_certificate_key ${var.ssl_dir}/cloudflare-origin.key;

        location / {
            proxy_pass https://127.0.0.1:${var.prod_origin_https_port};
            proxy_ssl_verify off;

            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Forwarded-Proto https;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
        }
    }

    server {
        listen 443 ssl;
        listen [::]:443 ssl;
        http2 on;
        server_name ${var.staging_domain};

        ssl_certificate     ${var.ssl_dir}/cloudflare-origin.crt;
        ssl_certificate_key ${var.ssl_dir}/cloudflare-origin.key;

        location / {
            proxy_pass http://127.0.0.1:${var.staging_port};

            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Forwarded-Proto https;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
        }
    }
  EOT
}

# ════════════════════════════════════════════════════════════════
# GÉNÉRATION — frontend/nginx.conf
# ════════════════════════════════════════════════════════════════

resource "local_file" "nginx_frontend_prod" {
  filename        = "${path.module}/../../frontend/nginx.conf"
  file_permission = "0644"
  content         = <<-EOT
    server {
        listen 80;
        server_name ${var.domain_name} ${var.domain_www};

        return 301 https://$host$request_uri;
    }

    server {
        listen 443 ssl;
        http2 on;
        server_name ${var.domain_name} ${var.domain_www};

        ssl_certificate     /etc/nginx/ssl/cloudflare-origin.crt;
        ssl_certificate_key /etc/nginx/ssl/cloudflare-origin.key;

        root /usr/share/nginx/html;
        index index.html;

        resolver 127.0.0.11 valid=30s ipv6=off;
        set $backend "backend:${var.backend_prod_port}";

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
            return 200 "ok\n";
            add_header Content-Type text/plain;
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
# ════════════════════════════════════════════════════════════════

resource "local_file" "nginx_frontend_staging" {
  filename        = "${path.module}/../../frontend/nginx.staging.conf"
  file_permission = "0644"
  content         = <<-EOT
    server {
        listen 80;
        server_name ${var.staging_domain};

        root /usr/share/nginx/html;
        index index.html;

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
        project_name:            ${var.project_name}
        project_dir:             /home/${var.vps_user}/dockerFX
        prod_port:               ${var.prod_port}
        prod_https_port:         ${var.prod_https_port}
        prod_origin_https_port:  ${var.prod_origin_https_port}
        staging_port:            ${var.staging_port}
        backend_image:           ${var.backend_image}
        frontend_image:          ${var.frontend_image}
        domain_name:             ${var.domain_name}
        domain_www:              ${var.domain_www}
        staging_domain:          ${var.staging_domain}
        ssl_dir:                 ${var.ssl_dir}
        gateway_conf_path:       /etc/nginx/sites-available/dockerfx-gateway.conf
  EOT
}

# ════════════════════════════════════════════════════════════════
# GÉNÉRATION — .env.staging.example
# ════════════════════════════════════════════════════════════════

resource "local_file" "env_staging_example" {
  filename        = "${path.module}/../../.env.staging.example"
  file_permission = "0644"
  content         = <<-EOT
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

resource "null_resource" "summary" {
  triggers = {
    stack_hash     = local_file.docker_stack_prod.content
    staging_hash   = local_file.docker_compose_staging.content
    gateway_hash   = local_file.dockerfx_gateway_conf.content
    nginx_hash     = local_file.nginx_frontend_prod.content
    inventory_hash = local_file.ansible_inventory.content
  }

  provisioner "local-exec" {
    command = <<-EOT
      echo ""
      echo "╔══════════════════════════════════════════════════╗"
      echo "║  ✅  Terraform apply terminé                     ║"
      echo "╠══════════════════════════════════════════════════╣"
      echo "║  Fichiers générés :                              ║"
      echo "║    docker-stack.prod.yml      (prod gateway)     ║"
      echo "║    docker-compose.staging.yml (staging external) ║"
      echo "║    dockerfx-gateway.conf      (nginx hôte)       ║"
      echo "║    frontend/nginx.conf        (prod HTTPS)       ║"
      echo "║    frontend/nginx.staging.conf (staging)         ║"
      echo "║    infra/ansible/inventory.yml                   ║"
      echo "║    .env.staging.example                          ║"
      echo "╠══════════════════════════════════════════════════╣"
      echo "║  Accès cible :                                   ║"
      echo "║    PROD    : https://${var.domain_name}          ║"
      echo "║    STAGING : https://${var.staging_domain}       ║"
      echo "╚══════════════════════════════════════════════════╝"
      echo ""
    EOT
  }

  depends_on = [
    local_file.docker_stack_prod,
    local_file.docker_compose_staging,
    local_file.dockerfx_gateway_conf,
    local_file.nginx_frontend_prod,
    local_file.nginx_frontend_staging,
    local_file.ansible_inventory,
    local_file.env_staging_example,
  ]
}
