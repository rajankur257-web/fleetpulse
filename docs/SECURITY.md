# Fleet Pulse: Authentication & Security Architecture (M10)

This document provides a comprehensive security review and architecture overview for Fleet Pulse, including cryptographic standards, role-based access control (RBAC), driver ownership isolation, anti-spoofing mitigations, and an in-depth self-review against the **OWASP API Security Top 10 (2023)**.

---

## 1. Authentication & Token Lifecycle

### 1.1 Password Hashing: Argon2id
Fleet Pulse uses the memory-hard **Argon2id** password hashing algorithm (RFC 9106), the winner of the Password Hashing Competition (PHC) and OWASP-recommended standard:
- **Algorithm**: `argon2id` (hybrid of Argon2d and Argon2i, protecting against GPU cracking and side-channel timing attacks)
- **Memory Cost ($m$)**: $65536 \text{ KiB}$ (64 MB per hash)
- **Time Cost ($t$)**: $3 \text{ iterations}$
- **Salt**: 16 cryptographically secure random bytes generated per hash

### 1.2 Dual-Token Architecture
1. **Access Token**:
   - **Type**: Signed JWT (`HS256`)
   - **Lifespan**: 1 hour (`1h`)
   - **Payload**: `{ sub: userId, email, role: 'admin' | 'dispatcher' | 'driver', driverId?: string }`
   - **Usage**: Sent as `Authorization: Bearer <token>` on protected REST and WebSocket handshake requests.
2. **Refresh Token**:
   - **Type**: Cryptographically signed refresh JWT with dedicated secret `JWT_REFRESH_SECRET`
   - **Lifespan**: 7 days (`7d`)
   - **Endpoint**: `POST /api/v1/auth/refresh` exchanges a valid refresh token for a newly minted access token and rotated refresh token.

---

## 2. Authorization & RBAC Matrix

Fleet Pulse defines three core roles: `admin`, `dispatcher`, and `driver`. Guard enforcement is performed via `JwtAuthGuard`, `RolesGuard`, and `DriverOwnershipGuard`.

| Resource / Route | Method | Admin | Dispatcher | Driver | Unauthenticated |
| :--- | :---: | :---: | :---: | :---: | :---: |
| `/api/v1/auth/register` | `POST` | Allowed | Allowed | Allowed | Allowed |
| `/api/v1/auth/login` | `POST` | Allowed | Allowed | Allowed | Allowed (Rate limited) |
| `/api/v1/auth/refresh` | `POST` | Allowed | Allowed | Allowed | Allowed |
| `/api/v1/auth/me` | `GET` | Allowed | Allowed | Allowed | 401 Unauthorized |
| `/api/v1/auth/admin-only` | `GET` | **Allowed** | **403 Forbidden** | **403 Forbidden** | 401 Unauthorized |
| `/api/v1/auth/dispatcher-only`| `GET` | **Allowed** | **Allowed** | **403 Forbidden** | 401 Unauthorized |
| `/api/v1/auth/driver-only` | `GET` | **403 Forbidden**| **403 Forbidden**| **Allowed** | 401 Unauthorized |
| `/api/v1/drivers/:id/status` | `PATCH`| **Any Driver** | **Any Driver** | **Own Driver Only** | 401 Unauthorized |
| `/api/v1/drivers/:id/location`| `POST` | **Any Driver** | **Any Driver** | **Own Driver Only** | 401 Unauthorized |
| `/api/v1/sim/start`, `/stop` | `POST` | **Allowed** | **403 Forbidden** | **403 Forbidden** | 401 Unauthorized |

---

## 3. Driver Ownership Isolation & Anti-Spoofing

### 3.1 Driver Ownership Guard (`DriverOwnershipGuard`)
To protect against Broken Object Level Authorization (BOLA), drivers can strictly only update their own status and location:
- When a driver authenticates, their token contains their bound `driverId`.
- The `DriverOwnershipGuard` inspects `request.user`:
  ```typescript
  if (user.role === UserRole.DRIVER) {
    if (!user.driverId || user.driverId !== targetDriverId) {
      throw new ForbiddenException(
        `Forbidden: You can only modify your own driver records (target: ${targetDriverId}, your driverId: ${user.driverId})`,
      );
    }
  }
  ```
- **Driver A attempting to update Driver B**: Immediately rejected with `403 Forbidden`.
- **Admin and Dispatcher**: Permitted to update any driver.

### 3.2 Anti-Spoofing Velocity & Jump Validation
In `DriversService.updateLocation`:
1. **Geographic Coordinate Validation**:
   - Latitude strictly constrained to $[-90, 90]$.
   - Longitude strictly constrained to $[-180, 180]$.
   - Out-of-bounds coordinates return `400 Bad Request`.
2. **Velocity & Teleportation Detection**:
   - Consecutive pings are compared against the driver's last known position using `@fleet-pulse/shared` `haversineKm`.
   - Speed is calculated: $\text{speedKmh} = \frac{\text{distanceKm}}{\text{elapsedSeconds}} \times 3600$.
   - Any teleportation jump ($\text{speed} > 200 \text{ km/h}$ or $> 1 \text{ km in } < 5 \text{ seconds}$) is immediately rejected with `400 Bad Request`.

---

## 4. OWASP API Security Top 10 (2023) Self-Review

| OWASP Vulnerability | Risk Analysis | Fleet Pulse Mitigation | Status |
| :--- | :--- | :--- | :---: |
| **API1:2023 Broken Object Level Authorization (BOLA)** | Attackers exploit endpoints by manipulating the ID of an object. | `DriverOwnershipGuard` strictly validates that driver tokens match the target route param `id`. Drivers cannot modify other drivers' location or status. | **PASS** |
| **API2:2023 Broken Authentication** | Attackers compromise authentication tokens or credentials. | Argon2id password hashing (64MB memory cost). Short-lived JWT access tokens (1h) + 7-day refresh tokens. Brute-force rate limiting on `/auth/login` (10 req/min). | **PASS** |
| **API3:2023 Broken Object Property Level Authorization** | Exposure of unauthorized fields or mass assignment. | NestJS `ValidationPipe` with `whitelist: true` and `forbidNonWhitelisted: true`. Client cannot inject `role`, `passwordHash`, or system fields into DTOs. | **PASS** |
| **API4:2023 Unrestricted Resource Consumption** | Denial of service via payload flooding or unthrottled requests. | Global `@nestjs/throttler` (120 req/min), Express body-parser input size limits (`1mb`), Socket.IO location broadcast throttle (1/sec/driver), pagination on list queries. | **PASS** |
| **API5:2023 Broken Function Level Authorization (BFLA)** | Normal users invoking administrative functions. | `RolesGuard` and `@Roles(...)` metadata. Drivers cannot invoke admin simulation controls or dispatcher APIs; dispatchers cannot invoke admin controls. | **PASS** |
| **API6:2023 Unrestricted Access to Sensitive Business Flows** | Double driver assignment or race conditions under high concurrent demand. | Redis distributed lock (`lock:driver:<id>`) combined with atomic SQL conditional update (`WHERE status = 'available'`). Concurrency tests prove zero double assignments. | **PASS** |
| **API7:2023 Server Side Request Forgery (SSRF)** | Exploitation of internal network through URLs supplied by clients. | OSRM routing endpoint is loaded strictly from environment configuration (`OSRM_URL`) validated at startup. No user-supplied URLs are fetched. | **PASS** |
| **API8:2023 Security Misconfiguration** | Missing security headers, insecure CORS, or unvalidated secrets. | `helmet()` enabled for strict HTTP security headers (CSP, HSTS, X-Frame-Options). Strict CORS whitelisting from `CORS_ORIGINS`. Startup env validation via `validateEnv`. | **PASS** |
| **API9:2023 Improper Inventory Management** | Undocumented or zombie endpoints exposed. | Swagger OpenAPI documentation versioned at `/docs` and `/api/v1/docs`. Explicit route versioning with global prefix `/api/v1`. | **PASS** |
| **API10:2023 Unsafe Consumption of APIs** | Third-party service failure cascades into application outage. | OSRM road-routing client wrapped in a 2500ms timeout guard; gracefully falls back to spherical Haversine formula from `@fleet-pulse/shared` on failure or lag. | **PASS** |

---

## 5. Audit Logging of Admin Actions

Administrative and privileged operations are intercepted by `AdminAuditInterceptor` ([admin-audit.interceptor.ts](file:///Users/raj/fleetpulse/apps/api/src/common/interceptors/admin-audit.interceptor.ts)) and tagged with `@AuditAction(...)`:
- Logs structured JSON with fields:
  ```json
  {
    "audit": true,
    "action": "ACCESS_ADMIN_AREA",
    "actorId": "be6c0613-4eb0-4af5-b6f7-722c83dcd93a",
    "actorEmail": "admin@fleetpulse.com",
    "actorRole": "admin",
    "target": null,
    "ip": "127.0.0.1",
    "durationMs": 4,
    "timestamp": "2026-11-23T04:59:05.120Z",
    "status": "SUCCESS"
  }
  ```
- Easily ingested and monitored by structured logging platforms (Datadog, CloudWatch, ELK).

---

## 6. Verification Test Summary

The test suite in [apps/api/test/security.e2e-spec.ts](file:///Users/raj/fleetpulse/apps/api/test/security.e2e-spec.ts) confirms all security constraints:
- **Authentication Lifecycle**:
  - Rejects invalid credentials (401).
  - Validates Argon2id hashing and token issuance.
  - Verifies refresh token rotation and rejection of tampered tokens.
  - Requires Bearer token on `/auth/me`.
- **Role Isolation (RBAC)**:
  - Admin access to admin routes: `200 OK`.
  - Dispatcher access to admin routes: `403 Forbidden`.
  - Driver access to admin and dispatcher routes: `403 Forbidden`.
- **Driver Ownership Enforcement**:
  - Driver A updating Driver A: `200 OK`.
  - Driver A updating Driver B: `403 Forbidden` (`Forbidden: You can only modify your own driver records`).
  - Admin/Dispatcher updating Driver B: `200 OK`.
- **Anti-Spoofing & Velocity Validation**:
  - Teleportation jump (25 km in 0 seconds): `400 Bad Request` (`Teleportation / unrealistic velocity jump detected`).
  - Coordinate out-of-bounds ($lat > 90$, $lng > 180$): `400 Bad Request`.
