---
name: geo-dispatch
description: Use when writing or changing distance calculations, driver search, or dispatch strategies in Fleet Pulse.
---

# Geo & Dispatch Rules for Fleet Pulse

## 1. Distance & Coordinate Calculations
- All distances are in kilometers. Mean Earth radius is 6371 km.
- Convert degrees to radians once inside the shared haversine function.
- Never duplicate the formula anywhere; always import `haversineKm` from `@fleet-pulse/shared`.
- Include input validation for latitude (-90 to 90) and longitude (-180 to 180).
- Handle edge cases:
  - Same point returns `0` km.
  - Antipodal points return `~20015` km (pi * 6371).
  - Proper handling of coordinate boundaries, dateline crossing, and poles.
- ETA calculations must use `etaMinutes(distanceKm, avgSpeedKmh)` from `@fleet-pulse/shared`.

## 2. Dispatch Strategy Interface
Every dispatch strategy must implement the standard contract:
```typescript
export interface DispatchStrategy {
  assign(
    request: DeliveryRequest,
    candidates: Driver[],
    context?: DispatchContext
  ): Assignment | null;
}
```

The three required strategies are:
1. **NearestDriverStrategy**:
   - Computes distance to available drivers using `haversineKm`.
   - Filters only drivers with `status === 'available'`.
   - Assigns to the closest driver.
2. **ScoredStrategy**:
   - Computes weighted score based on configurable weights: distance, rating, idle time, daily trips fairness.
   - For busy drivers near completion, considers estimated time-until-free.
3. **BatchStrategy**:
   - Accumulates requests in a configurable window (`BATCH_WINDOW_SECONDS`, default 5s).
   - Solves multi-driver multi-request assignment globally with the Hungarian algorithm to minimize total combined distance.

A `StrategyRegistry` allows selecting the active strategy via `DISPATCH_STRATEGY` environment variable or API.

## 3. Atomic Assignment & Locking
- Driver assignment must be strictly atomic to guarantee zero double-assignments.
- Flow:
  1. Acquire Redis distributed lock `lock:driver:<driverId>` with a short TTL (e.g., 5 seconds).
  2. Execute a conditional SQL UPDATE:
     `UPDATE "Driver" SET status = 'busy', "activeRequestId" = :requestId WHERE id = :driverId AND status = 'available';`
  3. If update affects 0 rows, release lock and proceed to next candidate.
  4. Write every dispatch decision to `DispatchEvent` table for audit, replay, and analytics.

## 4. Redis GEO vs PostGIS
- **Hot path**: Driver location updates write immediately to Redis GEO key `drivers:geo` via `GEOADD`.
- **Nearby queries**: `GET /drivers/nearby` queries `GEORADIUS_RO_WITH_MATCH_` / `GEOSEARCH` in Redis GEO.
- **Persistence & Fallback**: Driver location flushes to PostgreSQL in batches. PostGIS `ST_DWithin` with GiST index serves as fallback and for historical queries.

## 5. Testing Requirements
- Test with known city pairs:
  - Bengaluru (12.9716, 77.5946) to Chennai (13.0827, 80.2707) is ~290 km straight line.
- Concurrency test: 100 simultaneous requests fired at 10 drivers must assert no driver is double-assigned.
