#!/bin/bash
# ════════════════════════════════════════════════════════════════
#
#   ICT Trading Dashboard — Script de déploiement complet
#   Architecture gateway-ready :
#   - PROD    : https://dockerfx.trade
#   - STAGING : https://staging.dockerfx.trade
#
#   Usage :
#     bash deploy-full.sh                ← déploiement complet
#     bash deploy-full.sh --skip-build   ← sans rebuild images
#     bash deploy-full.sh --swarm-only   ← seulement Swarm prod
#     bash deploy-full.sh --staging-only ← seulement Staging
#     bash deploy-full.sh --destroy      ← tout effacer
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
GATEWAY_CONF="$PROJECT_DIR/dockerfx-gateway.conf"
PROD_DOMAIN="dockerfx.trade"
STAGING_DOMAIN="staging.dockerfx.trade"

SKIP_BUILD=false
SWARM_ONLY=false
STAGING_ONLY=false
DESTROY=false

for arg in "$@"; do
  case $arg in
    --skip-build)   SKIP_BUILD=true ;;
    --swarm-only)   SWARM_ONLY=true ;;
    --staging-only) STAGING_ONLY=true ;;
    --destroy)      DESTROY=true ;;
    --help|-h)
      echo ""
      echo "Usage : bash deploy-full.sh [OPTIONS]"
      echo ""
      echo "Options :"
      echo "  (aucune)         Déploiement complet : Terraform + Build + Ansible + Swarm(prod) + Compose(staging) + gateway"
      echo "  --skip-build     Saute le build/push Docker (utilise les images déjà sur DockerHub)"
      echo "  --swarm-only     Redéploie seulement la stack Swarm (prod gateway-ready)"
      echo "  --staging-only   Redéploie seulement le staging (Compose derrière gateway)"
      echo "  --destroy        Supprime prod + staging (le gateway Nginx hôte reste installé)"
      echo "  --help           Affiche cette aide"
      echo ""
      exit 0
      ;;
    *)
      echo "Option inconnue : $arg"
      echo "Utiliser --help pour voir les options disponibles"
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

clear
echo -e "${CYAN}"
cat << 'EOF'
  ╔══════════════════════════════════════════════════════════╗
  ║   ICT Trading Dashboard — Déploiement gateway-ready     ║
  ║   Terraform → Docker → Ansible → Swarm + Compose       ║
  ╚══════════════════════════════════════════════════════════╝
EOF
echo -e "${NC}"
echo -e "  Heure de début : ${WHITE}$(date '+%d/%m/%Y %H:%M:%S')${NC}"
echo -e "  Dossier projet : ${WHITE}$PROJECT_DIR${NC}"
echo -e "  PROD           : ${WHITE}https://$PROD_DOMAIN${NC}"
echo -e "  STAGING        : ${WHITE}https://$STAGING_DOMAIN${NC}"
echo ""

if [ "$DESTROY" = true ]; then
  print_header "🔥 MODE DESTROY — Suppression des workloads"

  print_step "Suppression stack Swarm ict-prod..."
  docker stack rm ict-prod 2>/dev/null || true
  until [ -z "$(docker service ls --filter name=ict-prod -q 2>/dev/null)" ]; do
    sleep 2
  done
  print_ok "Stack Swarm prod supprimée"

  print_step "Arrêt du staging..."
  cd "$PROJECT_DIR"
  docker compose -p staging -f docker-compose.staging.yml down --remove-orphans 2>/dev/null || true
  docker rm -f staging-backend-1 staging-frontend-1 forex-backend-staging forex-frontend-staging 2>/dev/null || true
  print_ok "Staging arrêté"

  print_step "Nettoyage ressources Docker orphelines..."
  docker network prune -f >/dev/null 2>&1 || true
  docker container prune -f >/dev/null 2>&1 || true
  docker builder prune -f >/dev/null 2>&1 || true
  print_ok "Nettoyage terminé"

  echo ""
  print_warn "Le gateway Nginx hôte reste installé."
  echo -e "  Pour le retirer manuellement :"
  echo -e "  ${CYAN}sudo rm -f /etc/nginx/sites-enabled/dockerfx-gateway.conf && sudo nginx -t && sudo systemctl reload nginx${NC}"
  exit 0
fi

if [ "$SWARM_ONLY" = false ] && [ "$STAGING_ONLY" = false ]; then
  print_header "ÉTAPE 0 — Vérification des prérequis"

  ERRORS=0

  command -v terraform >/dev/null && print_ok "Terraform : $(terraform --version | head -1)" || { print_error "Terraform manquant"; ERRORS=$((ERRORS + 1)); }
  command -v ansible-playbook >/dev/null && print_ok "Ansible : $(ansible --version | head -1)" || { print_error "Ansible manquant"; ERRORS=$((ERRORS + 1)); }
  command -v docker >/dev/null && print_ok "Docker : $(docker --version)" || { print_error "Docker manquant"; ERRORS=$((ERRORS + 1)); }

  [ -d "$PROJECT_DIR" ] && print_ok "Dossier projet présent" || { print_error "Dossier projet introuvable"; ERRORS=$((ERRORS + 1)); }
  [ -f "$TERRAFORM_DIR/main.tf" ] && print_ok "main.tf présent" || { print_error "main.tf introuvable"; ERRORS=$((ERRORS + 1)); }
  [ -f "$ANSIBLE_DIR/playbook.yml" ] && [ -f "$ANSIBLE_DIR/inventory.yml" ] && print_ok "Fichiers Ansible présents" || { print_error "playbook.yml ou inventory.yml manquant"; ERRORS=$((ERRORS + 1)); }

  [ -f "$PROJECT_DIR/.env.prod" ] && print_ok ".env.prod présent" || print_warn ".env.prod absent — Ansible le créera si besoin"

  if [ -f "$SSL_DIR/cloudflare-origin.crt" ] && [ -f "$SSL_DIR/cloudflare-origin.key" ]; then
    print_ok "Certificats Cloudflare Origin présents"
  else
    print_warn "Certificats Cloudflare Origin manquants dans $SSL_DIR"
  fi

  if [ $ERRORS -gt 0 ]; then
    print_error "$ERRORS prérequis manquants"
    exit 1
  fi
fi

if [ "$SWARM_ONLY" = false ] && [ "$STAGING_ONLY" = false ]; then
  print_header "ÉTAPE 1 — Terraform"

  cd "$TERRAFORM_DIR"
  if [ ! -d ".terraform" ]; then
    print_step "Initialisation Terraform..."
    terraform init
    print_ok "Terraform initialisé"
  else
    print_ok "Terraform déjà initialisé"
  fi

  print_step "Application de Terraform..."
  terraform apply -auto-approve
  print_ok "Terraform terminé"

  print_step "Validation des fichiers générés..."
  FILES=(
    "$PROJECT_DIR/docker-stack.prod.yml"
    "$PROJECT_DIR/docker-compose.staging.yml"
    "$PROJECT_DIR/dockerfx-gateway.conf"
    "$PROJECT_DIR/frontend/nginx.conf"
    "$PROJECT_DIR/frontend/nginx.staging.conf"
    "$PROJECT_DIR/infra/ansible/inventory.yml"
  )

  for f in "${FILES[@]}"; do
    [ -f "$f" ] && print_ok "$(basename "$f")" || { print_error "$(basename "$f") manquant"; exit 1; }
  done

  docker stack config -c "$PROJECT_DIR/docker-stack.prod.yml" >/dev/null 2>&1 && print_ok "docker-stack.prod.yml valide" || { print_error "docker-stack.prod.yml invalide"; docker stack config -c "$PROJECT_DIR/docker-stack.prod.yml" || true; exit 1; }
  docker compose -p staging -f "$PROJECT_DIR/docker-compose.staging.yml" config >/dev/null 2>&1 && print_ok "docker-compose.staging.yml valide" || { print_error "docker-compose.staging.yml invalide"; docker compose -p staging -f "$PROJECT_DIR/docker-compose.staging.yml" config || true; exit 1; }
fi

if [ "$SKIP_BUILD" = false ] && [ "$SWARM_ONLY" = false ] && [ "$STAGING_ONLY" = false ]; then
  print_header "ÉTAPE 2 — Build & Push Docker"

  cd "$PROJECT_DIR"

  if docker info 2>/dev/null | grep -q "Username"; then
    print_ok "Connecté à DockerHub"
  else
    print_step "Connexion DockerHub requise..."
    docker login
  fi

  print_step "Build backend latest..."
  docker build --target production -t ${DOCKERHUB_USER}/ict-trading-backend:latest "$PROJECT_DIR/backend/"
  print_ok "Backend buildé"

  print_step "Build frontend latest (gateway-ready)..."
  docker build --target production -t ${DOCKERHUB_USER}/ict-trading-frontend:latest "$PROJECT_DIR/frontend/"
  print_ok "Frontend buildé"

  print_step "Push backend latest..."
  docker push ${DOCKERHUB_USER}/ict-trading-backend:latest
  print_ok "Backend pushé"

  print_step "Push frontend latest..."
  docker push ${DOCKERHUB_USER}/ict-trading-frontend:latest
  print_ok "Frontend pushé"

  print_step "Tag & push images develop (staging)..."
  docker tag ${DOCKERHUB_USER}/ict-trading-backend:latest ${DOCKERHUB_USER}/ict-trading-backend:develop
  docker tag ${DOCKERHUB_USER}/ict-trading-frontend:latest ${DOCKERHUB_USER}/ict-trading-frontend:develop
  docker push ${DOCKERHUB_USER}/ict-trading-backend:develop
  docker push ${DOCKERHUB_USER}/ict-trading-frontend:develop
  print_ok "Tags develop pushés"
else
  [ "$SKIP_BUILD" = true ] && { print_header "ÉTAPE 2 — Build ignoré (--skip-build)"; print_warn "Images déjà présentes sur DockerHub utilisées"; }
fi

print_header "ÉTAPE 3 — Ansible"

cd "$ANSIBLE_DIR"

print_step "Test connexion Ansible..."
ansible -i inventory.yml vps_prod -m ping >/dev/null 2>&1 && print_ok "Connexion Ansible OK" || { print_error "Connexion Ansible échouée"; exit 1; }

if [ "$SWARM_ONLY" = true ]; then
  print_step "Mode --swarm-only : prod seulement"
  ansible-playbook -i inventory.yml playbook.yml --tags swarm,gateway,verify
elif [ "$STAGING_ONLY" = true ]; then
  print_step "Mode --staging-only : staging seulement"
  ansible-playbook -i inventory.yml playbook.yml --tags staging,gateway,verify
else
  print_step "Déploiement complet"
  ansible-playbook -i inventory.yml playbook.yml
fi

print_header "ÉTAPE 4 — Vérifications finales"
sleep 20

echo ""
echo -e "${WHITE}  🌐 Vérifications gateway :${NC}"
echo -e "${CYAN}  ─────────────────────────────────────────────────────${NC}"

if curl -k -sf --connect-timeout 5 --max-time 10 -H "Host: $PROD_DOMAIN" https://127.0.0.1/ >/dev/null; then
  print_ok "Production   https://$PROD_DOMAIN → OK"
else
  print_error "Production   https://$PROD_DOMAIN → KO"
fi

if curl -k -sf --connect-timeout 5 --max-time 10 -H "Host: $STAGING_DOMAIN" https://127.0.0.1/ >/dev/null; then
  print_ok "Staging      https://$STAGING_DOMAIN → OK"
else
  print_warn "Staging      https://$STAGING_DOMAIN → KO"
fi

if curl -sf --connect-timeout 5 --max-time 10 http://127.0.0.1:8080/health >/dev/null; then
  print_ok "Origin staging local  http://127.0.0.1:8080/health → OK"
else
  print_warn "Origin staging local  http://127.0.0.1:8080/health → KO"
fi

echo ""
echo -e "${WHITE}  🐳 Services Swarm :${NC}"
echo -e "${CYAN}  ─────────────────────────────────────────────────────${NC}"
docker service ls || true

echo ""
echo -e "${CYAN}════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  ✅  DÉPLOIEMENT TERMINÉ en ${SECONDS}s${NC}"
echo -e "${CYAN}════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "  ${WHITE}🟢 Production  :${NC} https://$PROD_DOMAIN"
echo -e "  ${WHITE}🔵 Staging     :${NC} https://$STAGING_DOMAIN"
echo ""
echo -e "  ${WHITE}Commandes utiles :${NC}"
echo -e "  ${CYAN}  docker service ls${NC}                                état des services Swarm"
echo -e "  ${CYAN}  docker service logs -f ict-prod_frontend${NC}        logs frontend prod"
echo -e "  ${CYAN}  docker compose -p staging -f docker-compose.staging.yml logs -f backend${NC}  logs staging"
echo -e "  ${CYAN}  sudo nginx -t && sudo systemctl reload nginx${NC}     recharger le gateway hôte"
echo -e "  ${CYAN}  curl -k -H \"Host: $PROD_DOMAIN\" https://127.0.0.1/${NC}      test prod local"
echo -e "  ${CYAN}  curl -k -H \"Host: $STAGING_DOMAIN\" https://127.0.0.1/${NC}   test staging local"
echo ""
