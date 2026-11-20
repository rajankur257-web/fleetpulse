# Fleet Pulse - GitHub Copilot Instructions

Follow the single source of truth defined in [AGENTS.md](../AGENTS.md).

Key guidelines:
- Monorepo: pnpm workspaces + Turborepo (apps/api, apps/web, apps/mobile, packages/shared)
- Distances use the Haversine formula from `@fleet-pulse/shared` only. Never duplicate.
- Driver assignment must be atomic (Redis lock `lock:driver:<id>` + conditional SQL UPDATE).
- All dispatch strategies implement `DispatchStrategy` (nearest, scored, batch).
- TypeScript strict mode: no `any` without an explanatory comment.
- Validate every input using DTOs/zod schemas. Range check coordinates (lat -90..90, lng -180..180).
- Write tests first for geo and dispatch logic.
