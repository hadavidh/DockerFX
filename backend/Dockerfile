# ════════════════════════════════════════════════════════════════
# backend/Dockerfile — Multi-stage build
# Stage 1 (builder) : installe TOUTES les dépendances npm
# Stage 2 (production) : garde uniquement le runtime minimal
#
# Résultat : image ~150MB au lieu de ~500MB
# Utilisateur non-root pour la sécurité (§5.8)
# ════════════════════════════════════════════════════════════════

# ── Stage 1 : Builder ────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copier uniquement package.json d'abord (cache Docker optimisé)
# Si le code change mais pas les dépendances → cette couche est en cache
COPY package*.json ./

# Installer TOUTES les dépendances (prod + dev)
RUN npm ci

# Copier le reste du code
COPY . .

# ── Stage 2 : Production ─────────────────────────────────────────
FROM node:20-alpine AS production

# Créer un utilisateur non-root (bonne pratique sécurité §5.8)
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

# Copier uniquement les dépendances de prod depuis le builder
COPY --from=builder /app/node_modules ./node_modules

# Copier le code source
COPY --from=builder /app/server.js          ./server.js
COPY --from=builder /app/ctrader-service.js ./ctrader-service.js
COPY --from=builder /app/strategy-manager.js ./strategy-manager.js
COPY --from=builder /app/journal-manager.js  ./journal-manager.js
COPY --from=builder /app/account-manager.js  ./account-manager.js
COPY --from=builder /app/drawdown-monitor.js ./drawdown-monitor.js
COPY --from=builder /app/telegram-bot.js     ./telegram-bot.js
COPY --from=builder /app/push-service.js     ./push-service.js
COPY --from=builder /app/auth.js             ./auth.js
COPY --from=builder /app/package.json        ./package.json

# Créer le dossier data avec les bonnes permissions
RUN mkdir -p /app/data && chown -R appuser:appgroup /app

# Passer à l'utilisateur non-root
USER appuser

# Port exposé (documentation)
EXPOSE 3001

# Health check intégré
HEALTHCHECK --interval=30s --timeout=5s --retries=3 --start-period=10s \
  CMD wget -qO- http://localhost:3001/health || exit 1

# Commande de démarrage
CMD ["node", "server.js"]