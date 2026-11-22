# Fleet Pulse: High-Concurrency Fleet Simulator (M6)

## Overview
The Fleet Pulse Simulator simulates a live urban delivery fleet operating across the Bengaluru metropolitan area. It generates realistic driver movement physics, authentic delivery requests from weighted demand hotspots, and automated Socket.IO driver responses with configurable accept probabilities and reaction delays.

The simulator interacts exclusively with the public HTTP and Socket.IO interfaces, ensuring realistic end-to-end integration with the dispatch engine, Redis GEO hot path, and BullMQ cascade queue.

---

## Architecture & Features

### 1. Seeded PRNG (Mulberry32)
- Fast, 32-bit deterministic pseudo-random number generator (`SeededPRNG`).
- Guarantees 100% reproducible test and simulation runs given the same seed.
- Supports uniform floats `[0, 1)`, ranges `[min, max)`, integer ranges `[min, max]`, and probabilistic choices (`chance(p)`).

### 2. Bengaluru Geography & Hotspots
- **Bounding Box**:
  - Latitude: `12.834` to `13.144`
  - Longitude: `77.460` to `77.744`
- **10 Weighted Commercial & Residential Hotspots**:
  - Koramangala (1.5), Indiranagar (1.5), MG Road (1.4), Bellandur (1.3), Whitefield (1.2), HSR Layout (1.2), Hebbal (1.1), Electronic City (1.0), Malleshwaram (1.0), Jayanagar (1.0).

### 3. Driver Physics & Trip Lifecycle
- **Wandering State (`available`)**:
  - Wanders at 25–45 km/h with random heading drift (-15° to +15°).
  - Bounces 180° upon reaching city boundaries.
  - Broadcasts location via hot-path Redis GEO and throttled Socket.IO.
- **Active Trip State (`busy`)**:
  - `to_pickup`: Heads towards customer pickup location using spherical bearing calculations.
  - Upon arrival (< 50m): Transitions request status to `picked_up` and switches target to dropoff.
  - `to_dropoff`: Navigates to delivery destination.
  - Upon arrival (< 50m): Transitions request status to `delivered`, marks driver `available` in PostgreSQL, resets active request ID, and increments `dailyTrips`.

### 4. High-Concurrency Conflict Avoidance
- **`drivers:pending_offers` Redis Set**:
  - Tracks drivers with an active offer countdown.
  - Guarantees that concurrent requests dispatched milliseconds apart select distinct drivers, eliminating offer starvation and race conditions.

---

## Interfaces

### 1. CLI Runner
Run from workspace root or `apps/api`:
```bash
# Default: 100 drivers, 10x speed multiplier, 5 minutes duration
pnpm run sim

# Custom parameters
pnpm run sim --drivers=100 --multiplier=10 --duration=300 --rate=20 --accept=0.8 --seed=42
```

**CLI Flags**:
- `--drivers`: Number of driver agents to spawn (default: 100)
- `--multiplier`: Speed multiplier between 1x and 20x (default: 10)
- `--duration`: Total simulation runtime in seconds (default: 300)
- `--rate`: Delivery request generation rate in req/min (default: 20)
- `--accept`: Driver acceptance probability between 0.0 and 1.0 (default: 0.8)
- `--seed`: PRNG seed for reproducible runs (default: 42)

### 2. Admin REST API (`/api/v1/sim`)
- `POST /api/v1/sim/start`: Starts simulation with configuration JSON body.
- `POST /api/v1/sim/stop`: Stops the running simulation and disconnects agent sockets.
- `GET /api/v1/sim/status`: Returns live status, active trips, and double assignment audit.

---

## Verification & Double Assignment Audit
The simulation continuously audits active trips across all agents:
```typescript
doubleAssignmentsDetected = 0; // Audited on every status tick and final report
```
Zero double assignments are guaranteed by the atomic PostgreSQL conditional assignment (`WHERE status = 'available'`) and Redis distributed locks.
