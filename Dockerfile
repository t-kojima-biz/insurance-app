# syntax=docker/dockerfile:1

# =============================================================================
# Insurance App - Vite + React + TypeScript
# Multi-stage build for development and production
# =============================================================================

ARG NODE_VERSION=22
ARG APP_PORT=3000
ARG APP_PATH=insurance

# =============================================================================
# Base
# =============================================================================
FROM node:${NODE_VERSION}-alpine AS base
RUN apk upgrade --no-cache && \
    apk add --no-cache libc6-compat python3 make g++
WORKDIR /app

# =============================================================================
# Dependencies
# =============================================================================
FROM base AS deps
COPY package.json package-lock.json ./
RUN --mount=type=cache,id=npm-store-insurance,target=/root/.npm \
    npm ci

# =============================================================================
# Development - hot reload
# =============================================================================
FROM deps AS dev
ARG APP_PORT
ARG API_PORT=3021
ENV NODE_ENV=development TZ=Asia/Tokyo APP_PORT=${APP_PORT} API_PORT=${API_PORT} DATABASE_PATH=/app/data/insurance.sqlite
COPY . .
EXPOSE ${APP_PORT} ${API_PORT}
CMD npm run dev:all

# =============================================================================
# Builder - production build
# =============================================================================
FROM deps AS builder
ARG NODE_OPTIONS="--max-old-space-size=4096"
ENV NODE_ENV=production NODE_OPTIONS=${NODE_OPTIONS}
COPY . .
RUN npm run build

# =============================================================================
# Production - nginx serving static files
# =============================================================================
FROM nginx:1.27-alpine AS runner

ARG APP_PORT
ARG APP_PATH
ARG APP_TITLE="Insurance App"
ARG APP_DESCRIPTION="保険管理アプリケーション"

RUN apk upgrade --no-cache
ENV TZ=Asia/Tokyo

LABEL org.opencontainers.image.title="${APP_TITLE}" \
      org.opencontainers.image.description="${APP_DESCRIPTION}"

COPY <<'EOF' /etc/nginx/nginx.conf
worker_processes auto;

error_log /var/log/nginx/error.log notice;
pid       /var/run/nginx.pid;

events {
    worker_connections 1024;
}

http {
    include      /etc/nginx/mime.types;
    default_type application/octet-stream;

    log_format main '$remote_addr - $remote_user [$time_local] "$request"'
                    '$status $body_bytes_sent "$http_referer"'
                    '"$http_user_agent"';

    access_log /var/log/nginx/access.log main;

    sendfile   on;
    tcp_nopush on;

    keepalive_timeout 65;

    include /etc/nginx/conf.d/*.conf;
}
EOF

COPY <<'EOF' /etc/nginx/snippets/security-headers.conf
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;
EOF

COPY <<'TEMPLATE' /tmp/nginx-site.template
server {
    listen __APP_PORT__;
    listen [::]:__APP_PORT__;
    server_name localhost;
    root /usr/share/nginx/html;

    server_tokens off;

    include /etc/nginx/snippets/security-headers.conf;

    location /__APP_PATH__/ {
        try_files $uri $uri/ /__APP_PATH__/index.html;

        location = /__APP_PATH__/index.html {
            include /etc/nginx/snippets/security-headers.conf;
            add_header Cache-Control "no-cache" always;
        }
    }

    location = / {
        return 301 /__APP_PATH__/;
    }

    location /__APP_PATH__/assets/ {
        include /etc/nginx/snippets/security-headers.conf;
        expires 1y;
        add_header Cache-Control "public, immutable" always;
        access_log off;
    }

    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types
        text/plain
        text/css
        text/xml
        text/javascript
        application/json
        application/javascript
        application/xml
        image/svg+xml
        font/woff;
}
TEMPLATE
RUN sed "s/__APP_PORT__/${APP_PORT}/g; s/__APP_PATH__/${APP_PATH}/g" \
    /tmp/nginx-site.template > /etc/nginx/conf.d/default.conf && \
    rm /tmp/nginx-site.template

COPY --link --chown=101:101 --from=builder /app/dist /usr/share/nginx/html/${APP_PATH}

RUN rm -f /usr/share/nginx/html/index.html /usr/share/nginx/html/50x.html && \
    chown -R nginx:nginx /var/cache/nginx /var/log/nginx && \
    touch /var/run/nginx.pid && \
    chown nginx:nginx /var/run/nginx.pid

USER nginx

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:${APP_PORT}/${APP_PATH}/ || exit 1

STOPSIGNAL SIGQUIT

EXPOSE ${APP_PORT}
CMD ["nginx", "-g", "daemon off;"]
