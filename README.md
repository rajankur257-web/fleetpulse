# Fleet Pulse

Fleet Pulse is a high-performance, real-time delivery dispatch platform. It matches delivery requests with the optimal available drivers using pluggable dispatch strategies, powers live dispatcher monitoring on interactive maps, and coordinates driver actions via a mobile client.

## Architecture Highlights
- **Monorepo**: pnpm workspaces + Turborepo
- **API**: NestJS with Prisma, PostgreSQL + PostGIS, Redis GEO, BullMQ, and Socket.IO
- **Web Dashboard**: Next.js App Router, Tailwind CSS, shadcn/ui, MapLibre GL JS
- **Mobile Driver App**: React Native with Expo Router and background GPS tracking
- **Shared Core**: `@fleet-pulse/shared` containing Haversine formulas, validation schemas, and common types

---

## 5-Command Quick Start

```bash
# 1. Prepare environment variables
cp .env.example .env

# 2. Start PostgreSQL (PostGIS) and Redis backing services
docker compose up -d

# 3. Install all dependencies across monorepo
pnpm install

# 4. Run database migrations and seed sample data
pnpm --filter @fleet-pulse/api prisma migrate dev

# 5. Start all development servers
pnpm dev
```

---

## Workspace Layout
```text
fleet-pulse/
├── apps/
│   ├── api/        # NestJS REST & WebSocket API
│   ├── web/        # Next.js dispatcher dashboard
│   └── mobile/     # Expo React Native driver app
├── packages/
│   └── shared/     # Shared types, Zod schemas, Haversine utilities
├── docs/           # Architecture diagrams, API contracts, deployment guides
└── docker-compose.yml
```

## Useful Commands
- `pnpm build`: Build all workspaces
- `pnpm lint`: Run ESLint across monorepo
- `pnpm typecheck`: Run TypeScript type-checking across monorepo
- `pnpm test`: Execute unit and integration tests
