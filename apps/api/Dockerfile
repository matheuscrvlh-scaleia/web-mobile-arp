# syntax=docker/dockerfile:1.7
# Build a partir da raiz do monorepo: docker build -f apps/api/Dockerfile .

FROM node:22-alpine AS base
WORKDIR /app

# Manifestos de todos os workspaces: o npm ci confere o lockfile com eles.
FROM base AS manifests
COPY package.json package-lock.json ./
COPY packages/contracts/package.json packages/contracts/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/

FROM manifests AS build
RUN --mount=type=cache,target=/root/.npm npm ci --workspace @arp/api --no-audit --no-fund
COPY tsconfig.base.json ./
COPY packages/contracts packages/contracts
COPY apps/api apps/api
RUN npm run build -w @arp/api

# Só dependências de produção (o @arp/contracts já está dentro do bundle).
FROM manifests AS prod-deps
RUN --mount=type=cache,target=/root/.npm \
  npm ci --workspace @arp/api --omit=dev --no-audit --no-fund

FROM node:22-alpine AS runtime
RUN apk add --no-cache tini
WORKDIR /app
ENV NODE_ENV=production \
  HOST=0.0.0.0 \
  PORT=3000 \
  MIGRATIONS_DIR=/app/supabase/migrations \
  SEED_ASSETS_DIR=/app/seed-assets \
  STORAGE_LOCAL_DIR=/app/storage/uploads
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/apps/api/dist ./dist
COPY supabase/migrations ./supabase/migrations
COPY apps/api/seed-assets ./seed-assets
RUN mkdir -p storage/uploads && chown -R node:node storage
USER node
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=3s --start-period=30s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/health/live >/dev/null || exit 1
# tini repassa SIGTERM ao node: o graceful shutdown fecha conexões e jobs.
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "--enable-source-maps", "dist/main.js"]
