#!/bin/bash
# ════════════════════════════════════════════════════════════════
# install-terraform.sh
# Installe Terraform sur Ubuntu 24 + crée la structure du projet
# Usage : bash install-terraform.sh
# ════════════════════════════════════════════════════════════════

set -e  # Arrête si une commande échoue

echo "════════════════════════════════════════════════════════"
echo "🔧 Installation de Terraform sur Ubuntu 24"
echo "════════════════════════════════════════════════════════"

# ── Étape 1 : Clé GPG HashiCorp ──────────────────────────────
echo "📥 Ajout de la clé GPG HashiCorp..."
wget -O- https://apt.releases.hashicorp.com/gpg | \
  sudo gpg --dearmor -o /usr/share/keyrings/hashicorp-archive-keyring.gpg

# ── Étape 2 : Dépôt apt ──────────────────────────────────────
echo "📦 Ajout du dépôt HashiCorp..."
echo "deb [signed-by=/usr/share/keyrings/hashicorp-archive-keyring.gpg] \
  https://apt.releases.hashicorp.com $(lsb_release -cs) main" | \
  sudo tee /etc/apt/sources.list.d/hashicorp.list

# ── Étape 3 : Installation ────────────────────────────────────
echo "⬇️  Installation de Terraform..."
sudo apt-get update -qq
sudo apt-get install -y terraform

# ── Étape 4 : Vérification ────────────────────────────────────
echo ""
echo "✅ Terraform installé :"
terraform --version

# ── Étape 5 : Créer la structure du projet ────────────────────
echo ""
echo "════════════════════════════════════════════════════════"
echo "📁 Création de l'arborescence du projet..."
echo "════════════════════════════════════════════════════════"

cd ~/dockerFX

# Dossiers IaC
mkdir -p infra/terraform
mkdir -p infra/ansible/roles/docker/tasks
mkdir -p infra/ansible/roles/nginx/tasks
mkdir -p infra/ansible/roles/nginx/templates
mkdir -p infra/ansible/roles/monitoring/tasks

# Dossiers app
mkdir -p nginx
mkdir -p monitoring/prometheus
mkdir -p monitoring/grafana/dashboards
mkdir -p monitoring/grafana/provisioning
mkdir -p monitoring/loki
mkdir -p monitoring/promtail
mkdir -p monitoring/alertmanager
mkdir -p tests/robot/suites
mkdir -p reports/screenshots
mkdir -p scripts
mkdir -p docs

# ── Étape 6 : Mettre à jour .gitignore ───────────────────────
echo ""
echo "📝 Mise à jour de .gitignore..."

# Vérifier si les lignes existent déjà
if ! grep -q "terraform.tfstate" .gitignore 2>/dev/null; then
cat >> .gitignore << 'EOF'

# ── Terraform (ne jamais committer) ──────────────────────────
infra/terraform/.terraform/
infra/terraform/terraform.tfstate
infra/terraform/terraform.tfstate.backup
infra/terraform/.terraform.lock.hcl
infra/terraform/terraform.tfvars

# ── Secrets environnements ────────────────────────────────────
.env.prod
.env.staging

# ── Rapports tests ────────────────────────────────────────────
reports/
!reports/.gitkeep
EOF
echo "✅ .gitignore mis à jour"
else
  echo "ℹ️  .gitignore déjà à jour"
fi

echo ""
echo "════════════════════════════════════════════════════════"
echo "✅ Tout est prêt !"
echo ""
echo "Prochaines étapes :"
echo ""
echo "  1. Copier les fichiers Terraform dans le bon dossier :"
echo "     cp main.tf variables.tf outputs.tf ~/dockerFX/infra/terraform/"
echo ""
echo "  2. Initialiser Terraform :"
echo "     cd ~/dockerFX/infra/terraform"
echo "     terraform init"
echo ""
echo "  3. Voir ce que Terraform va générer :"
echo "     terraform plan"
echo ""
echo "  4. Générer les fichiers de config :"
echo "     terraform apply"
echo ""
echo "════════════════════════════════════════════════════════"
