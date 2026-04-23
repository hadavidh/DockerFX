# ────────────────────────────────────────────────────────────────
# frontend/Dockerfile
# ────────────────────────────────────────────────────────────────

FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
ARG VITE_APP_VERSION=dev
ENV VITE_APP_VERSION=$VITE_APP_VERSION
RUN npm run build

FROM nginx:alpine AS production

ARG NGINX_CONF=nginx.conf

RUN rm /etc/nginx/conf.d/default.conf

COPY ${NGINX_CONF} /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80 443

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget --no-check-certificate -qO- https://127.0.0.1/ >/dev/null 2>&1 || exit 1

CMD ["nginx", "-g", "daemon off;"]
