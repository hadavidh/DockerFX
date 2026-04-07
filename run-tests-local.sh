#!/bin/bash
# ════════════════════════════════════════════════════════════════
# run-tests-local.sh
# Lance les tests Robot Framework en local sur le VPS
# Usage : bash run-tests-local.sh [suite]
# Exemples :
#   bash run-tests-local.sh           → tous les tests
#   bash run-tests-local.sh api       → seulement les tests API
#   bash run-tests-local.sh smoke     → tag smoke uniquement
# ════════════════════════════════════════════════════════════════

set -e

PROJECT_DIR="$HOME/dockerFX"
REPORTS_DIR="$PROJECT_DIR/reports"
TESTS_DIR="$PROJECT_DIR/tests/robot"
SUITE="${1:-}"
TAG="${2:-}"

echo "════════════════════════════════════════════════════════"
echo "🤖 ICT Trading Dashboard — Tests Robot Framework"
echo "════════════════════════════════════════════════════════"

# ── Prérequis ─────────────────────────────────────────────────
if ! command -v python3 &> /dev/null; then
    echo "❌ Python3 non installé"
    exit 1
fi

if ! python3 -c "import robot" 2>/dev/null; then
    echo "📦 Installation Robot Framework..."
    pip install -r "$TESTS_DIR/../requirements.txt"
    rfbrowser init chromium
fi

# ── Créer les dossiers ────────────────────────────────────────
mkdir -p "$REPORTS_DIR/screenshots"

# ── Vérifier que le backend tourne ────────────────────────────
echo "🔍 Vérification backend..."
if ! curl -sf http://localhost/health > /dev/null; then
    echo "⚠️  Backend non disponible sur 80"
    echo "   Lance d'abord : cd ~/dockerFX && docker compose up -d"
    exit 1
fi
echo "✅ Backend OK"

# ── Vérifier que le frontend tourne ───────────────────────────
echo "🔍 Vérification frontend..."
if ! curl -sf http://localhost > /dev/null; then
    echo "⚠️  Frontend non disponible sur :80"
    exit 1
fi
echo "✅ Frontend OK"

# ── Options Robot ─────────────────────────────────────────────
ROBOT_OPTS=(
    "--outputdir" "$REPORTS_DIR"
    "--output"    "output.xml"
    "--log"       "log.html"
    "--report"    "report.html"
    "--xunit"     "xunit.xml"
    "--variable"  "BASE_URL:http://localhost"
    "--variable"  "API_URL:http://localhost"
    "--variable"  "LOGIN:${DASHBOARD_LOGIN:-hadavidh@gmail.com}"
    "--variable"  "PASSWORD:${DASHBOARD_PASSWORD:-motdepasse}"
    "--loglevel"  "INFO"
)

# Tag filter
if [ -n "$TAG" ]; then
    ROBOT_OPTS+=("--include" "$TAG")
    echo "🏷️  Filtre tag: $TAG"
fi

# Suite spécifique ou tous les tests
# Argument 1 = nom de suite (dashboard, api) OU tag (smoke, login...)
if [ -n "$SUITE" ]; then
    SUITE_FILE="$TESTS_DIR/suites/${SUITE}_tests.robot"
    if [ -f "$SUITE_FILE" ]; then
        TEST_PATH="$SUITE_FILE"
        echo "📁 Suite: $SUITE"
    else
        # Pas un fichier → traiter comme un tag
        ROBOT_OPTS+=("--include" "$SUITE")
        TEST_PATH="$TESTS_DIR/suites/"
        echo "🏷️  Tag: $SUITE (tous les fichiers)"
    fi
else
    TEST_PATH="$TESTS_DIR/suites/"
    echo "📁 Suite: Tous les tests"
fi

echo "════════════════════════════════════════════════════════"
echo "▶️  Lancement des tests..."
echo "════════════════════════════════════════════════════════"

# ── Lancement ─────────────────────────────────────────────────
START_TIME=$(date +%s)

python -m robot "${ROBOT_OPTS[@]}" "$TEST_PATH"
EXIT_CODE=$?

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

echo "════════════════════════════════════════════════════════"
echo "⏱️  Durée: ${DURATION}s"

# ── Résumé ────────────────────────────────────────────────────
if [ $EXIT_CODE -eq 0 ]; then
    echo "✅ TOUS LES TESTS PASSÉS"
else
    echo "❌ CERTAINS TESTS ONT ÉCHOUÉ (code: $EXIT_CODE)"
fi

echo ""
echo "📊 Rapports disponibles dans : $REPORTS_DIR"
echo "   report.html → http://localhost/reports/report.html"
echo "   log.html    → http://localhost/reports/log.html"
echo "════════════════════════════════════════════════════════"

exit $EXIT_CODE