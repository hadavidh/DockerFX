# ── Étape 1 : Build React ──────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json .
RUN npm install
COPY . .
# Variables d'environnement build-time
# Le frontend se connecte via le même host (nginx proxy → backend)
ENV VITE_WS_URL=""
ENV VITE_API_BASE=""
RUN npm run build

# ── Étape 2 : Servir avec Nginx ────────────────────────────
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
