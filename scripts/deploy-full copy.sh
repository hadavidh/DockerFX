#!/bin/bash
# ════════════════════════════════════════════════════════════════
#
#   ██████╗ ███████╗██████╗ ██╗      ██████╗ ██╗   ██╗
#   ██╔══██╗██╔════╝██╔══██╗██║     ██╔═══██╗╚██╗ ██╔╝
#   ██║  ██║█████╗  ██████╔╝██║     ██║   ██║ ╚████╔╝
#   ██║  ██║██╔══╝  ██╔═══╝ ██║     ██║   ██║  ╚██╔╝
#   ██████╔╝███████╗██║     ███████╗╚██████╔╝   ██║
#   ╚═════╝ ╚══════╝╚═╝     ╚══════╝ ╚═════╝    ╚═╝
#
#   ICT Trading Dashboard — Script de déploiement complet
#
#   Usage :
#     bash deploy-full.sh                ← déploiement complet
#     bash deploy-full.sh --skip-build   ← sans rebuild images
#     bash deploy-full.sh --swarm-only   ← seulement Swarm prod
#     bash deploy-full.sh --staging-only ← seulement Staging
#     bash deploy-full.sh --destroy      ← tout effacer
#
# ════════════════════════════════════════════════════════════════

set -e

# ── Couleurs ───────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
NC='\033[0m'

# ── Config ─────────────────────────────────────────────────────
PROJECT_DIR="$HOME/dockerFX"
TERRAFORM_DIR="$PROJECT_DIR/infra/terraform"
ANSIBLE_DIR="$PROJECT_DIR/infra/ansible"
DOCKERHUB_USER="dave67000"

# ── Flags (défauts) ────────────────────────────────────────────
SKIP_BUILD=false
SWARM_ONLY=false
STAGING_ONLY=false
DESTROY=false

# ── Parsing des arguments ──────────────────────────────────────
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
      echo "  (aucune)         Déploiement complet : Terraform + Build + Ansible + Swarm + Staging"
      echo "  --skip-build     Saute le build/push Docker (utilise les images déjà sur DockerHub)"
      echo "  --swarm-only     Redéploie seulement la stack Swarm (prod)"
      echo "  --staging-only   Redéploie seulement le staging (Compose)"
      echo "  --destroy        Supprime tout (containers, services, Swarm, réseaux)"
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

# ════════════════════════════════════════════════════════════════
# HELPERS
# ════════════════════════════════════════════════════════════════

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
print_info()  { echo -e "     ${CYAN}$1${NC}"; }

# ════════════════════════════════════════════════════════════════
# BANNIÈRE
# ════════════════════════════════════════════════════════════════

clear
echo -e "${CYAN}"
cat << 'EOF'
  ╔══════════════════════════════════════════════════════════╗
  ║     ICT Trading Dashboard — Script de déploiement       ║
  ║     Terraform → Docker → Ansible → Swarm                ║
  ╚══════════════════════════════════════════════════════════╝
EOF
echo -e "${NC}"
echo -e "  Heure de début : ${WHITE}$(date '+%d/%m/%Y %H:%M:%S')${NC}"
echo -e "  Dossier projet : ${WHITE}$PROJECT_DIR${NC}"
echo -e "  Mode           : ${WHITE}$( \
  [ "$DESTROY" = true ]      && echo "DESTROY" || \
  [ "$SWARM_ONLY" = true ]   && echo "SWARM ONLY" || \
  [ "$STAGING_ONLY" = true ] && echo "STAGING ONLY" || \
  [ "$SKIP_BUILD" = true ]   && echo "FULL (sans rebuild)" || \
  echo "FULL")${NC}"
echo ""

# ════════════════════════════════════════════════════════════════
# MODE DESTROY — Tout effacer proprement
# ════════════════════════════════════════════════════════════════

if [ "$DESTROY" = true ]; then
  print_header "🔥 MODE DESTROY — Suppression de tout"

  echo -e "  ${RED}⚠️  Tous les containers et services vont être supprimés.${NC}"
  echo -e "  ${YELLOW}Appuyer sur Entrée pour confirmer ou Ctrl+C pour annuler...${NC}"
  read -r

  # ── Swarm stack ──────────────────────────────────────────────
  print_step "Suppression stack Swarm ict-prod..."
  if docker stack ls 2>/dev/null | grep -q "ict-prod"; then
    docker stack rm ict-prod
    print_step "Attente de la suppression complète des services..."
    until [ -z "$(docker service ls --filter name=ict-prod -q 2>/dev/null)" ]; do
      echo -n "."
      sleep 2
    done
    echo ""
    print_ok "Stack Swarm ict-prod supprimée"
  else
    print_info "Aucune stack Swarm ict-prod active"
  fi

  # ── Docker Compose staging ───────────────────────────────────
  print_step "Arrêt du staging (Compose)..."
  if docker ps -q --filter "name=forex-backend-staging" 2>/dev/null | grep -q .; then
    cd "$PROJECT_DIR"
    docker compose -p staging -f docker-compose.staging.yml down 2>/dev/null || true
    print_ok "Staging arrêté"
  else
    print_info "Staging non actif"
  fi

  # ── Docker Compose dev ───────────────────────────────────────
  print_step "Arrêt du dev local (si actif)..."
  cd "$PROJECT_DIR"
  docker compose down 2>/dev/null || true
  print_ok "Dev local arrêté"

  # ── Quitter Docker Swarm ─────────────────────────────────────
  print_step "Quitter Docker Swarm..."
  SWARM_STATE=$(docker info --format '{{.Swarm.LocalNodeState}}' 2>/dev/null || echo "inactive")
  if [ "$SWARM_STATE" = "active" ]; then
    docker swarm leave --force
    print_ok "Docker Swarm quitté"
  else
    print_info "Docker Swarm non actif"
  fi

  # ── Nettoyage des ressources Docker ──────────────────────────
  print_step "Nettoyage des containers arrêtés..."
  docker container prune -f &>/dev/null
  print_ok "Containers nettoyés"

  print_step "Nettoyage des réseaux orphelins..."
  docker network prune -f &>/dev/null
  print_ok "Réseaux nettoyés"

  print_step "Nettoyage du cache de build..."
  docker builder prune -f &>/dev/null
  print_ok "Cache build nettoyé"

  # ── État final ───────────────────────────────────────────────
  echo ""
  echo -e "${WHITE}  État après nettoyage :${NC}"
  echo -e "${CYAN}  ─────────────────────────────────────────────────────${NC}"

  REMAINING=$(docker ps -a --format "{{.Names}}" 2>/dev/null | wc -l)
  if [ "$REMAINING" -eq 0 ]; then
    print_ok "Aucun container restant"
  else
    print_warn "$REMAINING container(s) encore présent(s) :"
    docker ps -a --format "    {{.Names}} — {{.Status}}"
  fi

  SERVICES=$(docker service ls -q 2>/dev/null | wc -l)
  if [ "$SERVICES" -eq 0 ]; then
    print_ok "Aucun service Swarm restant"
  else
    print_warn "$SERVICES service(s) encore présent(s) :"
    docker service ls
  fi

  echo ""
  echo -e "${GREEN}  ✅  Nettoyage complet terminé en ${SECONDS}s${NC}"
  echo -e "${CYAN}════════════════════════════════════════════════════════${NC}"
  echo ""
  echo -e "  Pour redéployer :"
  echo -e "  ${CYAN}bash scripts/deploy-full.sh --skip-build${NC}"
  echo ""
  exit 0
fi

# ════════════════════════════════════════════════════════════════
# ÉTAPE 0 — VÉRIFICATION DES PRÉREQUIS
# ════════════════════════════════════════════════════════════════

if [ "$SWARM_ONLY" = false ] && [ "$STAGING_ONLY" = false ]; then
  print_header "ÉTAPE 0 — Vérification des prérequis"

  ERRORS=0

  # Terraform
  if command -v terraform &>/dev/null; then
    print_ok "Terraform : $(terraform --version | head -1)"
  else
    print_error "Terraform non installé → bash install-terraform.sh"
    ERRORS=$((ERRORS + 1))
  fi

  # Ansible
  if command -v ansible-playbook &>/dev/null; then
    print_ok "Ansible : $(ansible --version | head -1)"
  else
    print_error "Ansible non installé → sudo apt install ansible -y"
    ERRORS=$((ERRORS + 1))
  fi

  # Docker
  if command -v docker &>/dev/null; then
    print_ok "Docker : $(docker --version)"
  else
    print_error "Docker non installé"
    ERRORS=$((ERRORS + 1))
  fi

  # Dossier projet
  if [ -d "$PROJECT_DIR" ]; then
    print_ok "Dossier projet : $PROJECT_DIR"
  else
    print_error "Dossier projet introuvable : $PROJECT_DIR"
    ERRORS=$((ERRORS + 1))
  fi

  # main.tf
  if [ -f "$TERRAFORM_DIR/main.tf" ]; then
    print_ok "Fichiers Terraform présents"
  else
    print_error "main.tf introuvable dans $TERRAFORM_DIR"
    ERRORS=$((ERRORS + 1))
  fi

  # .env.prod
  if [ -f "$PROJECT_DIR/.env.prod" ]; then
    print_ok ".env.prod présent"
  else
    print_warn ".env.prod absent — sera créé vide par Ansible"
  fi

  if [ $ERRORS -gt 0 ]; then
    echo ""
    print_error "$ERRORS prérequis manquants. Corriger avant de continuer."
    exit 1
  fi
  print_ok "Tous les prérequis sont satisfaits"
fi

# ════════════════════════════════════════════════════════════════
# ÉTAPE 0b — NETTOYAGE DES STACKS EXISTANTES
# ════════════════════════════════════════════════════════════════

if [ "$SWARM_ONLY" = false ] && [ "$STAGING_ONLY" = false ]; then
  print_header "ÉTAPE 0b — Nettoyage des stacks existantes"

  # Swarm
  if docker service ls -q 2>/dev/null | grep -q .; then
    print_step "Suppression de la stack Swarm ict-prod..."
    docker stack rm ict-prod 2>/dev/null || true
    print_step "Attente suppression complète..."
    sleep 10
    print_ok "Stack Swarm supprimée"
  else
    print_info "Aucune stack Swarm active"
  fi

  # Staging
  if docker ps -q --filter "name=forex-frontend-staging" 2>/dev/null | grep -q .; then
    print_step "Arrêt du staging..."
    cd "$PROJECT_DIR"
    docker compose -p staging -f docker-compose.staging.yml down 2>/dev/null || true
    print_ok "Staging arrêté"
  else
    print_info "Staging non actif"
  fi

  # Réseaux
  print_step "Nettoyage des réseaux Docker orphelins..."
  docker network prune -f &>/dev/null
  print_ok "Réseaux nettoyés"
fi

# ════════════════════════════════════════════════════════════════
# ÉTAPE 1 — TERRAFORM
# ════════════════════════════════════════════════════════════════

if [ "$SWARM_ONLY" = false ] && [ "$STAGING_ONLY" = false ]; then
  print_header "ÉTAPE 1 — Terraform (génération des fichiers de config)"

  cd "$TERRAFORM_DIR"

  # Init si .terraform absent
  if [ ! -d ".terraform" ]; then
    print_step "Initialisation de Terraform (première fois)..."
    terraform init
    print_ok "Terraform initialisé"
  else
    print_ok "Terraform déjà initialisé"
  fi

  # Apply
  print_step "Application de Terraform..."
  terraform apply -auto-approve
  print_ok "Terraform terminé"

  # Vérification fichiers générés
  echo ""
  print_step "Vérification des fichiers générés :"
  FILES=(
    "$PROJECT_DIR/docker-stack.prod.yml"
    "$PROJECT_DIR/docker-compose.staging.yml"
    "$PROJECT_DIR/frontend/nginx.conf"
    "$PROJECT_DIR/frontend/nginx.staging.conf"
    "$PROJECT_DIR/infra/ansible/inventory.yml"
    "$PROJECT_DIR/.env.staging.example"
  )
  for f in "${FILES[@]}"; do
    if [ -f "$f" ]; then
      print_ok "$(basename $f)"
    else
      print_warn "$(basename $f) — non généré"
    fi
  done
fi

# ════════════════════════════════════════════════════════════════
# ÉTAPE 2 — BUILD ET PUSH DOCKER
# ════════════════════════════════════════════════════════════════

if [ "$SKIP_BUILD" = false ] && [ "$SWARM_ONLY" = false ] && [ "$STAGING_ONLY" = false ]; then
  print_header "ÉTAPE 2 — Build et push des images Docker"

  cd "$PROJECT_DIR"

  # Vérifier connexion DockerHub
  if docker info 2>/dev/null | grep -q "Username"; then
    DOCKER_USER=$(docker info 2>/dev/null | grep "Username:" | awk '{print $2}')
    print_ok "Connecté à DockerHub : $DOCKER_USER"
  else
    print_step "Connexion à DockerHub requise..."
    docker login
  fi

  # Build backend
  print_step "Build image backend (latest)..."
  docker build \
    --target production \
    -t ${DOCKERHUB_USER}/ict-trading-backend:latest \
    "$PROJECT_DIR/backend/" 2>&1 | tail -3
  print_ok "Backend buildé"

  # Build frontend
  print_step "Build image frontend (latest) avec nginx.conf Swarm..."
  docker build \
    --target production \
    -t ${DOCKERHUB_USER}/ict-trading-frontend:latest \
    "$PROJECT_DIR/frontend/" 2>&1 | tail -3
  print_ok "Frontend buildé"

  # Taille des images (latest seulement à ce stade)
  echo ""
  print_info "Taille des images locales juste après build :"
  docker images --format 'table {{.Repository}}\t{{.Tag}}\t{{.Size}}' | grep "dave67000/ict-trading" | grep "latest" || true

  # Push latest
  print_step "Push backend:latest vers DockerHub..."
  docker push ${DOCKERHUB_USER}/ict-trading-backend:latest 2>&1 | tail -2
  print_ok "Backend pushé"

  print_step "Push frontend:latest vers DockerHub..."
  docker push ${DOCKERHUB_USER}/ict-trading-frontend:latest 2>&1 | tail -2
  print_ok "Frontend pushé"

  # Tag + push develop (pour staging)
  print_step "Tag + push images :develop (pour staging)..."
  docker tag ${DOCKERHUB_USER}/ict-trading-backend:latest \
             ${DOCKERHUB_USER}/ict-trading-backend:develop
  docker tag ${DOCKERHUB_USER}/ict-trading-frontend:latest \
             ${DOCKERHUB_USER}/ict-trading-frontend:develop
  docker push ${DOCKERHUB_USER}/ict-trading-backend:develop 2>&1 | tail -1
  docker push ${DOCKERHUB_USER}/ict-trading-frontend:develop 2>&1 | tail -1
  print_ok "Images :develop pushées"

  echo ""
  print_info "Tags locaux backend/frontend après tag staging :"
  docker images --format 'table {{.Repository}}\t{{.Tag}}\t{{.Size}}' | grep "dave67000/ict-trading" | grep -E '(latest|develop)' || true

else
  if [ "$SKIP_BUILD" = true ]; then
    print_header "ÉTAPE 2 — Build Docker (ignoré --skip-build)"
    print_warn "Images existantes sur DockerHub utilisées"
  fi
fi

# ════════════════════════════════════════════════════════════════
# ÉTAPE 3 — ANSIBLE (selon le mode)
# ════════════════════════════════════════════════════════════════

print_header "ÉTAPE 3 — Ansible (déploiement sur le VPS)"

cd "$ANSIBLE_DIR"

# Test connexion
print_step "Test de connexion Ansible..."
if ansible -i inventory.yml vps_prod -m ping &>/dev/null; then
  print_ok "Connexion Ansible OK"
else
  print_error "Connexion Ansible échouée — vérifier inventory.yml"
  exit 1
fi

if [ "$SWARM_ONLY" = true ]; then
  print_step "Mode --swarm-only : déploiement Swarm uniquement..."
  ansible-playbook -i inventory.yml playbook.yml --tags swarm

elif [ "$STAGING_ONLY" = true ]; then
  print_step "Mode --staging-only : déploiement Staging uniquement..."
  ansible-playbook -i inventory.yml playbook.yml --tags staging,verify

else
  print_step "Déploiement complet (system → docker → firewall → config → env → swarm → staging)..."
  ansible-playbook -i inventory.yml playbook.yml
fi

# ════════════════════════════════════════════════════════════════
# ÉTAPE 4 — VÉRIFICATIONS FINALES
# ════════════════════════════════════════════════════════════════

print_header "ÉTAPE 4 — Vérifications finales"

print_step "Attente du démarrage des services (30s)..."
sleep 30

# ── Services Docker Swarm ─────────────────────────────────────
echo ""
echo -e "${WHITE}  🐳 Services Docker Swarm :${NC}"
echo -e "${CYAN}  ─────────────────────────────────────────────────────${NC}"
docker service ls 2>/dev/null | while IFS= read -r line; do
  if echo "$line" | grep -q " [0-9]*/\1 " 2>/dev/null || \
     echo "$line" | grep -qP "\b(\d+)/\1\b" 2>/dev/null; then
    echo -e "  ${GREEN}$line${NC}"
  elif echo "$line" | grep -q "0/"; then
    echo -e "  ${RED}$line${NC}"
  else
    echo -e "  ${WHITE}$line${NC}"
  fi
done || echo -e "  ${YELLOW}  Aucun service Swarm actif${NC}"

# ── Tous les containers ───────────────────────────────────────
echo ""
echo -e "${WHITE}  🐳 Tous les containers :${NC}"
echo -e "${CYAN}  ─────────────────────────────────────────────────────${NC}"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null | \
  while IFS= read -r line; do
    if echo "$line" | grep -q "healthy"; then
      echo -e "  ${GREEN}$line${NC}"
    elif echo "$line" | grep -q "starting"; then
      echo -e "  ${YELLOW}$line${NC}"
    elif echo "$line" | grep -q "NAME"; then
      echo -e "  ${WHITE}$line${NC}"
    else
      echo -e "  ${CYAN}$line${NC}"
    fi
  done

# ── Health checks ─────────────────────────────────────────────
echo ""
echo -e "${WHITE}  🌐 Health checks HTTP :${NC}"
echo -e "${CYAN}  ─────────────────────────────────────────────────────${NC}"

if curl -4 -sf --connect-timeout 3 --max-time 5 http://127.0.0.1/ &>/dev/null; then
  print_ok "Production   http://localhost/       → OK"
else
  print_error "Production   http://localhost/       → KO"
fi

if curl -sf --max-time 5 http://localhost:8080/health &>/dev/null; then
  UPTIME=$(curl -s http://localhost:8080/health | \
    python3 -c "import json,sys;d=json.load(sys.stdin);print(str(round(d.get('uptime',0)))+'s')" 2>/dev/null || echo "OK")
  print_ok "Staging      http://localhost:8080   → uptime $UPTIME"
else
  print_warn "Staging      http://localhost:8080   → non disponible"
fi

# ── Ressources VPS ────────────────────────────────────────────
echo ""
echo -e "${WHITE}  📊 Ressources VPS :${NC}"
echo -e "${CYAN}  ─────────────────────────────────────────────────────${NC}"
free -h | grep "Mem:" | \
  awk '{printf "     RAM    : utilisée %-8s / total %-8s (libre %s)\n", $3, $2, $4}'
df -h / | tail -1 | \
  awk '{printf "     Disque : utilisé  %-8s / total %-8s (%s plein)\n", $3, $2, $5}'

# ── Replicas Swarm détail ─────────────────────────────────────
echo ""
echo -e "${WHITE}  🔁 Détail des replicas Swarm :${NC}"
echo -e "${CYAN}  ─────────────────────────────────────────────────────${NC}"
for SERVICE in ict-prod_backend ict-prod_frontend; do
  REPLICAS=$(docker service ls --filter "name=$SERVICE" \
    --format "{{.Replicas}}" 2>/dev/null || echo "N/A")
  if echo "$REPLICAS" | grep -qE "^[1-9]/[1-9]"; then
    print_ok "$SERVICE : $REPLICAS"
  elif [ "$REPLICAS" = "N/A" ] || [ -z "$REPLICAS" ]; then
    print_warn "$SERVICE : non déployé"
  else
    print_error "$SERVICE : $REPLICAS"
  fi
done

# ════════════════════════════════════════════════════════════════
# RÉSUMÉ FINAL
# ════════════════════════════════════════════════════════════════

echo ""
echo -e "${CYAN}════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  ✅  DÉPLOIEMENT TERMINÉ en ${SECONDS}s${NC}"
echo -e "${CYAN}════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "  ${WHITE}🟢 Production  (Swarm)  :${NC} http://135.125.196.204"
echo -e "  ${WHITE}🔵 Staging     (Compose):${NC} http://135.125.196.204:8080"
echo ""
echo -e "  ${WHITE}Commandes utiles :${NC}"
echo -e "  ${CYAN}  docker service ls${NC}                           état des services Swarm"
echo -e "  ${CYAN}  docker service scale ict-prod_backend=3${NC}   scaler le backend prod"
echo -e "  ${CYAN}  docker service logs -f ict-prod_backend${NC}   logs backend prod"
echo -e "  ${CYAN}  docker logs -f forex-backend-staging${NC}        logs staging"
echo -e "  ${CYAN}  docker service rollback ict-prod_backend${NC}  rollback backend prod"
echo ""
echo -e "  ${WHITE}Redéployer :${NC}"
echo -e "  ${CYAN}  bash scripts/deploy-full.sh --skip-build${NC}    sans rebuild"
echo -e "  ${CYAN}  bash scripts/deploy-full.sh --swarm-only${NC}    seulement prod"
echo -e "  ${CYAN}  bash scripts/deploy-full.sh --destroy${NC}       tout effacer"
echo ""
echo -e "${CYAN}════════════════════════════════════════════════════════${NC}"
echo ""