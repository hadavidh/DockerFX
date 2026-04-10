#!/bin/bash
# ════════════════════════════════════════════════════════════════
# install-ansible-and-deploy.sh
# 1. Installe Ansible
# 2. Copie le playbook
# 3. Lance le déploiement
# Usage : bash install-ansible-and-deploy.sh
# ════════════════════════════════════════════════════════════════

set -e
cd ~/dockerFX

echo "════════════════════════════════════════════════════════"
echo "🔧 Installation d'Ansible"
echo "════════════════════════════════════════════════════════"

# Installer Ansible
sudo apt install ansible -y

# Vérifier
ansible --version | head -1
echo "✅ Ansible installé"

echo ""
echo "════════════════════════════════════════════════════════"
echo "📁 Copie du playbook"
echo "════════════════════════════════════════════════════════"

# Copier le playbook dans le bon dossier
cp playbook.yml ~/dockerFX/infra/ansible/playbook.yml
echo "✅ playbook.yml copié"

echo ""
echo "════════════════════════════════════════════════════════"
echo "🧪 Test de connexion SSH au VPS"
echo "════════════════════════════════════════════════════════"

# Tester que Ansible peut se connecter au VPS
# (depuis le VPS lui-même vers localhost)
ansible -i ~/dockerFX/infra/ansible/inventory.yml \
        vps_prod -m ping \
        --connection=local 2>/dev/null || \
ansible -i ~/dockerFX/infra/ansible/inventory.yml \
        vps_prod -m ping

echo ""
echo "════════════════════════════════════════════════════════"
echo "🚀 Lancement du déploiement"
echo "════════════════════════════════════════════════════════"

ansible-playbook \
  -i ~/dockerFX/infra/ansible/inventory.yml \
  ~/dockerFX/infra/ansible/playbook.yml \
  -v

echo ""
echo "════════════════════════════════════════════════════════"
echo "✅ Déploiement terminé !"
echo ""
echo "Vérifications :"
curl -sf http://localhost/health    && echo "🟢 Production  OK" || echo "❌ Production  KO"
curl -sf http://localhost:8080/health && echo "🔵 Staging     OK" || echo "❌ Staging     KO"
echo "════════════════════════════════════════════════════════"
