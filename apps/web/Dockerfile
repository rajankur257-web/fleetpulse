# Stage 1: Base image
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

# Stage 2: Dependencies & Builder
FROM base AS builder
WORKDIR /app

ARG NEXT_PUBLIC_API_URL=https://api-production-0a6663a9.up.railway.app/api/v1
ARG NEXT_PUBLIC_WS_URL=https://api-production-0a6663a9.up.railway.app
ARG NEXT_PUBLIC_DISPATCHER_TOKEN=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkaXNwYXRjaGVyLWFkbWluIiwicm9sZSI6ImRpc3BhdGNoZXIiLCJuYW1lIjoiTGVhZCBEaXNwYXRjaGVyIiwiaWF0IjoxNzk1NDIxODIzLCJleHAiOjE4MjY5NTc4MjN9.swnJfYIjn4B6iEbdqFHwqiWMsZTQ2N1FeA4Et3OpIkE

ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL
ENV NEXT_PUBLIC_DISPATCHER_TOKEN=$NEXT_PUBLIC_DISPATCHER_TOKEN

COPY package.json pnpm-lock.yaml turbo.json tsconfig.base.json .npmrc* ./
# Restrict workspace strictly to web and shared (omits apps/mobile with React 18)
RUN printf "packages:\n  - 'apps/web'\n  - 'packages/shared'\n" > pnpm-workspace.yaml

COPY packages/shared/package.json ./packages/shared/
COPY apps/web/package.json ./apps/web/

RUN pnpm install --no-frozen-lockfile

COPY packages/shared ./packages/shared
RUN pnpm --filter @fleet-pulse/shared build

COPY apps/web ./apps/web
RUN pnpm --filter @fleet-pulse/web build

# Stage 3: Runner
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

RUN apk add --no-cache dumb-init wget \
  && addgroup -S appgroup -g 1001 \
  && adduser -S appuser -u 1001 -G appgroup

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

COPY package.json pnpm-lock.yaml turbo.json .npmrc* ./
RUN printf "packages:\n  - 'apps/web'\n  - 'packages/shared'\n" > pnpm-workspace.yaml
COPY packages/shared/package.json ./packages/shared/
COPY apps/web/package.json ./apps/web/

RUN pnpm install --prod --no-frozen-lockfile

COPY --from=builder --chown=appuser:appgroup /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder --chown=appuser:appgroup /app/apps/web/.next ./apps/web/.next
COPY --from=builder --chown=appuser:appgroup /app/apps/web/public ./apps/web/public
COPY --from=builder --chown=appuser:appgroup /app/apps/web/next.config.js ./apps/web/next.config.js

RUN chown -R appuser:appgroup /app

USER appuser

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000/ || exit 1

ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["pnpm", "--filter", "@fleet-pulse/web", "start"]
