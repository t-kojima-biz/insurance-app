# syntax=docker/dockerfile:1

# =============================================================================
# Insurance App - Next.js + SQLite
# Multi-stage build for development and production
# =============================================================================

ARG NODE_VERSION=22
ARG APP_PORT=3020

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
ENV NODE_ENV=development TZ=Asia/Tokyo DATABASE_PATH=/app/data/insurance.sqlite
COPY . .
EXPOSE ${APP_PORT}
CMD ["npm", "run", "dev"]

# =============================================================================
# Builder - production build
# =============================================================================
FROM deps AS builder
ARG NODE_OPTIONS="--max-old-space-size=4096"
ENV NODE_ENV=production NODE_OPTIONS=${NODE_OPTIONS}
COPY . .
RUN npm run build

# =============================================================================
# Production - Next.js standalone server
# =============================================================================
FROM node:${NODE_VERSION}-alpine AS runner

ARG APP_PORT

RUN apk upgrade --no-cache
ENV NODE_ENV=production TZ=Asia/Tokyo PORT=${APP_PORT} HOSTNAME=0.0.0.0 DATABASE_PATH=/app/data/insurance.sqlite

WORKDIR /app

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/.next/standalone ./

RUN mkdir -p /app/data && chown -R node:node /app/data

USER node

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:${APP_PORT}/api/health || exit 1

EXPOSE ${APP_PORT}
CMD ["node", "server.js"]
