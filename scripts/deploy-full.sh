#!/bin/bash
# ════════════════════════════════════════════════════════════════
#
#   ICT Trading Dashboard — Script de déploiement complet
#   Architecture gateway-ready + Monitoring Prometheus/Grafana
#
#   PROD    : https://dockerfx.trade
#   STAGING : https://staging.dockerfx.trade
#   GRAFANA : http://135.125.196.204:3000
#
#   Usage :
#     bash deploy-full.sh                    ← déploiement complet
#     bash deploy-full.sh --skip-build       ← sans rebuild images
#     bash deploy-full.sh --swarm-only       ← seulement Swarm prod
#     bash deploy-full.sh --staging-only     ← seulement Staging
#     bash deploy-full.sh --monitoring-only  ← seulement monitoring
#     bash deploy-full.sh --destroy          ← tout effacer
#
# ════════════════════════════════════════════════════════════════

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
NC='\033[0m'

PROJECT_DIR="$HOME/dockerFX"
TERRAFORM_DIR="$PROJECT_DIR/infra/terraform"
ANSIBLE_DIR="$PROJECT_DIR/infra/ansible"
DOCKERHUB_USER="dave67000"
SSL_DIR="$PROJECT_DIR/ssl"
PROD_DOMAIN="dockerfx.trade"
STAGING_DOMAIN="staging.dockerfx.trade"
GRAFANA_PORT="3000"
GRAFANA_USER="admin"
GRAFANA_PASSWORD="ict-trading-2026"
GRAFANA_URL="http://127.0.0.1:${GRAFANA_PORT}"
VPS_IP="135.125.196.204"

SKIP_BUILD=false
SWARM_ONLY=false
STAGING_ONLY=false
MONITORING_ONLY=false
DESTROY=false

for arg in "$@"; do
  case $arg in
    --skip-build)      SKIP_BUILD=true ;;
    --swarm-only)      SWARM_ONLY=true ;;
    --staging-only)    STAGING_ONLY=true ;;
    --monitoring-only) MONITORING_ONLY=true ;;
    --destroy)         DESTROY=true ;;
    --help|-h)
      echo ""
      echo "Usage : bash deploy-full.sh [OPTIONS]"
      echo ""
      echo "Options :"
      echo "  (aucune)           Déploiement complet"
      echo "  --skip-build       Saute le build/push Docker"
      echo "  --swarm-only       Redéploie seulement la stack Swarm prod"
      echo "  --staging-only     Redéploie seulement le staging"
      echo "  --monitoring-only  Redéploie seulement Prometheus + Grafana"
      echo "  --destroy          Supprime prod + staging + monitoring"
      echo "  --help             Affiche cette aide"
      echo ""
      exit 0
      ;;
    *)
      echo "Option inconnue : $arg — utiliser --help"
      exit 1
      ;;
  esac
done

print_header() {
  echo ""
  echo -e "${CYAN}════════════════════════════════════════════════════════${NC}"
  echo -e "${WHITE}  $1${NC}"
  echo -e "${CYAN}════════════════════════════════════════════════════════${NC}"
}

print_step()  { echo -e "${BLUE}  ▶  $1${NC}"; }
print_ok()    { echo -e "${GREEN}  ✅  $1${NC}"; }
print_warn()  { echo -e "${YELLOW}  ⚠️   $1${NC}"; }
print_error() { echo -e "${RED}  ❌  $1${NC}"; }

# ════════════════════════════════════════════════════════════════
# BANNER
# ════════════════════════════════════════════════════════════════
clear
echo -e "${CYAN}"
cat << 'EOF'
  ╔══════════════════════════════════════════════════════════╗
  ║   ICT Trading Dashboard — Déploiement complet           ║
  ║   Terraform → Docker → Ansible → Swarm + Monitoring    ║
  ╚══════════════════════════════════════════════════════════╝
EOF
echo -e "${NC}"
echo -e "  Heure de début : ${WHITE}$(date '+%d/%m/%Y %H:%M:%S')${NC}"
echo -e "  PROD           : ${WHITE}https://$PROD_DOMAIN${NC}"
echo -e "  STAGING        : ${WHITE}https://$STAGING_DOMAIN${NC}"
echo -e "  GRAFANA        : ${WHITE}http://$VPS_IP:$GRAFANA_PORT${NC}"
echo ""

# ════════════════════════════════════════════════════════════════
# DESTROY
# ════════════════════════════════════════════════════════════════
if [ "$DESTROY" = true ]; then
  print_header "🔥 MODE DESTROY — Suppression de tous les workloads"

  print_step "Suppression stack Swarm ict-prod..."
  docker stack rm ict-prod 2>/dev/null || true
  until [ -z "$(docker service ls --filter name=ict-prod -q 2>/dev/null)" ]; do sleep 2; done
  print_ok "Stack Swarm prod supprimée"

  print_step "Arrêt staging..."
  cd "$PROJECT_DIR"
  docker compose -p staging -f docker-compose.staging.yml down --remove-orphans 2>/dev/null || true
  print_ok "Staging arrêté"

  print_step "Arrêt monitoring..."
  docker compose -p monitoring -f docker-compose.monitoring.yml down --remove-orphans 2>/dev/null || true
  print_ok "Monitoring arrêté"

  print_step "Nettoyage Docker..."
  docker network prune -f >/dev/null 2>&1 || true
  docker container prune -f >/dev/null 2>&1 || true
  docker builder prune -f >/dev/null 2>&1 || true
  print_ok "Nettoyage terminé"
  exit 0
fi

# ════════════════════════════════════════════════════════════════
# MONITORING ONLY
# ════════════════════════════════════════════════════════════════
deploy_monitoring() {
  print_header "MONITORING — Prometheus + Grafana + cAdvisor + Node Exporter"

  print_step "Création des dossiers monitoring..."
  mkdir -p "$PROJECT_DIR/monitoring/grafana/provisioning/datasources"
  mkdir -p "$PROJECT_DIR/monitoring/grafana/provisioning/dashboards"
  mkdir -p "$PROJECT_DIR/monitoring/grafana/dashboards"
  print_ok "Dossiers créés"

  print_step "Copie des fichiers de config monitoring (générés par Terraform)..."
  # Les fichiers ont été générés par terraform apply à l'étape précédente
  [ -f "$PROJECT_DIR/monitoring/prometheus.yml" ]                                                       && print_ok "prometheus.yml" || print_warn "prometheus.yml manquant — relancer terraform apply"
  [ -f "$PROJECT_DIR/monitoring/grafana/provisioning/datasources/datasource.yml" ]                     && print_ok "datasource.yml" || print_warn "datasource.yml manquant"
  [ -f "$PROJECT_DIR/monitoring/grafana/provisioning/dashboards/dashboards.yml" ]                      && print_ok "dashboards.yml" || print_warn "dashboards.yml manquant"
  [ -f "$PROJECT_DIR/monitoring/grafana/dashboards/ict-trading.json" ]                                 && print_ok "ict-trading.json (dashboard)" || print_warn "ict-trading.json manquant"

  print_step "Vérification du réseau Swarm trading-net..."
  if docker network inspect ict-prod_trading-net >/dev/null 2>&1; then
    print_ok "Réseau ict-prod_trading-net présent"
  else
    print_warn "Réseau ict-prod_trading-net absent — la stack prod doit être déployée d'abord"
  fi

  print_step "Arrêt de l'ancienne stack monitoring (si présente)..."
  cd "$PROJECT_DIR"
  docker compose -p monitoring -f docker-compose.monitoring.yml down --remove-orphans 2>/dev/null || true

  print_step "Démarrage de la stack monitoring..."
  docker compose -p monitoring -f docker-compose.monitoring.yml pull --quiet
  docker compose -p monitoring -f docker-compose.monitoring.yml up -d

  print_step "Attente démarrage Grafana (30s)..."
  sleep 30

  print_step "Vérification des containers monitoring..."
  MONITOR_STATUS=$(docker compose -p monitoring -f docker-compose.monitoring.yml ps --format json 2>/dev/null || echo "")

  for svc in prometheus grafana node-exporter cadvisor; do
    if docker ps --format '{{.Names}}' | grep -q "^${svc}$"; then
      print_ok "$svc UP"
    else
      print_warn "$svc non démarré — vérifier : docker logs $svc"
    fi
  done

  print_step "Vérification Prometheus scrape targets..."
  if curl -sf --connect-timeout 5 "$GRAFANA_URL/../9090/api/v1/targets" >/dev/null 2>&1 ||
     curl -sf --connect-timeout 5 "http://127.0.0.1:9090/api/v1/targets" >/dev/null 2>&1; then
    print_ok "Prometheus API répond"
  else
    print_warn "Prometheus API non accessible depuis le host (normal — port 127.0.0.1:9090)"
  fi

  print_step "Vérification Grafana..."
  for i in $(seq 1 6); do
    if curl -sf --connect-timeout 5 "${GRAFANA_URL}/api/health" >/dev/null 2>&1; then
      print_ok "Grafana API répond"
      break
    fi
    [ $i -lt 6 ] && sleep 5 || print_warn "Grafana ne répond pas — vérifier : docker logs grafana"
  done

  print_step "Vérification du dashboard provisionné..."
  DASH_COUNT=$(curl -sf -u "${GRAFANA_USER}:${GRAFANA_PASSWORD}" \
    "${GRAFANA_URL}/api/search?query=ICT+Trading" 2>/dev/null | \
    python3 -c "import sys,json; data=json.load(sys.stdin); print(len(data))" 2>/dev/null || echo "0")

  if [ "$DASH_COUNT" -gt "0" ] 2>/dev/null; then
    print_ok "Dashboard 'ICT Trading' provisionné automatiquement ✅"
    DASH_URL="${GRAFANA_URL}/d/ict-trading-monitoring"
    print_ok "URL dashboard : http://${VPS_IP}:${GRAFANA_PORT}/d/ict-trading-monitoring"
  else
    print_warn "Dashboard pas encore visible — attendre 30s et rafraîchir Grafana"
  fi
}

if [ "$MONITORING_ONLY" = true ]; then
  deploy_monitoring
  echo ""
  echo -e "${CYAN}════════════════════════════════════════════════════════${NC}"
  echo -e "${GREEN}  ✅  MONITORING déployé en ${SECONDS}s${NC}"
  echo -e "${CYAN}════════════════════════════════════════════════════════${NC}"
  echo ""
  echo -e "  ${WHITE}🔥 Grafana :${NC} http://${VPS_IP}:${GRAFANA_PORT}"
  echo -e "  ${WHITE}   Login   :${NC} ${GRAFANA_USER} / ${GRAFANA_PASSWORD}"
  echo -e "  ${WHITE}   Dashboard :${NC} http://${VPS_IP}:${GRAFANA_PORT}/d/ict-trading-monitoring"
  echo ""
  exit 0
fi

# ════════════════════════════════════════════════════════════════
# ÉTAPE 0 — PRÉREQUIS
# ════════════════════════════════════════════════════════════════
if [ "$SWARM_ONLY" = false ] && [ "$STAGING_ONLY" = false ]; then
  print_header "ÉTAPE 0 — Vérification des prérequis"

  ERRORS=0
  command -v terraform >/dev/null && print_ok "Terraform : $(terraform --version | head -1)" || { print_error "Terraform manquant"; ERRORS=$((ERRORS + 1)); }
  command -v ansible-playbook >/dev/null && print_ok "Ansible : $(ansible --version | head -1)" || { print_error "Ansible manquant"; ERRORS=$((ERRORS + 1)); }
  command -v docker >/dev/null && print_ok "Docker : $(docker --version)" || { print_error "Docker manquant"; ERRORS=$((ERRORS + 1)); }

  [ -d "$PROJECT_DIR" ]               && print_ok "Dossier projet présent"        || { print_error "Dossier projet introuvable"; ERRORS=$((ERRORS + 1)); }
  [ -f "$TERRAFORM_DIR/main.tf" ]     && print_ok "main.tf présent"               || { print_error "main.tf introuvable"; ERRORS=$((ERRORS + 1)); }
  [ -f "$ANSIBLE_DIR/playbook.yml" ]  && print_ok "playbook.yml présent"          || { print_error "playbook.yml manquant"; ERRORS=$((ERRORS + 1)); }
  [ -f "$PROJECT_DIR/.env.prod" ]     && print_ok ".env.prod présent"             || print_warn ".env.prod absent"

  if [ -f "$SSL_DIR/cloudflare-origin.crt" ] && [ -f "$SSL_DIR/cloudflare-origin.key" ]; then
    print_ok "Certificats Cloudflare Origin présents"
  else
    print_warn "Certificats SSL manquants dans $SSL_DIR"
  fi

  [ $ERRORS -gt 0 ] && { print_error "$ERRORS prérequis manquants"; exit 1; }
fi

# ════════════════════════════════════════════════════════════════
# ÉTAPE 1 — TERRAFORM
# ════════════════════════════════════════════════════════════════
if [ "$SWARM_ONLY" = false ] && [ "$STAGING_ONLY" = false ]; then
  print_header "ÉTAPE 1 — Terraform (génération des fichiers de config)"

  cd "$TERRAFORM_DIR"
  [ ! -d ".terraform" ] && { print_step "Init Terraform..."; terraform init; print_ok "Terraform initialisé"; } || print_ok "Terraform déjà initialisé"

  print_step "Application Terraform..."
  terraform apply -auto-approve
  print_ok "Terraform terminé"

  print_step "Validation des fichiers générés..."
  FILES=(
    "$PROJECT_DIR/docker-stack.prod.yml"
    "$PROJECT_DIR/docker-compose.staging.yml"
    "$PROJECT_DIR/docker-compose.monitoring.yml"
    "$PROJECT_DIR/dockerfx-gateway.conf"
    "$PROJECT_DIR/monitoring/prometheus.yml"
    "$PROJECT_DIR/monitoring/grafana/provisioning/datasources/datasource.yml"
    "$PROJECT_DIR/monitoring/grafana/provisioning/dashboards/dashboards.yml"
    "$PROJECT_DIR/monitoring/grafana/dashboards/ict-trading.json"
  )

  for f in "${FILES[@]}"; do
    [ -f "$f" ] && print_ok "$(basename "$f")" || { print_error "$(basename "$f") manquant"; exit 1; }
  done
fi

# ════════════════════════════════════════════════════════════════
# ÉTAPE 2 — BUILD DOCKER
# ════════════════════════════════════════════════════════════════
if [ "$SKIP_BUILD" = false ] && [ "$SWARM_ONLY" = false ] && [ "$STAGING_ONLY" = false ]; then
  print_header "ÉTAPE 2 — Build & Push Docker"

  cd "$PROJECT_DIR"
  docker info 2>/dev/null | grep -q "Username" && print_ok "Connecté à DockerHub" || { print_step "Connexion DockerHub..."; docker login; }

  print_step "Build backend..."
  docker build --target production -t ${DOCKERHUB_USER}/ict-trading-backend:latest "$PROJECT_DIR/backend/"
  print_ok "Backend buildé"

  print_step "Build frontend..."
  docker build --target production -t ${DOCKERHUB_USER}/ict-trading-frontend:latest "$PROJECT_DIR/frontend/"
  print_ok "Frontend buildé"

  print_step "Push images..."
  docker push ${DOCKERHUB_USER}/ict-trading-backend:latest
  docker push ${DOCKERHUB_USER}/ict-trading-frontend:latest
  docker tag ${DOCKERHUB_USER}/ict-trading-backend:latest ${DOCKERHUB_USER}/ict-trading-backend:develop
  docker tag ${DOCKERHUB_USER}/ict-trading-frontend:latest ${DOCKERHUB_USER}/ict-trading-frontend:develop
  docker push ${DOCKERHUB_USER}/ict-trading-backend:develop
  docker push ${DOCKERHUB_USER}/ict-trading-frontend:develop
  print_ok "Images pushées (latest + develop)"
else
  [ "$SKIP_BUILD" = true ] && { print_header "ÉTAPE 2 — Build ignoré (--skip-build)"; print_warn "Images DockerHub existantes utilisées"; }
fi

# ════════════════════════════════════════════════════════════════
# ÉTAPE 3 — ANSIBLE (prod + staging + gateway)
# ════════════════════════════════════════════════════════════════
print_header "ÉTAPE 3 — Ansible (provisioning VPS)"

cd "$ANSIBLE_DIR"
print_step "Test connexion Ansible..."
ansible -i inventory.yml vps_prod -m ping >/dev/null 2>&1 && print_ok "Connexion OK" || { print_error "Connexion Ansible échouée"; exit 1; }

if [ "$SWARM_ONLY" = true ]; then
  ansible-playbook -i inventory.yml playbook.yml --tags swarm,gateway,verify
elif [ "$STAGING_ONLY" = true ]; then
  ansible-playbook -i inventory.yml playbook.yml --tags staging,gateway,verify
else
  ansible-playbook -i inventory.yml playbook.yml
fi

print_ok "Ansible terminé"

# ════════════════════════════════════════════════════════════════
# ÉTAPE 4 — MONITORING
# ════════════════════════════════════════════════════════════════
deploy_monitoring

# ════════════════════════════════════════════════════════════════
# ÉTAPE 5 — VÉRIFICATIONS FINALES
# ════════════════════════════════════════════════════════════════
print_header "ÉTAPE 5 — Vérifications finales"
sleep 20

echo ""
echo -e "${WHITE}  🌐 Vérifications gateway :${NC}"
echo -e "${CYAN}  ─────────────────────────────────────────────────────${NC}"

curl -k -sf --connect-timeout 5 --max-time 10 -H "Host: $PROD_DOMAIN" https://127.0.0.1/ >/dev/null \
  && print_ok "Production   https://$PROD_DOMAIN → OK" \
  || print_error "Production   https://$PROD_DOMAIN → KO"

curl -k -sf --connect-timeout 5 --max-time 10 -H "Host: $STAGING_DOMAIN" https://127.0.0.1/ >/dev/null \
  && print_ok "Staging      https://$STAGING_DOMAIN → OK" \
  || print_warn "Staging      https://$STAGING_DOMAIN → KO"

curl -sf --connect-timeout 5 --max-time 10 "${GRAFANA_URL}/api/health" >/dev/null \
  && print_ok "Grafana      http://${VPS_IP}:${GRAFANA_PORT} → OK" \
  || print_warn "Grafana      http://${VPS_IP}:${GRAFANA_PORT} → KO"

echo ""
echo -e "${WHITE}  🐳 Services Swarm :${NC}"
echo -e "${CYAN}  ─────────────────────────────────────────────────────${NC}"
docker service ls || true

echo ""
echo -e "${WHITE}  📊 Containers monitoring :${NC}"
echo -e "${CYAN}  ─────────────────────────────────────────────────────${NC}"
docker compose -p monitoring -f "$PROJECT_DIR/docker-compose.monitoring.yml" ps 2>/dev/null || true

# ════════════════════════════════════════════════════════════════
# RÉSUMÉ FINAL
# ════════════════════════════════════════════════════════════════
echo ""
echo -e "${CYAN}════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  ✅  DÉPLOIEMENT COMPLET en ${SECONDS}s${NC}"
echo -e "${CYAN}════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "  ${WHITE}🟢 Production  :${NC} https://$PROD_DOMAIN"
echo -e "  ${WHITE}🔵 Staging     :${NC} https://$STAGING_DOMAIN"
echo -e "  ${WHITE}🔥 Grafana     :${NC} http://${VPS_IP}:${GRAFANA_PORT}"
echo -e "  ${WHITE}   Login       :${NC} ${GRAFANA_USER} / ${GRAFANA_PASSWORD}"
echo -e "  ${WHITE}   Dashboard   :${NC} http://${VPS_IP}:${GRAFANA_PORT}/d/ict-trading-monitoring"
echo ""
echo -e "  ${WHITE}Commandes utiles :${NC}"
echo -e "  ${CYAN}  docker service ls${NC}                            état Swarm"
echo -e "  ${CYAN}  docker service logs -f ict-prod_backend${NC}      logs backend"
echo -e "  ${CYAN}  docker compose -p monitoring -f $PROJECT_DIR/docker-compose.monitoring.yml ps${NC}"
echo -e "  ${CYAN}  bash deploy-full.sh --monitoring-only${NC}        redéployer monitoring seul"
echo ""