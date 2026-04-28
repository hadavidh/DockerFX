# 🤖 ICT Trading Dashboard — DockerFX

> **Projet de Fin de Formation DevOps Engineer 2025-2026 · TFF 07/05/2026**
>
> Application de trading automatisé déployée en production sur infrastructure
> conteneurisée, avec pipeline CI/CD complet, IaC, monitoring et alerting.

[![Production](https://img.shields.io/badge/Production-https%3A%2F%2Fdockerfx.trade-success)](https://dockerfx.trade)
[![Staging](https://img.shields.io/badge/Staging-https%3A%2F%2Fstaging.dockerfx.trade-blue)](https://staging.dockerfx.trade)
[![CI/CD](https://img.shields.io/badge/CI%2FCD-GitHub%20Actions-2088FF)](https://github.com/hadavidh/DockerFX/actions)
[![Monitoring](https://img.shields.io/badge/Monitoring-Grafana-F46800)](http://135.125.196.204:3000)

---

## 📋 Table des matières

1. [Description du projet](#-description-du-projet)
2. [Architecture](#-architecture)
3. [Stack technique](#-stack-technique)
4. [Prérequis](#-prérequis)
5. [Structure du dépôt](#-structure-du-dépôt)
6. [Installation](#-installation)
7. [Déploiement](#-déploiement)
8. [Pipeline CI/CD](#-pipeline-cicd)
9. [Monitoring & Observabilité](#-monitoring--observabilité)
10. [Sécurité](#-sécurité)
11. [Variables d'environnement](#-variables-denvironnement)
12. [Commandes utiles](#-commandes-utiles)
13. [Troubleshooting](#-troubleshooting)

---

## 🎯 Description du projet

**ICT Trading Dashboard** est une application web complète qui automatise
l'exécution de stratégies de trading forex sur la plateforme cTrader (FTMO).

### Fonctionnalités métier

- **Réception de signaux** depuis TradingView via webhook HTTPS
- **Validation et filtrage** selon des règles de risk management
- **Exécution automatique** des ordres sur cTrader via protobuf TCP
- **Notifications temps réel** via bot Telegram bidirectionnel
- **Dashboard web** avec WebSocket pour suivi live des positions
- **Strategies Pine Script** (NEXUS_Pro_v1, ICT_AutoBot_v1, EMA_RSI_v21, ICT_Structure_v41)
- **Risk management** automatique (max daily DD, hard stop DD, exposition corrélée)

### Caractéristiques DevOps

- ✅ **Conteneurisation** complète (multi-stage Docker, non-root, alpine)
- ✅ **Orchestration** Docker Swarm avec 2 replicas backend + 2 replicas frontend
- ✅ **CI/CD** entièrement automatisé (5 workflows GitHub Actions)
- ✅ **IaC** avec Terraform (génération configs) + Ansible (provisioning VPS)
- ✅ **HTTPS** Cloudflare Origin CA + Nginx gateway
- ✅ **Monitoring** Prometheus + Grafana avec 17 panels et 10 métriques
- ✅ **Logs centralisés** Loki + Promtail
- ✅ **Alerting** 3 règles Grafana → notification Telegram
- ✅ **Rolling update** zéro downtime avec rollback automatique
- ✅ **Sécurité** JWT + UFW + secrets isolés + scan Trivy

---

## 🏗️ Architecture

### Vue d'ensemble

```
┌──────────────────────────────────────────────────────────────────┐
│  Internet                                                        │
│       │                                                          │
│       ▼                                                          │
│  ┌─────────────────┐                                             │
│  │  Cloudflare DNS │ ← dockerfx.trade · staging.dockerfx.trade   │
│  └────────┬────────┘                                             │
│           │ HTTPS (Origin CA)                                    │
└───────────┼──────────────────────────────────────────────────────┘
            ▼
┌──────────────────────────────────────────────────────────────────┐
│  VPS OVH Ubuntu 24 (135.125.196.204)                             │
│  4 vCores · 8 Go RAM · 75 Go disque                              │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  Nginx Gateway (host)  ←  ports 80 / 443                   │  │
│  │     ├──→ 127.0.0.1:8443  (prod Swarm)                      │  │
│  │     └──→ 127.0.0.1:8080  (staging Compose)                 │  │
│  └─────────────────┬──────────────────────────────────────────┘  │
│                    │                                             │
│  ┌─────────────────▼──────────────────────────────────────────┐  │
│  │  PRODUCTION  Docker Swarm  (ict-prod stack)                │  │
│  │     backend.1 + backend.2     (Node.js 20 + Express + WS)  │  │
│  │     frontend.1 + frontend.2   (React 18 + Vite + Nginx)    │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  STAGING  Docker Compose                                   │  │
│  │     forex-backend-staging + forex-frontend-staging         │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  MONITORING  Docker Compose                                │  │
│  │     Prometheus · Grafana · cAdvisor · Node Exporter        │  │
│  │     Loki · Promtail (logs centralisés)                     │  │
│  └─────────────────┬──────────────────────────────────────────┘  │
│                    │                                             │
│                    ▼                                             │
│              http://VPS:3000  (Grafana)                          │
└──────────────────────────────────────────────────────────────────┘
                    │
                    ▼ alertes
            ┌──────────────────┐
            │  Bot Telegram    │
            └──────────────────┘
```

### Communications externes

```
TradingView  ─────webhook───→  Backend  ─────protobuf TCP───→  cTrader (FTMO)
                                  │
                                  └─────HTTP API───→  Telegram Bot
```

---

## 🛠️ Stack technique

### Application

| Composant | Technologie |
|---|---|
| Backend | Node.js 20-alpine + Express + WebSocket |
| Frontend | React 18 + Vite + Nginx |
| Communication broker | protobuf TCP (cTrader Open API) |
| Notifications | Telegram Bot API |

### Infrastructure

| Composant | Technologie |
|---|---|
| Hébergement | OVH VPS (Ubuntu 24) |
| Conteneurs | Docker + Docker Swarm |
| Reverse proxy | Nginx (host gateway) |
| HTTPS | Cloudflare Origin CA |
| Registre images | DockerHub (`dave67000/ict-trading-*`) |

### DevOps

| Couche | Outil |
|---|---|
| SCM | Git + GitHub (branches main/develop) |
| CI/CD | GitHub Actions (5 workflows) |
| IaC | Terraform + Ansible |
| Monitoring | Prometheus + Grafana |
| Logs | Loki + Promtail |
| Alerting | Grafana → Telegram |
| Tests | Robot Framework + Playwright |
| Sécurité | Trivy (scan images) + UFW + JWT |

---

## 📦 Prérequis

### Pour développer en local

- Node.js 20+ et npm
- Docker 24+ et Docker Compose v2
- Git

### Pour déployer la prod

- VPS Ubuntu 24+ (4 vCores / 8 Go RAM minimum)
- Domaine + DNS Cloudflare configuré
- Certificat Cloudflare Origin CA généré
- Compte FTMO avec API cTrader activée
- Bot Telegram créé via [@BotFather](https://t.me/BotFather)
- Compte DockerHub
- Accès SSH au VPS

### Outils requis

```bash
terraform --version       # >= 1.5.0
ansible-playbook --version # >= 2.14
docker --version          # >= 24.0
git --version
```

---

## 📂 Structure du dépôt

```
DockerFX/
├── .github/
│   └── workflows/
│       ├── ci-tests.yml            ← Lint + Tests + Trivy scan
│       ├── staging-build.yml       ← Build images develop
│       ├── staging-deploy.yml      ← Deploy auto staging
│       ├── production-build.yml    ← Build images sur tag v*.*.*
│       └── production-deploy.yml   ← Rolling update zéro downtime
│
├── backend/
│   ├── src/                        ← Code Express + WebSocket
│   ├── metrics.js                  ← Exposition /metrics (prom-client)
│   ├── server.js                   ← Entry point
│   ├── Dockerfile                  ← Multi-stage + non-root
│   └── package.json
│
├── frontend/
│   ├── src/                        ← Composants React
│   ├── nginx.conf                  ← Conf Nginx prod (généré Terraform)
│   ├── nginx.staging.conf          ← Conf staging (généré Terraform)
│   ├── Dockerfile                  ← Multi-stage Vite + Nginx
│   └── package.json
│
├── infra/
│   ├── terraform/
│   │   ├── main.tf                 ← Génère tous les fichiers de config
│   │   ├── variables.tf            ← Variables paramétrables
│   │   └── terraform.tfvars        ← Secrets (NON commité)
│   └── ansible/
│       ├── playbook.yml            ← Provisioning VPS complet
│       └── inventory.yml           ← Généré par Terraform
│
├── monitoring/
│   ├── prometheus.yml              ← Scrape config (généré Terraform)
│   ├── promtail/
│   │   └── config.yml              ← Collecte logs Docker
│   └── grafana/
│       ├── provisioning/
│       │   ├── datasources/        ← Prometheus + Loki
│       │   ├── dashboards/         ← Auto-provisioning
│       │   └── alerting/           ← 3 règles Telegram
│       └── dashboards/
│           └── ict-trading.json    ← Dashboard 17 panels
│
├── scripts/
│   └── deploy-full.sh              ← Script déploiement complet
│
├── tests/
│   └── robot/                      ← Tests E2E Robot Framework
│
├── strategies/                     ← Pine Script (backup TradingView)
│
├── docker-stack.prod.yml           ← Swarm prod (généré Terraform)
├── docker-compose.staging.yml      ← Compose staging (généré Terraform)
├── docker-compose.monitoring.yml   ← Stack monitoring (généré Terraform)
├── dockerfx-gateway.conf           ← Nginx host (généré Terraform)
├── .env.prod.example
├── .env.staging.example
├── .gitignore
├── README.md
├── RUNBOOK.md                      ← Procédures opérationnelles
├── ALERTES_GRAFANA.md              ← Justification des 3 alertes
├── LOKI.md                         ← Documentation logs centralisés
├── ROLLING_UPDATE.md               ← Stratégie zéro downtime
└── MONITORING.md                   ← Architecture monitoring
```

---

## 🚀 Installation

### 1. Cloner le dépôt

```bash
git clone https://github.com/hadavidh/DockerFX.git
cd DockerFX
```

### 2. Configuration des secrets

```bash
cp .env.staging.example .env.staging
cp .env.staging.example .env.prod
# Éditer .env.prod avec les vraies valeurs
```

### 3. Certificats HTTPS Cloudflare

Générer un certificat Origin CA depuis Cloudflare :
- **SSL/TLS** → **Origin Server** → **Create Certificate**
- Hostnames : `*.dockerfx.trade, dockerfx.trade`
- Validity : 15 ans

Copier sur le VPS :
```bash
mkdir -p ~/dockerFX/ssl
# Coller le certificat dans :
~/dockerFX/ssl/cloudflare-origin.crt
~/dockerFX/ssl/cloudflare-origin.key
chmod 600 ~/dockerFX/ssl/cloudflare-origin.key
```

### 4. Variables Terraform

Créer `infra/terraform/terraform.tfvars` (jamais commité) :

```hcl
telegram_token  = "TON_TELEGRAM_BOT_TOKEN"
telegram_chatid = "TON_TELEGRAM_CHAT_ID"
```

---

## 🚢 Déploiement

### Déploiement complet (premier déploiement)

```bash
bash ~/dockerFX/scripts/deploy-full.sh
```

Le script orchestre **5 étapes** :

1. Vérification prérequis (Terraform, Ansible, Docker, certificats)
2. **Terraform apply** — génère tous les fichiers de config
3. **Build & Push Docker** — images backend + frontend sur DockerHub
4. **Ansible playbook** — provisionne le VPS (firewall, Swarm, gateway, etc.)
5. **Stack monitoring** — Prometheus + Grafana + Loki + alertes

### Options du script

```bash
bash deploy-full.sh                    # Déploiement complet
bash deploy-full.sh --skip-build       # Sans rebuild Docker
bash deploy-full.sh --swarm-only       # Redéploie seulement Swarm prod
bash deploy-full.sh --staging-only     # Redéploie seulement staging
bash deploy-full.sh --monitoring-only  # Redéploie seulement monitoring
bash deploy-full.sh --destroy          # Détruit tout (idempotent)
```

### Déploiement d'une nouvelle version (rolling update zéro downtime)

```bash
# 1. Sur ta machine locale, créer un tag sémantique
git tag v1.6.0
git push origin v1.6.0

# 2. GitHub Actions enchaîne automatiquement :
#    - Build Production (build + push DockerHub)
#    - Deploy Production (rolling update via SSH)
```

### Stratégie de déploiement — Rolling Update

```yaml
update_config:
  parallelism: 1          ← un replica MAJ à la fois
  delay: 10s              ← pause entre replicas
  order: start-first      ← démarre nouveau AVANT de tuer ancien
  failure_action: rollback ← rollback auto si healthcheck KO
```

→ **Zéro downtime garanti** pendant les déploiements.

Détails : [ROLLING_UPDATE.md](./ROLLING_UPDATE.md)

---

## 🔄 Pipeline CI/CD

### Vue d'ensemble

```
git push develop
    │
    ▼
CI Tests (lint + Robot + Trivy)  ─green──→  Staging Build  ──→  Staging Deploy

git tag v1.6.0 + push --tags
    │
    ▼
Production Build  ──success──→  Production Deploy (rolling update)
```

### Détails des 5 workflows

| Workflow | Déclenchement | Action |
|---|---|---|
| `ci-tests.yml` | PR sur develop/main | Lint ESLint + Tests Robot + Scan Trivy |
| `staging-build.yml` | Push develop | Build + Push images `:develop` |
| `staging-deploy.yml` | Push develop ou manuel | Deploy `staging.dockerfx.trade` |
| `production-build.yml` | Tag `v*.*.*` ou manuel | Build + Push images `:v*.*.*` + `:latest` |
| `production-deploy.yml` | Suite à Build prod ou manuel | Rolling update zéro downtime |

### Secrets GitHub requis

```
DOCKERHUB_USERNAME       ← username DockerHub
DOCKERHUB_TOKEN          ← token DockerHub
VPS_HOST                 ← IP ou hostname VPS
VPS_USER                 ← user SSH (ex: ubuntu)
VPS_SSH_KEY              ← clé privée SSH
TELEGRAM_TOKEN           ← bot Telegram
TELEGRAM_CHATID          ← chat ID destinataire
TEST_DASHBOARD_LOGIN     ← login pour tests E2E
TEST_DASHBOARD_PASSWORD  ← password pour tests E2E
```

---

## 📊 Monitoring & Observabilité

### Les 3 piliers couverts

| Pilier | Outil | Accès |
|---|---|---|
| **Métriques** | Prometheus + Grafana | http://135.125.196.204:3000 |
| **Logs** | Loki + Promtail | Grafana → Explore → Loki |
| **Alerting** | Grafana → Telegram | Bot Telegram en temps réel |

### Dashboard Grafana

**URL** : http://135.125.196.204:3000/d/ict-trading-monitoring
**Login** : `admin` / `ict-trading-2026`

**17 panels** organisés en 4 sections :

- 🖥️ **Système VPS** : CPU · RAM · Disque · cTrader Connecté · WebSocket · Uptime
- 📡 **Trading métier** : Webhooks/min · Ordres exécutés vs bloqués · Latence p95/p50 · Erreurs cTrader
- 🐳 **Containers Swarm** : RAM/CPU par replica · Restarts
- 📈 **Node.js Runtime** : Heap V8 · Event Loop Lag

### 3 alertes Telegram

| # | Alerte | Seuil | Délai |
|---|---|---|---|
| 🔴 | cTrader Déconnecté | `< 1` | 5 min |
| 🟡 | RAM Backend Critique | `> 270 Mo` | 2 min |
| 🟢 | Container Restart | `> 0` en 10 min | 1 min |

Justification détaillée : [ALERTES_GRAFANA.md](./ALERTES_GRAFANA.md)

### Logs centralisés

Recherche dans Grafana → **Explore** → datasource **Loki** :

```logql
# Logs backend
{container=~"ict-prod_backend.*"}

# Erreurs uniquement
{container=~"ict-prod.*"} |= "error"

# Webhooks TradingView
{container=~"ict-prod_backend.*"} |= "webhook"
```

Documentation complète : [LOKI.md](./LOKI.md)

---

## 🔒 Sécurité

### DevSecOps en place

| Couche | Mesure |
|---|---|
| **Code** | Lint ESLint dans CI |
| **Dépendances** | Scan Trivy CRITICAL/HIGH (bonus) |
| **Build** | Multi-stage Dockerfile |
| **Runtime** | Non-root user (`appuser`) |
| **Image** | Base alpine minimale (`node:20-alpine`) |
| **Secrets** | `.env` jamais commité (`.gitignore`) |
| **Secrets CI** | GitHub Secrets chiffrés |
| **Réseau** | Firewall UFW (22, 80, 443, 3000) |
| **Backend** | Port 3001 jamais exposé publiquement |
| **HTTPS** | Cloudflare Origin CA + HTTP/2 |
| **API** | JWT sur toutes les routes |
| **Endpoints publics** | `/health` + `/metrics` uniquement |

### Architecture réseau

```
Internet (Cloudflare)
    │ HTTPS
    ▼
VPS:443 (Nginx host)
    │ proxy_pass
    ▼
127.0.0.1:8443 (frontend Swarm)
    │ overlay network
    ▼
backend:3001 (jamais exposé publiquement)
```

---

## 📝 Variables d'environnement

### `.env.prod` (production)

```bash
# Backend
PORT=3001
NODE_ENV=production

# cTrader API (FTMO)
CTRADER_HOST=live.ctraderapi.com
CTRADER_CLIENT_ID=...
CTRADER_CLIENT_SECRET=...
CTRADER_ACCESS_TOKEN=...
CTRADER_REFRESH_TOKEN=...
CTRADER_ACCOUNT_ID=...

# Risk Management
RISK_PERCENT=0.5
FALLBACK_BALANCE=100000
MAX_OPEN_TRADES=3
MAX_CORR_EXPOSURE=2

# Drawdown Protection
MAX_DAILY_DD=4
HARD_STOP_DD=5
MAX_TOTAL_DD=10

# Telegram
TELEGRAM_TOKEN=...
TELEGRAM_CHATID=...

# Auth Dashboard
JWT_SECRET=production-secret-min-32-chars
DASHBOARD_LOGIN=...
DASHBOARD_PASSWORD=...

# Storage
DATA_DIR=/app/data
```

### `.env.staging` (staging)

Mêmes variables avec `CTRADER_HOST=demo.ctraderapi.com`.

---

## 🛠️ Commandes utiles

### Production (Docker Swarm)

```bash
# État des services
docker service ls
docker service ps ict-prod_backend --no-trunc
docker service ps ict-prod_frontend --no-trunc

# Logs
docker service logs ict-prod_backend --tail 100 -f
docker service logs ict-prod_frontend --tail 100 -f

# Scaling manuel
docker service scale ict-prod_backend=3

# Rolling update manuel
docker service update --image dave67000/ict-trading-backend:v1.7.0 \
  --update-order start-first \
  --update-failure-action rollback \
  ict-prod_backend

# Rollback manuel
docker service rollback ict-prod_backend
```

### Staging (Docker Compose)

```bash
cd ~/dockerFX
docker compose -p staging -f docker-compose.staging.yml ps
docker compose -p staging -f docker-compose.staging.yml logs -f
docker compose -p staging -f docker-compose.staging.yml restart
```

### Monitoring

```bash
# État des containers monitoring
docker compose -p monitoring -f docker-compose.monitoring.yml ps

# Logs Grafana
docker logs grafana --tail 50

# Tester Loki
curl http://localhost:3100/ready

# Tester Prometheus
curl http://127.0.0.1:9090/api/v1/targets
```

### Vérifications application

```bash
# Endpoint /metrics du backend
curl https://dockerfx.trade/metrics

# Healthcheck
curl https://dockerfx.trade/health
```

---

## 🆘 Troubleshooting

### Le déploiement Swarm est bloqué en `0/2`

```bash
docker service ps ict-prod_backend --no-trunc
docker service logs ict-prod_backend --since 10m
```

Solutions courantes :
- Image inexistante sur DockerHub → vérifier `docker pull`
- Healthcheck échoue → vérifier `wget /health` dans le container
- RAM dépassée → vérifier `docker stats`

### Grafana redémarre en boucle

```bash
docker logs grafana 2>&1 | grep -i error
```

Si erreur `relativeTimeRange` → relancer `terraform apply` pour régénérer le fichier.

### Datasource Prometheus introuvable dans dashboards

Le volume Grafana garde l'ancien UID. Solution :
```bash
docker compose -p monitoring -f docker-compose.monitoring.yml stop grafana
docker volume rm monitoring_grafana_data
docker compose -p monitoring -f docker-compose.monitoring.yml up -d grafana
```

### Alerte Telegram 400 Bad Request

`parse_mode: Markdown` dans `contactpoints.yml` génère parfois des messages
invalides. Supprimer la ligne `parse_mode` ou utiliser `HTML`.

### cTrader déconnecté en permanence

Token expiré (durée 30 jours). Régénérer :
1. Aller sur https://connect.spotware.com
2. Refresh token
3. Mettre à jour `CTRADER_ACCESS_TOKEN` dans `.env.prod`
4. `docker service update --force ict-prod_backend`

---

## 📚 Documentation complémentaire

- [RUNBOOK.md](./RUNBOOK.md) — Procédures opérationnelles (déploiement, rollback, alertes)
- [ROLLING_UPDATE.md](./ROLLING_UPDATE.md) — Stratégie de déploiement zéro downtime
- [ALERTES_GRAFANA.md](./ALERTES_GRAFANA.md) — Justification métier des 3 alertes
- [LOKI.md](./LOKI.md) — Documentation logs centralisés
- [MONITORING.md](./MONITORING.md) — Architecture du monitoring

---

## 👤 Auteur

**David Haberbusch** ([@hadavidh](https://github.com/hadavidh))

Projet réalisé dans le cadre de la **formation DevOps Engineer 2025-2026**.

---

## 📄 Licence

Projet à usage pédagogique — TFF DevOps 07/05/2026.