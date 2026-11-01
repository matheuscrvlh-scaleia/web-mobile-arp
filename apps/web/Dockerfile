# syntax=docker/dockerfile:1.7
# Build a partir da raiz do monorepo: docker build -f apps/web/Dockerfile .

FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/contracts/package.json packages/contracts/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN --mount=type=cache,target=/root/.npm npm ci --workspace @arp/web --no-audit --no-fund
COPY packages/contracts packages/contracts
COPY apps/web apps/web
RUN npm run build -w @arp/web

FROM nginx:1.27-alpine AS runtime
# O template vira /etc/nginx/conf.d/default.conf com envsubst na subida.
ENV API_HOST=api:3000
COPY apps/web/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=15s --timeout=3s --retries=3 \
  CMD wget -qO- http://127.0.0.1/healthz >/dev/null || exit 1
