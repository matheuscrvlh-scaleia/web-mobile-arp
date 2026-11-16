# syntax=docker/dockerfile:1.7
# Build a partir desta pasta (apps/api): docker build .

FROM node:22-alpine AS manifests
WORKDIR /app
COPY package.json package-lock.json ./

FROM manifests AS build
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund
COPY tsconfig.json tsup.config.ts ./
COPY src src
RUN npm run build

# Só dependências de produção (o contrato em src/contracts já está no bundle).
FROM manifests AS prod-deps
RUN --mount=type=cache,target=/root/.npm npm ci --omit=dev --no-audit --no-fund

FROM node:22-alpine AS runtime
RUN apk add --no-cache tini
WORKDIR /app
ENV NODE_ENV=production \
  HOST=0.0.0.0 \
  PORT=3000 \
  MIGRATIONS_DIR=/app/migrations \
  STORAGE_LOCAL_DIR=/app/storage/uploads
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY migrations ./migrations
RUN mkdir -p storage/uploads && chown -R node:node storage
USER node
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=3s --start-period=30s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/health/live >/dev/null || exit 1
# tini repassa SIGTERM ao node: o graceful shutdown fecha conexões e jobs.
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "--enable-source-maps", "dist/main.js"]
