---
name: test-first
description: Use when writing or modifying algorithms, geo calculations, dispatch logic, or API endpoints in Fleet Pulse.
---

# Test-First Development Rules for Fleet Pulse

## 1. Principles
- **Red-Green-Refactor**: Always author failing test cases before writing implementation code for algorithms, shared libraries, and core business services.
- **Coverage Gate**: Dispatch engine strategies, geo calculation functions, and atomic locking must achieve 100% test branch coverage.

## 2. Testing Stack
- **Unit & Logic Tests**: Vitest or Jest in `packages/shared` and `apps/api`.
- **API E2E Tests**: Supertest testing all NestJS controllers with both valid inputs and intentionally malicious/malformed inputs.
- **Web Dashboard E2E**: Playwright verifying login, live map markers, socket updates, and order creation.

## 3. Required Test Cases

### Geo Calculations (`packages/shared`):
- `haversineKm`:
  - Same point coordinates return `0.0` km.
  - Known city pair: Bengaluru `[12.9716, 77.5946]` to Chennai `[13.0827, 80.2707]` must equal ~290 km (within +/- 2km tolerance).
  - Antipodal coordinates (opposite sides of earth) return ~20015 km.
  - Crossing International Date Line (e.g., longitude 179 to -179).
  - Geographic poles (lat 90, lat -90).
  - Invalid range rejection (lat > 90, lat < -90, lng > 180, lng < -180).
- `etaMinutes`:
  - Returns `Math.round((distanceKm / avgSpeedKmh) * 60)`.
  - Zero distance returns 0 minutes.
  - Zero/negative speed throws validation error or returns fallback.

### Dispatch Strategies (`apps/api`):
- **NearestDriverStrategy**: Correctly identifies closest idle driver among candidates.
- **ScoredStrategy**: Deterministically ranks drivers using distance, rating, idle duration, and fairness weights.
- **BatchStrategy**: Optimal bipartite matching minimizing total distance using Hungarian algorithm.

### Concurrency & Atomicity:
- Fire 100 concurrent assignment requests against 10 available drivers.
- Assert that exactly 10 requests get assigned and 90 remain queued/unassigned.
- Assert that **zero drivers** are assigned to more than one request simultaneously.
