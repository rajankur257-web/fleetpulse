# Stage 1: Base image
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

# Stage 2: Dependencies & Builder
FROM base AS builder
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json .npmrc* ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY apps/mobile/package.json ./apps/mobile/

RUN pnpm install --no-frozen-lockfile

COPY packages/shared ./packages/shared
RUN pnpm --filter @fleet-pulse/shared build

COPY apps/api ./apps/api
RUN cd apps/api && npx prisma generate
RUN pnpm --filter @fleet-pulse/api build

# Stage 3: Runner (Production, Non-root user)
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Install security tools: dumb-init for proper PID 1 signal forwarding and wget for healthchecks
RUN apk add --no-cache dumb-init wget \
  && addgroup -S appgroup -g 1001 \
  && adduser -S appuser -u 1001 -G appgroup

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json .npmrc* ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/
COPY apps/api/prisma ./apps/api/prisma

RUN pnpm install --prod --no-frozen-lockfile
RUN cd apps/api && npx --yes prisma@6.2.1 generate

COPY --from=builder --chown=appuser:appgroup /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder --chown=appuser:appgroup /app/apps/api/dist ./apps/api/dist

# Copy release entrypoint script
COPY --chown=appuser:appgroup apps/api/docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh
RUN chown -R appuser:appgroup /app

USER appuser

EXPOSE 4000

# Healthcheck probe using liveness endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:4000/api/v1/health/live || exit 1

ENTRYPOINT ["/usr/bin/dumb-init", "--", "/app/docker-entrypoint.sh"]
CMD ["node", "apps/api/dist/main.js"]
