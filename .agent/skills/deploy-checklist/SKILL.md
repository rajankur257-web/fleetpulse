---
name: deploy-checklist
description: Use before, during, and after deploying Fleet Pulse API, Web dashboard, or Mobile apps to staging or production.
---

# Fleet Pulse Deployment & Production Checklist

## 1. Hosting Architecture Constraints
- **API Server**: MUST run on a persistent, long-lived host (Railway, Render, Fly.io, or dedicated VPS/Docker container).
  - *Warning*: Do NOT use serverless functions (AWS Lambda, Vercel Serverless) for the API because Socket.IO persistent connections and BullMQ queue workers require uninterrupted running processes.
- **Web Dashboard**: Deploy to Vercel or similar Next.js edge/Node hosting platform.
- **Database**: PostgreSQL with PostGIS extension enabled (Neon, Supabase, AWS RDS).
- **Redis**: Low-latency managed Redis instance (Upstash, Redis Cloud, Railway Redis) supporting GEO commands.
- **Mobile**: Expo Application Services (EAS Build) for preview APK and production release.

## 2. Environment Variables Verification
Check all required environment variables from `docs/CONTRACTS.md`:

### API (`apps/api`):
- `DATABASE_URL`: Connection string with PostGIS enabled
- `REDIS_URL`: Redis connection URL (`redis://...`)
- `JWT_SECRET`: High-entropy signing secret
- `JWT_REFRESH_SECRET`: High-entropy refresh token secret
- `CORS_ORIGINS`: Comma-separated list of allowed origins (e.g., `https://fleetpulse.vercel.app`)
- `DISPATCH_STRATEGY`: `nearest` | `scored` | `batch`
- `OFFER_TIMEOUT_SECONDS`: Default 20
- `MAX_OFFER_ATTEMPTS`: Default 3
- `BATCH_WINDOW_SECONDS`: Default 5
- `OSRM_URL`: Open Source Routing Machine endpoint (fallback to Haversine if omitted)

### Web (`apps/web`):
- `NEXT_PUBLIC_API_URL`: Fully qualified API URL (e.g., `https://api.fleetpulse.example.com/api/v1`)
- `NEXT_PUBLIC_SOCKET_URL`: WebSocket URL (e.g., `https://api.fleetpulse.example.com`)

### Mobile (`apps/mobile`):
- `EXPO_PUBLIC_API_URL`: Backend API base URL
- `EXPO_PUBLIC_SOCKET_URL`: Socket server URL

## 3. Pre-Flight Deploy Steps
1. **Docker Container**:
   - Multi-stage build with small base image (`node:20-alpine`).
   - Run as non-root user (`USER node`).
   - Include Docker `HEALTHCHECK` probing `GET /api/v1/health/live`.
2. **Database Migrations**:
   - Run `npx prisma migrate deploy` in the release phase or startup script.
   - Verify `CREATE EXTENSION IF NOT EXISTS postgis;` is applied.
3. **Graceful Shutdown**:
   - Handle `SIGTERM` and `SIGINT` signals to flush pending Redis operations, close BullMQ workers, and close database connection pools cleanly.

## 4. Post-Deployment Smoke Test
Verify production readiness with the following sequence:
1. Probe `/api/v1/health/live` and `/api/v1/health/ready` (expect HTTP 200).
2. Authenticate admin/dispatcher and confirm JWT token issue.
3. Trigger simulator (`POST /api/v1/sim/start` with 20 drivers and 10 requests).
4. Observe real-time driver movement and request assignments on the web dashboard map.
5. Validate database and Redis state: verify all 10 requests reached terminal state (`assigned`/`delivered`) with ZERO double-assignments.
