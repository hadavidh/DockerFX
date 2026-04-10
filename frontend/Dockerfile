# ════════════════════════════════════════════════════════════════
# frontend/Dockerfile — Multi-stage build (CORRIGÉ)
# ════════════════════════════════════════════════════════════════
 
# ── Stage 1 : Builder React ───────────────────────────────────────
FROM node:20-alpine AS builder
 
WORKDIR /app
 
COPY package*.json ./
RUN npm ci
 
COPY . .
 
# Vite copie automatiquement public/ dans dist/ lors du build
RUN npm run build
 
# ── Stage 2 : Nginx ───────────────────────────────────────────────
FROM nginx:alpine AS production
 
RUN rm /etc/nginx/conf.d/default.conf
 
COPY nginx.conf /etc/nginx/conf.d/default.conf
 
# dist/ contient déjà tout (fichiers React + assets public/)
COPY --from=builder /app/dist /usr/share/nginx/html
 
EXPOSE 80
 
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget -qO- http://localhost/health || exit 1
 
CMD ["nginx", "-g", "daemon off;"]