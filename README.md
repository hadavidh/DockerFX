# 📊 Forex Signal Dashboard

Dashboard temps réel affichant les probabilités et signaux de la stratégie **Triple EMA + RSI** sur 20 paires Forex, avec notifications Telegram automatiques.

---

## 🏗️ Architecture

```
TradingView (Alerte Webhook)
        │
        ▼  POST /webhook  (JSON)
┌───────────────────────────────────────┐
│          VPS (Docker)                 │
│                                       │
│  ┌─────────────┐   ┌───────────────┐  │
│  │   Backend   │──▶│   Telegram    │  │
│  │  Node.js    │   │    Bot API    │  │
│  │  Port 3001  │   └───────────────┘  │
│  │  WebSocket  │                      │
│  └──────┬──────┘                      │
│         │ WebSocket /ws               │
│  ┌──────▼──────┐                      │
│  │  Frontend   │                      │
│  │ React+Vite  │◀── Navigateur        │
│  │  Nginx :80  │                      │
│  └─────────────┘                      │
└───────────────────────────────────────┘
```

---

## 📋 Prérequis VPS

- **Docker** et **Docker Compose** installés
- Port **80** ouvert (HTTP)
- Port **3001** accessible depuis TradingView (ou port 80 via nginx proxy)
- Minimum **512 MB RAM**, **1 CPU**

---

## 🚀 Installation sur le VPS

### Étape 1 — Copier les fichiers sur le VPS

```bash
# Depuis ta machine locale
scp -r forex-dashboard/ user@TON_VPS_IP:/opt/forex-dashboard

# Ou via git si tu as un repo
git clone https://github.com/TON_REPO/forex-dashboard.git /opt/forex-dashboard
```

### Étape 2 — Configurer les variables d'environnement

```bash
cd /opt/forex-dashboard
cp .env.example .env
nano .env
```

Remplis les deux valeurs :
```
TELEGRAM_TOKEN=123456789:ABCdef...
TELEGRAM_CHATID=-1001234567890
```

**Comment obtenir ces valeurs :**

| Valeur | Procédure |
|---|---|
| `TELEGRAM_TOKEN` | Ouvre Telegram → cherche `@BotFather` → `/newbot` → copie le token |
| `TELEGRAM_CHATID` | Envoie un message à ton bot → ouvre `https://api.telegram.org/botTON_TOKEN/getUpdates` → récupère `chat.id` |

### Étape 3 — Lancer l'application

```bash
cd /opt/forex-dashboard
docker compose up -d --build
```

Vérifie que tout fonctionne :
```bash
docker compose ps
# Doit afficher : forex-backend UP, forex-frontend UP

docker compose logs -f
# Affiche les logs en temps réel
```

Ouvre ton navigateur : **http://TON_VPS_IP** → le dashboard s'affiche ✅

---

## 📡 Configuration TradingView

### Étape 1 — Charger le script PineScript

1. Ouvre TradingView → Pine Editor (en bas de l'écran)
2. Colle le contenu du fichier `EMA_RSI_Forex_Strategy.pine`
3. Clique **"Ajouter au graphique"**
4. Sélectionne la paire souhaitée (ex: EURUSD) et timeframe H4

### Étape 2 — Créer l'alerte Webhook

Pour **chaque paire** que tu veux monitorer, crée une alerte :

1. Clic droit sur le graphique → **Ajouter une alerte**
2. **Condition** : sélectionne ton script → `"Tous les signaux"`
3. **Options** :
   - ✅ Alerte persistante (Une fois par barre à la clôture)
   - Expiration : Sans limite
4. **Webhook URL** : `http://TON_VPS_IP/webhook`
5. **Message** : laisser vide (le script envoie son propre JSON)
6. Clique **Créer**

### Étape 3 — Répéter pour toutes les paires

Répète l'étape 2 pour chaque paire :
```
EURUSD, GBPUSD, USDJPY, AUDUSD, USDCAD, USDCHF, NZDUSD
EURGBP, EURJPY, GBPJPY, AUDJPY, CADJPY, CHFJPY, EURAUD
EURCHF, EURCAD, GBPAUD, GBPCAD, GBPCHF, AUDCAD
```

> 💡 **Astuce** : Sur TradingView Pro+, tu peux avoir plusieurs alertes actives simultanément. Avec le plan gratuit, tu es limité à 1 alerte active.

---

## 📱 Format du message Telegram reçu

```
🟢 BUY — EURUSD 🔥
━━━━━━━━━━━━━━━━━━
⏱ Timeframe : 240min
💰 Entrée   : 1.08450
🛑 Stop Loss : 1.08200
🎯 Take Profit : 1.08950
📊 Probabilité : 82% — EXCELLENT
████████░░
🕐 20/03/2026 14:00:00
```

---

## 🔄 Commandes utiles

```bash
# Voir les logs du backend (webhooks reçus)
docker compose logs -f backend

# Voir les logs du frontend (nginx)
docker compose logs -f frontend

# Redémarrer après modification
docker compose restart

# Rebuild après changement de code
docker compose up -d --build

# Arrêter tout
docker compose down

# Vérifier que le webhook fonctionne
curl -X POST http://localhost:3001/webhook \
  -H "Content-Type: application/json" \
  -d '{"pair":"EURUSD","tf":"240","action":"BUY","price":1.08450,"sl":1.08200,"tp":1.08950,"prob":82,"quality":"EXCELLENT"}'
```

---

## 🔒 Sécurisation (optionnel mais recommandé)

### Ajouter HTTPS avec Certbot

```bash
# Installer certbot sur le VPS
apt install certbot python3-certbot-nginx -y

# Obtenir un certificat SSL (remplace par ton domaine)
certbot --nginx -d mon-domaine.com

# TradingView requiert HTTPS pour les webhooks en production
# URL webhook : https://mon-domaine.com/webhook
```

### Ajouter un token secret au webhook

Dans le fichier `.env`, ajoute :
```
WEBHOOK_SECRET=un_secret_difficile_a_deviner
```

Dans `backend/server.js`, décommente la vérification :
```js
// Vérification du secret
const secret = req.headers['x-webhook-token']
if (process.env.WEBHOOK_SECRET && secret !== process.env.WEBHOOK_SECRET) {
  return res.status(401).json({ error: 'Non autorisé' })
}
```

Dans TradingView, ajoute dans les headers de l'alerte :
```
x-webhook-token: un_secret_difficile_a_deviner
```

---

## 🐛 Dépannage

| Problème | Solution |
|---|---|
| Dashboard vide | Vérifier que `docker compose ps` montre les 2 services UP |
| Pas de signal reçu | Tester avec `curl` (voir commandes utiles) |
| Telegram silencieux | Vérifier TOKEN et CHATID dans `.env` + `docker compose logs backend` |
| WebSocket "Déconnecté" | Vérifier que le port 80 est ouvert sur le firewall du VPS |
| Erreur nginx 502 | Le backend n'est pas encore démarré — attendre 10s et recharger |

---

## 📁 Structure du projet

```
forex-dashboard/
├── docker-compose.yml          # Orchestration Docker
├── .env.example                # Template variables d'environnement
├── .env                        # Tes vraies valeurs (ne pas committer)
│
├── backend/
│   ├── server.js               # Webhook + WebSocket + Telegram
│   ├── package.json
│   └── Dockerfile
│
└── frontend/
    ├── src/
    │   ├── App.jsx             # Composant principal + WebSocket client
    │   ├── App.css             # Styles globaux
    │   └── components/
    │       ├── PairTile.jsx    # Tuile d'une paire (mosaïque)
    │       ├── PairTile.css
    │       ├── SignalHistory.jsx # Tableau historique des signaux
    │       └── SignalHistory.css
    ├── index.html
    ├── vite.config.js
    ├── nginx.conf              # Config nginx production
    ├── package.json
    └── Dockerfile
```

---

*Forex Signal Dashboard · Triple EMA + RSI v2.0 · Documentation v1.0*
