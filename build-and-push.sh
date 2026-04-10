#!/bin/bash
# ════════════════════════════════════════════════════════════════
# build-and-push.sh
# Build les images Docker et les push sur DockerHub
#
# Usage :
#   bash build-and-push.sh              ← tag = latest + develop
#   bash build-and-push.sh main         ← tag = latest
#   bash build-and-push.sh develop      ← tag = develop
# ════════════════════════════════════════════════════════════════

set -e

# ── Variables ─────────────────────────────────────────────────
DOCKERHUB_USER="dave67000"
BACKEND_IMAGE="${DOCKERHUB_USER}/ict-trading-backend"
FRONTEND_IMAGE="${DOCKERHUB_USER}/ict-trading-frontend"
BRANCH="${1:-main}"
SHA=$(git rev-parse --short HEAD 2>/dev/null || echo "local")

echo "════════════════════════════════════════════════════════"
echo "🐳 Build + Push Docker — ICT Trading Dashboard"
echo "   Branche : ${BRANCH}"
echo "   SHA     : ${SHA}"
echo "════════════════════════════════════════════════════════"

# ── Étape 1 : Login DockerHub ─────────────────────────────────
echo ""
echo "🔑 Connexion DockerHub..."
docker login
echo "✅ Connecté"

# ── Étape 2 : Définir les tags selon la branche ───────────────
if [ "$BRANCH" = "main" ]; then
  BACKEND_TAGS="-t ${BACKEND_IMAGE}:latest -t ${BACKEND_IMAGE}:${SHA}"
  FRONTEND_TAGS="-t ${FRONTEND_IMAGE}:latest -t ${FRONTEND_IMAGE}:${SHA}"
  echo "📌 Tags : latest + ${SHA}"
else
  BACKEND_TAGS="-t ${BACKEND_IMAGE}:${BRANCH} -t ${BACKEND_IMAGE}:${BRANCH}-${SHA}"
  FRONTEND_TAGS="-t ${FRONTEND_IMAGE}:${BRANCH} -t ${FRONTEND_IMAGE}:${BRANCH}-${SHA}"
  echo "📌 Tags : ${BRANCH} + ${BRANCH}-${SHA}"
fi

# ── Étape 3 : Build Backend ───────────────────────────────────
echo ""
echo "════════════════════════════════════════════════════════"
echo "🏗️  Build image BACKEND..."
echo "════════════════════════════════════════════════════════"

docker build \
  --target production \
  ${BACKEND_TAGS} \
  ~/dockerFX/backend/

echo "✅ Backend buildé"

# ── Étape 4 : Build Frontend ──────────────────────────────────
echo ""
echo "════════════════════════════════════════════════════════"
echo "🏗️  Build image FRONTEND..."
echo "════════════════════════════════════════════════════════"

docker build \
  --target production \
  ${FRONTEND_TAGS} \
  ~/dockerFX/frontend/

echo "✅ Frontend buildé"

# ── Étape 5 : Voir la taille des images ───────────────────────
echo ""
echo "📦 Taille des images :"
docker images | grep "ict-trading" | head -6

# ── Étape 6 : Push Backend ────────────────────────────────────
echo ""
echo "════════════════════════════════════════════════════════"
echo "⬆️  Push BACKEND vers DockerHub..."
echo "════════════════════════════════════════════════════════"

if [ "$BRANCH" = "main" ]; then
  docker push ${BACKEND_IMAGE}:latest
  docker push ${BACKEND_IMAGE}:${SHA}
else
  docker push ${BACKEND_IMAGE}:${BRANCH}
  docker push ${BACKEND_IMAGE}:${BRANCH}-${SHA}
fi

echo "✅ Backend pushé"

# ── Étape 7 : Push Frontend ───────────────────────────────────
echo ""
echo "════════════════════════════════════════════════════════"
echo "⬆️  Push FRONTEND vers DockerHub..."
echo "════════════════════════════════════════════════════════"

if [ "$BRANCH" = "main" ]; then
  docker push ${FRONTEND_IMAGE}:latest
  docker push ${FRONTEND_IMAGE}:${SHA}
else
  docker push ${FRONTEND_IMAGE}:${BRANCH}
  docker push ${FRONTEND_IMAGE}:${BRANCH}-${SHA}
fi

echo "✅ Frontend pushé"

# ── Résumé ────────────────────────────────────────────────────
echo ""
echo "════════════════════════════════════════════════════════"
echo "✅ Images disponibles sur DockerHub :"
echo ""
if [ "$BRANCH" = "main" ]; then
  echo "  ${BACKEND_IMAGE}:latest"
  echo "  ${BACKEND_IMAGE}:${SHA}"
  echo "  ${FRONTEND_IMAGE}:latest"
  echo "  ${FRONTEND_IMAGE}:${SHA}"
else
  echo "  ${BACKEND_IMAGE}:${BRANCH}"
  echo "  ${BACKEND_IMAGE}:${BRANCH}-${SHA}"
  echo "  ${FRONTEND_IMAGE}:${BRANCH}"
  echo "  ${FRONTEND_IMAGE}:${BRANCH}-${SHA}"
fi
echo ""
echo "Prochaine étape :"
echo "  ansible-playbook -i infra/ansible/inventory.yml infra/ansible/playbook.yml"
echo "════════════════════════════════════════════════════════"