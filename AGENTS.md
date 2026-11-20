# Fleet Pulse: AI Context (AGENTS.md)

## Product
Fleet Pulse is a real-time delivery dispatch platform. Customers create
delivery requests; the system assigns the best available driver using
pluggable dispatch strategies; dispatchers watch everything on a live map;
drivers use a mobile app.

## Core domain
- Driver: id, name, status (`available` | `busy` | `offline`), latitude,
  longitude, rating, lastLocationAt, activeRequestId.
- DeliveryRequest: id, pickupLat, pickupLng, dropLat, dropLng, status
  (`pending` | `offered` | `assigned` | `picked_up` | `delivered` | `cancelled`
  | `expired`), assignedDriverId, timestamps.
- Distances use the Haversine formula, in kilometers, from the shared package
  only.

## Stack (TypeScript everywhere, pin versions)
- Monorepo: pnpm workspaces + Turborepo.
- apps/api: NestJS, Prisma, PostgreSQL + PostGIS, Redis (GEO + locks),
  BullMQ, Socket.IO, class-validator, Swagger.
- apps/web: Next.js (App Router), Tailwind, shadcn/ui, MapLibre GL JS,
  OpenStreetMap tiles, TanStack Query.
- apps/mobile: React Native + Expo (Expo Router), expo-location, socket.io-client.
- packages/shared: types, zod schemas, `haversineKm`, constants.
- Tests: Vitest/Jest (unit), Supertest (API), Playwright (web E2E).
- Deploy: Docker for API, Vercel for web, EAS for mobile, Neon
  (Postgres+PostGIS), managed Redis.

## Folder structure
```text
fleet-pulse/
apps/api apps/web apps/mobile
packages/shared
docker-compose.yml turbo.json AGENTS.md
```

## Hard rules
1. Never duplicate the Haversine function; import it from `@fleet-pulse/shared`.
2. Driver assignment must be atomic: use a Redis lock or a single conditional
   UPDATE (`WHERE status = 'available'`). No double assignment, ever.
3. All dispatch strategies implement `DispatchStrategy` (nearest, scored,
   batch). Adding one must not change callers.
4. Validate every input (DTO/zod). Never trust client-sent driver status or
   coordinates without range checks (lat -90..90, lng -180..180).
5. No secrets in code. Read config from env, validated at startup. Provide
   `.env.example`.
6. Every module ships with tests. Dispatch and geo code need unit tests
   written first.
7. Use Context7 to check current library docs before using any API you are
   unsure about.
8. TypeScript strict mode. No `any` without a comment explaining why.
9. Small commits, conventional commit messages (feat:, fix:, test:, chore:).
10. Do not mark a task done until lint, typecheck, and tests pass.

## Commands
- `pnpm install`, `pnpm dev`, `pnpm build`, `pnpm lint`, `pnpm typecheck`,
  `pnpm test`
- `docker compose up -d` starts Postgres(PostGIS) and Redis
- `pnpm --filter api prisma migrate dev`

## Definition of done (per module)
Code + tests passing + docs updated in /docs + a short verification note
listing exactly what you ran.
