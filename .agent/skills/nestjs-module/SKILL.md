---
name: nestjs-module
description: Use when creating or modifying NestJS modules, controllers, services, DTOs, or API endpoints in Fleet Pulse.
---

# NestJS Module Conventions for Fleet Pulse

## 1. Directory & File Layout
Each feature module in `apps/api/src/modules/<feature>/` must follow this structure:
```text
modules/<feature>/
├── <feature>.module.ts
├── <feature>.controller.ts
├── <feature>.service.ts
├── dto/
│   ├── create-<feature>.dto.ts
│   ├── update-<feature>.dto.ts
│   └── query-<feature>.dto.ts
├── entities/ or interfaces/
└── tests/
    ├── <feature>.service.spec.ts
    └── <feature>.controller.spec.ts
```

## 2. DTO & Input Validation
- Always use `class-validator` and `class-transformer` decorators on DTO fields.
- Coordinate validation is mandatory on all geo endpoints:
  - Latitude: `@IsLatitude()`, `@Min(-90)`, `@Max(90)`
  - Longitude: `@IsLongitude()`, `@Min(-180)`, `@Max(180)`
- Never trust client-supplied status without enum validation (`@IsEnum(...)`).
- Use `@Type(() => Number)` / `@Type(() => Date)` for explicit casting in query DTOs.
- Always enable `ValidationPipe` with `whitelist: true`, `forbidNonWhitelisted: true`, `transform: true`.

## 3. Swagger Documentation
- Decorate controllers with `@ApiTags('<feature>')`.
- Decorate endpoints with `@ApiOperation({ summary: '...' })`, `@ApiResponse({ status: 200, ... })`, `@ApiBearerAuth()`.
- Decorate DTO properties with `@ApiProperty()` / `@ApiPropertyOptional()`.
- Swagger UI must be served at `/docs`.

## 4. Routing, Auth & Error Handling
- All REST endpoints must reside under `/api/v1`.
- Authentication: JWT Bearer auth on all endpoints except login and health checks.
- Roles: Use `@Roles(Role.Admin, Role.Dispatcher, Role.Driver)` and role guards.
- Exception Handling: All unhandled errors must flow through the global `AllExceptionsFilter` to produce standard JSON responses:
  ```json
  {
    "statusCode": 400,
    "timestamp": "2026-11-19T21:49:12.000Z",
    "path": "/api/v1/...",
    "message": "Error message"
  }
  ```
- Structured logging: Use `nestjs-pino` for request and operational logs.
- Startup validation: Validate all required environment variables at application boot using `@nestjs/config` and zod/class-validator.
