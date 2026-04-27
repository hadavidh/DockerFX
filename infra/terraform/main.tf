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
        grafana_port:            ${var.grafana_port}
        grafana_admin_user:      ${var.grafana_admin_user}
        grafana_admin_password:  ${var.grafana_admin_password}
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

# ════════════════════════════════════════════════════════════════
# MONITORING — Prometheus + Grafana + Node Exporter + cAdvisor
# Génère tous les fichiers de configuration du monitoring
# ════════════════════════════════════════════════════════════════

resource "local_file" "docker_compose_monitoring" {
  filename        = "${path.module}/../../docker-compose.monitoring.yml"
  file_permission = "0644"
  content         = <<-EOT
    # ╔══════════════════════════════════════════════════════════╗
    # ║  MONITORING STACK — ICT Trading Dashboard               ║
    # ║  Généré automatiquement par Terraform                   ║
    # ║  Prometheus + Node Exporter + cAdvisor + Grafana        ║
    # ║  Grafana : http://${var.vps_ip}:${var.grafana_port}     ║
    # ╚══════════════════════════════════════════════════════════╝

    services:

      prometheus:
        image: prom/prometheus:latest
        container_name: prometheus
        restart: unless-stopped
        volumes:
          - ${var.project_dir}/monitoring/prometheus.yml:/etc/prometheus/prometheus.yml:ro
          - prometheus_data:/prometheus
        command:
          - '--config.file=/etc/prometheus/prometheus.yml'
          - '--storage.tsdb.path=/prometheus'
          - '--storage.tsdb.retention.time=15d'
          - '--web.enable-lifecycle'
        networks:
          - monitoring-net
          - trading-net
        ports:
          - "127.0.0.1:${var.prometheus_port}:9090"

      node-exporter:
        image: prom/node-exporter:latest
        container_name: node-exporter
        restart: unless-stopped
        pid: host
        volumes:
          - /proc:/host/proc:ro
          - /sys:/host/sys:ro
          - /:/rootfs:ro
        command:
          - '--path.procfs=/host/proc'
          - '--path.sysfs=/host/sys'
          - '--path.rootfs=/rootfs'
          - '--collector.filesystem.mount-points-exclude=^/(sys|proc|dev|host|etc)($$|/)'
        networks:
          - monitoring-net

      cadvisor:
        image: gcr.io/cadvisor/cadvisor:latest
        container_name: cadvisor
        restart: unless-stopped
        privileged: true
        devices:
          - /dev/kmsg:/dev/kmsg
        volumes:
          - /:/rootfs:ro
          - /var/run:/var/run:ro
          - /sys:/sys:ro
          - /var/lib/docker:/var/lib/docker:ro
          - /cgroup:/cgroup:ro
        networks:
          - monitoring-net

      grafana:
        image: grafana/grafana:latest
        container_name: grafana
        restart: unless-stopped
        environment:
          - GF_SECURITY_ADMIN_USER=${var.grafana_admin_user}
          - GF_SECURITY_ADMIN_PASSWORD=${var.grafana_admin_password}
          - GF_USERS_ALLOW_SIGN_UP=false
          - GF_ANALYTICS_REPORTING_ENABLED=false
          - GF_SERVER_ROOT_URL=http://${var.vps_ip}:${var.grafana_port}
        volumes:
          - grafana_data:/var/lib/grafana
          - ${var.project_dir}/monitoring/grafana/provisioning:/etc/grafana/provisioning:ro
          - ${var.project_dir}/monitoring/grafana/dashboards:/var/lib/grafana/dashboards:ro
        ports:
          - "${var.grafana_port}:3000"
        networks:
          - monitoring-net
        depends_on:
          - prometheus

    networks:
      monitoring-net:
        driver: bridge
      trading-net:
        external: true
        name: ict-prod_trading-net

    volumes:
      prometheus_data:
      grafana_data:
  EOT
}

resource "local_file" "prometheus_config" {
  filename        = "${path.module}/../../monitoring/prometheus.yml"
  file_permission = "0644"
  content         = <<-EOT
    global:
      scrape_interval: 15s
      evaluation_interval: 15s

    scrape_configs:
      - job_name: 'prometheus'
        static_configs:
          - targets: ['localhost:9090']

      - job_name: 'node-exporter'
        static_configs:
          - targets: ['node-exporter:9100']
        relabel_configs:
          - source_labels: [__address__]
            target_label: instance
            replacement: 'vps-ovh'

      - job_name: 'cadvisor'
        static_configs:
          - targets: ['cadvisor:8080']

      - job_name: 'ict-trading-backend'
        static_configs:
          - targets: ['backend:${var.backend_prod_port}']
            labels:
              app: 'ict-trading-backend'
              env: 'production'
        metrics_path: '/metrics'
        scrape_interval: 15s
  EOT
}

resource "local_file" "grafana_datasource" {
  filename        = "${path.module}/../../monitoring/grafana/provisioning/datasources/datasource.yml"
  file_permission = "0644"
  content         = <<-EOT
    apiVersion: 1
    datasources:
      - name: Prometheus
        type: prometheus
        access: proxy
        url: http://prometheus:${var.prometheus_port}
        isDefault: true
        editable: false
        uid: ${var.grafana_datasource_uid}
        jsonData:
          timeInterval: '15s'
          httpMethod: POST
  EOT
}

resource "local_file" "grafana_dashboards_provisioning" {
  filename        = "${path.module}/../../monitoring/grafana/provisioning/dashboards/dashboards.yml"
  file_permission = "0644"
  content         = <<-EOT
    apiVersion: 1
    providers:
      - name: 'ICT Trading'
        orgId: 1
        folder: 'ICT Trading'
        type: file
        disableDeletion: false
        updateIntervalSeconds: 30
        allowUiUpdates: true
        options:
          path: /var/lib/grafana/dashboards
  EOT
}

resource "local_file" "grafana_dashboard_json" {
  filename        = "${path.module}/../../monitoring/grafana/dashboards/ict-trading.json"
  file_permission = "0644"
  content         = <<-EOT
    {
      "title": "ICT Trading Dashboard \u2014 Monitoring",
      "uid": "ict-trading-monitoring",
      "schemaVersion": 38,
      "version": 1,
      "refresh": "15s",
      "time": { "from": "now-1h", "to": "now" },
      "timezone": "Europe/Brussels",
      "tags": ["trading", "ict", "production"],
      "panels": [
        { "type": "row", "title": "Systeme VPS", "id": 100, "gridPos": { "x": 0, "y": 0, "w": 24, "h": 1 }, "collapsed": false },
        { "id": 1, "title": "CPU %", "type": "gauge", "gridPos": { "x": 0, "y": 1, "w": 4, "h": 4 }, "datasource": { "type": "prometheus", "uid": "${var.grafana_datasource_uid}" }, "targets": [{ "expr": "100 - (avg(rate(node_cpu_seconds_total{mode=\"idle\"}[5m])) * 100)", "legendFormat": "CPU" }], "fieldConfig": { "defaults": { "unit": "percent", "min": 0, "max": 100, "thresholds": { "mode": "absolute", "steps": [{ "color": "green", "value": null }, { "color": "orange", "value": 60 }, { "color": "red", "value": 80 }] } } }, "options": { "reduceOptions": { "calcs": ["lastNotNull"] }, "showThresholdLabels": false, "showThresholdMarkers": true } },
        { "id": 2, "title": "RAM %", "type": "gauge", "gridPos": { "x": 4, "y": 1, "w": 4, "h": 4 }, "datasource": { "type": "prometheus", "uid": "${var.grafana_datasource_uid}" }, "targets": [{ "expr": "(1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)) * 100", "legendFormat": "RAM" }], "fieldConfig": { "defaults": { "unit": "percent", "min": 0, "max": 100, "thresholds": { "mode": "absolute", "steps": [{ "color": "green", "value": null }, { "color": "orange", "value": 70 }, { "color": "red", "value": 85 }] } } }, "options": { "reduceOptions": { "calcs": ["lastNotNull"] }, "showThresholdLabels": false, "showThresholdMarkers": true } },
        { "id": 3, "title": "Disque %", "type": "gauge", "gridPos": { "x": 8, "y": 1, "w": 4, "h": 4 }, "datasource": { "type": "prometheus", "uid": "${var.grafana_datasource_uid}" }, "targets": [{ "expr": "(1 - (node_filesystem_avail_bytes{mountpoint=\"/\",fstype!=\"tmpfs\"} / node_filesystem_size_bytes{mountpoint=\"/\",fstype!=\"tmpfs\"})) * 100", "legendFormat": "Disque" }], "fieldConfig": { "defaults": { "unit": "percent", "min": 0, "max": 100, "thresholds": { "mode": "absolute", "steps": [{ "color": "green", "value": null }, { "color": "orange", "value": 70 }, { "color": "red", "value": 85 }] } } }, "options": { "reduceOptions": { "calcs": ["lastNotNull"] }, "showThresholdLabels": false, "showThresholdMarkers": true } },
        { "id": 4, "title": "cTrader Connecte", "type": "stat", "gridPos": { "x": 12, "y": 1, "w": 4, "h": 4 }, "datasource": { "type": "prometheus", "uid": "${var.grafana_datasource_uid}" }, "targets": [{ "expr": "trading_ctrader_connected", "legendFormat": "cTrader" }], "fieldConfig": { "defaults": { "unit": "short", "min": 0, "max": 1, "mappings": [{ "type": "value", "options": { "0": { "text": "DECONNECTE", "color": "red", "index": 0 }, "1": { "text": "CONNECTE", "color": "green", "index": 1 } } }], "thresholds": { "mode": "absolute", "steps": [{ "color": "red", "value": null }, { "color": "green", "value": 1 }] } } }, "options": { "reduceOptions": { "calcs": ["lastNotNull"] }, "colorMode": "background", "textMode": "auto", "graphMode": "none" } },
        { "id": 5, "title": "WS Connectes", "type": "stat", "gridPos": { "x": 16, "y": 1, "w": 4, "h": 4 }, "datasource": { "type": "prometheus", "uid": "${var.grafana_datasource_uid}" }, "targets": [{ "expr": "trading_websocket_connections_active", "legendFormat": "WebSocket" }], "fieldConfig": { "defaults": { "unit": "short", "thresholds": { "mode": "absolute", "steps": [{ "color": "blue", "value": null }] } } }, "options": { "reduceOptions": { "calcs": ["lastNotNull"] }, "colorMode": "background", "textMode": "auto", "graphMode": "none" } },
        { "id": 6, "title": "Uptime Backend", "type": "stat", "gridPos": { "x": 20, "y": 1, "w": 4, "h": 4 }, "datasource": { "type": "prometheus", "uid": "${var.grafana_datasource_uid}" }, "targets": [{ "expr": "time() - nodejs_process_start_time_seconds{app=\"ict-trading-backend\"}", "legendFormat": "Uptime" }], "fieldConfig": { "defaults": { "unit": "s", "thresholds": { "mode": "absolute", "steps": [{ "color": "green", "value": null }] } } }, "options": { "reduceOptions": { "calcs": ["lastNotNull"] }, "colorMode": "value", "textMode": "auto", "graphMode": "none" } },
        { "type": "row", "title": "Trading \u2014 Metriques Metier", "id": 200, "gridPos": { "x": 0, "y": 5, "w": 24, "h": 1 }, "collapsed": false },
        { "id": 7, "title": "Webhooks recus / minute", "type": "timeseries", "gridPos": { "x": 0, "y": 6, "w": 12, "h": 6 }, "datasource": { "type": "prometheus", "uid": "${var.grafana_datasource_uid}" }, "targets": [{ "expr": "rate(trading_webhooks_total[5m]) * 60", "legendFormat": "{{strategy}} {{action}}" }], "fieldConfig": { "defaults": { "unit": "short", "custom": { "lineWidth": 2, "fillOpacity": 10, "gradientMode": "opacity" }, "color": { "mode": "palette-classic" } } }, "options": { "tooltip": { "mode": "multi" }, "legend": { "displayMode": "table", "placement": "bottom" } } },
        { "id": 8, "title": "Ordres \u2014 Executes vs Bloques", "type": "timeseries", "gridPos": { "x": 12, "y": 6, "w": 12, "h": 6 }, "datasource": { "type": "prometheus", "uid": "${var.grafana_datasource_uid}" }, "targets": [{ "expr": "increase(trading_orders_placed_total[1h])", "legendFormat": "Executes - {{strategy}}", "refId": "A" }, { "expr": "increase(trading_orders_blocked_total[1h])", "legendFormat": "Bloques - {{reason}}", "refId": "B" }], "fieldConfig": { "defaults": { "unit": "short", "custom": { "lineWidth": 2, "fillOpacity": 15 }, "color": { "mode": "palette-classic" } }, "overrides": [{ "matcher": { "id": "byRegexp", "options": "Bloques.*" }, "properties": [{ "id": "color", "value": { "mode": "fixed", "fixedColor": "red" } }] }, { "matcher": { "id": "byRegexp", "options": "Executes.*" }, "properties": [{ "id": "color", "value": { "mode": "fixed", "fixedColor": "green" } }] }] }, "options": { "tooltip": { "mode": "multi" }, "legend": { "displayMode": "table", "placement": "bottom" } } },
        { "id": 9, "title": "Latence Webhook p95 / p50 (ms)", "type": "timeseries", "gridPos": { "x": 0, "y": 12, "w": 12, "h": 5 }, "datasource": { "type": "prometheus", "uid": "${var.grafana_datasource_uid}" }, "targets": [{ "expr": "histogram_quantile(0.95, rate(trading_webhook_duration_seconds_bucket[5m])) * 1000", "legendFormat": "p95", "refId": "A" }, { "expr": "histogram_quantile(0.50, rate(trading_webhook_duration_seconds_bucket[5m])) * 1000", "legendFormat": "p50 mediane", "refId": "B" }], "fieldConfig": { "defaults": { "unit": "ms", "custom": { "lineWidth": 2, "fillOpacity": 10 } }, "overrides": [{ "matcher": { "id": "byName", "options": "p95" }, "properties": [{ "id": "color", "value": { "mode": "fixed", "fixedColor": "orange" } }] }, { "matcher": { "id": "byName", "options": "p50 mediane" }, "properties": [{ "id": "color", "value": { "mode": "fixed", "fixedColor": "green" } }] }] }, "options": { "tooltip": { "mode": "multi" } } },
        { "id": 10, "title": "Erreurs cTrader (cumul)", "type": "stat", "gridPos": { "x": 12, "y": 12, "w": 6, "h": 5 }, "datasource": { "type": "prometheus", "uid": "${var.grafana_datasource_uid}" }, "targets": [{ "expr": "sum(trading_ctrader_errors_total) or vector(0)", "legendFormat": "Erreurs" }], "fieldConfig": { "defaults": { "unit": "short", "thresholds": { "mode": "absolute", "steps": [{ "color": "green", "value": null }, { "color": "orange", "value": 1 }, { "color": "red", "value": 5 }] } } }, "options": { "reduceOptions": { "calcs": ["lastNotNull"] }, "colorMode": "background", "textMode": "auto", "graphMode": "area" } },
        { "id": 11, "title": "Total Webhooks (24h)", "type": "stat", "gridPos": { "x": 18, "y": 12, "w": 6, "h": 5 }, "datasource": { "type": "prometheus", "uid": "${var.grafana_datasource_uid}" }, "targets": [{ "expr": "increase(trading_webhooks_total[24h])", "legendFormat": "24h" }], "fieldConfig": { "defaults": { "unit": "short", "thresholds": { "mode": "absolute", "steps": [{ "color": "blue", "value": null }] } } }, "options": { "reduceOptions": { "calcs": ["lastNotNull"] }, "colorMode": "background", "textMode": "auto", "graphMode": "area" } },
        { "type": "row", "title": "Containers Docker Swarm", "id": 300, "gridPos": { "x": 0, "y": 17, "w": 24, "h": 1 }, "collapsed": false },
        { "id": 12, "title": "RAM Backend \u2014 Replicas (Mo)", "type": "timeseries", "gridPos": { "x": 0, "y": 18, "w": 12, "h": 6 }, "datasource": { "type": "prometheus", "uid": "${var.grafana_datasource_uid}" }, "targets": [{ "expr": "container_memory_usage_bytes{name=~\"ict-prod_backend.*\"} / 1024 / 1024", "legendFormat": "{{name}}" }], "fieldConfig": { "defaults": { "unit": "decmbytes", "custom": { "lineWidth": 2, "fillOpacity": 15 }, "thresholds": { "mode": "absolute", "steps": [{ "color": "green", "value": null }, { "color": "orange", "value": 200 }, { "color": "red", "value": 270 }] }, "color": { "mode": "palette-classic" } } }, "options": { "tooltip": { "mode": "multi" }, "legend": { "displayMode": "table", "placement": "bottom" }, "thresholdsStyle": { "mode": "line" } } },
        { "id": 13, "title": "CPU Backend \u2014 Replicas (%)", "type": "timeseries", "gridPos": { "x": 12, "y": 18, "w": 12, "h": 6 }, "datasource": { "type": "prometheus", "uid": "${var.grafana_datasource_uid}" }, "targets": [{ "expr": "rate(container_cpu_usage_seconds_total{name=~\"ict-prod_backend.*\"}[5m]) * 100", "legendFormat": "{{name}}" }], "fieldConfig": { "defaults": { "unit": "percent", "custom": { "lineWidth": 2, "fillOpacity": 10 }, "min": 0, "color": { "mode": "palette-classic" } } }, "options": { "tooltip": { "mode": "multi" }, "legend": { "displayMode": "table", "placement": "bottom" } } },
        { "id": 14, "title": "RAM Frontend \u2014 Replicas (Mo)", "type": "timeseries", "gridPos": { "x": 0, "y": 24, "w": 12, "h": 5 }, "datasource": { "type": "prometheus", "uid": "${var.grafana_datasource_uid}" }, "targets": [{ "expr": "container_memory_usage_bytes{name=~\"ict-prod_frontend.*\"} / 1024 / 1024", "legendFormat": "{{name}}" }], "fieldConfig": { "defaults": { "unit": "decmbytes", "custom": { "lineWidth": 2, "fillOpacity": 10 }, "color": { "mode": "palette-classic" } } }, "options": { "tooltip": { "mode": "multi" }, "legend": { "displayMode": "table", "placement": "bottom" } } },
        { "id": 15, "title": "Restarts Containers (1h)", "type": "timeseries", "gridPos": { "x": 12, "y": 24, "w": 12, "h": 5 }, "datasource": { "type": "prometheus", "uid": "${var.grafana_datasource_uid}" }, "targets": [{ "expr": "increase(container_start_time_seconds{name=~\"ict-prod.*\"}[1h])", "legendFormat": "{{name}}" }], "fieldConfig": { "defaults": { "unit": "short", "custom": { "lineWidth": 2, "fillOpacity": 20 }, "color": { "mode": "palette-classic" } } }, "options": { "tooltip": { "mode": "multi" }, "legend": { "displayMode": "table", "placement": "bottom" } } },
        { "type": "row", "title": "Node.js Runtime", "id": 400, "gridPos": { "x": 0, "y": 29, "w": 24, "h": 1 }, "collapsed": false },
        { "id": 16, "title": "Heap Node.js (Mo)", "type": "timeseries", "gridPos": { "x": 0, "y": 30, "w": 12, "h": 5 }, "datasource": { "type": "prometheus", "uid": "${var.grafana_datasource_uid}" }, "targets": [{ "expr": "nodejs_heap_size_used_bytes{app=\"ict-trading-backend\"} / 1024 / 1024", "legendFormat": "Heap utilise" }, { "expr": "nodejs_heap_size_total_bytes{app=\"ict-trading-backend\"} / 1024 / 1024", "legendFormat": "Heap total" }], "fieldConfig": { "defaults": { "unit": "decmbytes", "custom": { "lineWidth": 2, "fillOpacity": 10 }, "color": { "mode": "palette-classic" } } }, "options": { "tooltip": { "mode": "multi" } } },
        { "id": 17, "title": "Event Loop Lag (ms)", "type": "timeseries", "gridPos": { "x": 12, "y": 30, "w": 12, "h": 5 }, "datasource": { "type": "prometheus", "uid": "${var.grafana_datasource_uid}" }, "targets": [{ "expr": "nodejs_eventloop_lag_seconds{app=\"ict-trading-backend\"} * 1000", "legendFormat": "Event Loop Lag" }], "fieldConfig": { "defaults": { "unit": "ms", "custom": { "lineWidth": 2, "fillOpacity": 10 }, "thresholds": { "mode": "absolute", "steps": [{ "color": "green", "value": null }, { "color": "orange", "value": 100 }, { "color": "red", "value": 500 }] }, "color": { "mode": "fixed", "fixedColor": "purple" } } }, "options": { "tooltip": { "mode": "multi" } } }
      ]
    }
  EOT
}

# ════════════════════════════════════════════════════════════════
# RÉSUMÉ TERRAFORM
# ════════════════════════════════════════════════════════════════


# ════════════════════════════════════════════════════════════════
# ALERTING — Contact Point Telegram
# Note : chatid injecté via var.telegram_chatid (string Terraform)
#        pour éviter que Grafana le lise comme integer JSON
# ════════════════════════════════════════════════════════════════

resource "local_file" "grafana_alerting_contactpoint" {
  filename        = "${path.module}/../../monitoring/grafana/provisioning/alerting/contactpoints.yml"
  file_permission = "0644"
  content         = <<-EOT
    apiVersion: 1

    contactPoints:
      - orgId: 1
        name: Telegram Trading
        receivers:
          - uid: telegram-trading-uid
            type: telegram
            settings:
              bottoken: "${var.telegram_token}"
              chatid: "${var.telegram_chatid}"
              parse_mode: Markdown
            disableResolveMessage: false
  EOT
}

# ════════════════════════════════════════════════════════════════
# ALERTING — Notification Policy
# ════════════════════════════════════════════════════════════════

resource "local_file" "grafana_alerting_policy" {
  filename        = "${path.module}/../../monitoring/grafana/provisioning/alerting/policies.yml"
  file_permission = "0644"
  content         = <<-EOT
    apiVersion: 1

    policies:
      - orgId: 1
        receiver: Telegram Trading
        group_by: ['alertname', 'severity']
        group_wait: 30s
        group_interval: 5m
        repeat_interval: 1h
        routes:
          - receiver: Telegram Trading
            matchers:
              - severity =~ "critical|warning"
            continue: false
  EOT
}

# ════════════════════════════════════════════════════════════════
# ALERTING — 3 règles : cTrader · RAM Backend · Container Restart
# ════════════════════════════════════════════════════════════════

resource "local_file" "grafana_alerting_rules" {
  filename        = "${path.module}/../../monitoring/grafana/provisioning/alerting/rules.yml"
  file_permission = "0644"
  content         = <<-EOT
    apiVersion: 1

    groups:

      - orgId: 1
        name: critical
        folder: ICT Trading
        interval: 1m
        rules:
          - uid: ctrader-disconnected-uid
            title: "cTrader Déconnecté"
            condition: C
            for: 5m
            labels:
              severity: critical
            annotations:
              summary: "cTrader déconnecté depuis 5 minutes"
              description: "Les ordres AUTO sont en mode SIMULATION. Vérifier token FTMO."
            data:
              - refId: A
                datasourceUid: ${var.grafana_datasource_uid}
                model:
                  expr: trading_ctrader_connected
                  intervalMs: 1000
                  maxDataPoints: 43200
                  refId: A
              - refId: C
                datasourceUid: "__expr__"
                model:
                  conditions:
                    - evaluator:
                        params: [1]
                        type: lt
                      operator:
                        type: and
                      query:
                        params: [A]
                      reducer:
                        type: last
                      type: query
                  datasource:
                    type: __expr__
                    uid: __expr__
                  expression: A
                  refId: C
                  type: classic_conditions

      - orgId: 1
        name: infrastructure
        folder: ICT Trading
        interval: 1m
        rules:

          - uid: ram-backend-critical-uid
            title: "RAM Backend Critique"
            condition: C
            for: 2m
            labels:
              severity: warning
            annotations:
              summary: "RAM backend critique (270Mo/300Mo)"
              description: "Container proche de la limite Docker. OOM Kill imminent."
            data:
              - refId: A
                datasourceUid: ${var.grafana_datasource_uid}
                model:
                  expr: "container_memory_usage_bytes{name=~\"ict-prod_backend.*\"} / 1024 / 1024"
                  intervalMs: 1000
                  maxDataPoints: 43200
                  refId: A
              - refId: C
                datasourceUid: "__expr__"
                model:
                  conditions:
                    - evaluator:
                        params: [270]
                        type: gt
                      operator:
                        type: and
                      query:
                        params: [A]
                      reducer:
                        type: last
                      type: query
                  datasource:
                    type: __expr__
                    uid: __expr__
                  expression: A
                  refId: C
                  type: classic_conditions

          - uid: container-restart-uid
            title: "Container Restart Inattendu"
            condition: C
            for: 1m
            labels:
              severity: warning
            annotations:
              summary: "Container ict-prod a redémarré"
              description: "Vérifier : docker service logs ict-prod_backend --tail 50"
            data:
              - refId: A
                datasourceUid: ${var.grafana_datasource_uid}
                model:
                  expr: "increase(container_start_time_seconds{name=~\"ict-prod.*\"}[10m])"
                  intervalMs: 1000
                  maxDataPoints: 43200
                  refId: A
              - refId: C
                datasourceUid: "__expr__"
                model:
                  conditions:
                    - evaluator:
                        params: [0]
                        type: gt
                      operator:
                        type: and
                      query:
                        params: [A]
                      reducer:
                        type: last
                      type: query
                  datasource:
                    type: __expr__
                    uid: __expr__
                  expression: A
                  refId: C
                  type: classic_conditions
  EOT
}

# ════════════════════════════════════════════════════════════════
# RÉSUMÉ TERRAFORM
# ════════════════════════════════════════════════════════════════

resource "null_resource" "summary" {
  triggers = {
    stack_hash      = local_file.docker_stack_prod.content
    staging_hash    = local_file.docker_compose_staging.content
    gateway_hash    = local_file.dockerfx_gateway_conf.content
    nginx_hash      = local_file.nginx_frontend_prod.content
    inventory_hash  = local_file.ansible_inventory.content
    monitoring_hash = local_file.docker_compose_monitoring.content
    alerting_hash   = local_file.grafana_alerting_rules.content
  }

  provisioner "local-exec" {
    command = <<-EOT
      echo ""
      echo "╔══════════════════════════════════════════════════╗"
      echo "║  ✅  Terraform apply terminé                     ║"
      echo "╠══════════════════════════════════════════════════╣"
      echo "║  Fichiers générés :                              ║"
      echo "║    docker-stack.prod.yml                         ║"
      echo "║    docker-compose.staging.yml                    ║"
      echo "║    docker-compose.monitoring.yml                 ║"
      echo "║    dockerfx-gateway.conf                         ║"
      echo "║    frontend/nginx.conf                           ║"
      echo "║    frontend/nginx.staging.conf                   ║"
      echo "║    infra/ansible/inventory.yml                   ║"
      echo "║    monitoring/prometheus.yml                     ║"
      echo "║    monitoring/grafana/provisioning/...           ║"
      echo "║      datasources/datasource.yml                  ║"
      echo "║      dashboards/dashboards.yml                   ║"
      echo "║      alerting/contactpoints.yml  (Telegram)      ║"
      echo "║      alerting/policies.yml                       ║"
      echo "║      alerting/rules.yml (3 alertes)              ║"
      echo "║    monitoring/grafana/dashboards/ict-trading.json║"
      echo "╠══════════════════════════════════════════════════╣"
      echo "║  Accès :                                         ║"
      echo "║    PROD    : https://${var.domain_name}          ║"
      echo "║    STAGING : https://${var.staging_domain}       ║"
      echo "║    GRAFANA : http://${var.vps_ip}:${var.grafana_port}  ║"
      echo "╠══════════════════════════════════════════════════╣"
      echo "║  Alertes Telegram :                              ║"
      echo "║    🔴 cTrader Déconnecté  (5 min)                ║"
      echo "║    🟡 RAM Backend > 270Mo (2 min)                ║"
      echo "║    🟢 Container Restart   (1 min)                ║"
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
    local_file.docker_compose_monitoring,
    local_file.prometheus_config,
    local_file.grafana_datasource,
    local_file.grafana_dashboards_provisioning,
    local_file.grafana_dashboard_json,
    local_file.grafana_alerting_contactpoint,
    local_file.grafana_alerting_policy,
    local_file.grafana_alerting_rules,
  ]
}
