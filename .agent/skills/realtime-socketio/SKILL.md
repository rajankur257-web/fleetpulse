---
name: realtime-socketio
description: Use when implementing or updating WebSocket gateways, Socket.IO event handlers, offer cascade, and rooms in Fleet Pulse.
---

# Realtime Socket.IO & Offer Cascade Rules

## 1. Rooms & Connection Lifecycle
- **Authentication**: Validate JWT tokens during the handshake connection (`auth: { token }`). Reject unauthenticated sockets immediately.
- **Room Subscriptions**:
  - `dispatchers`: Web dispatchers join this room to observe fleet operations.
  - `driver:<id>`: Mobile driver clients join their private room on connection.
- **Disconnect Handling**:
  - If a driver disconnects while having a pending offer, treat it immediately as a rejection and cascade to the next best driver.
  - Update driver status if disconnected unexpectedly.

## 2. Event Contracts
All event payloads are strictly typed and imported from `@fleet-pulse/shared`:
- **Server -> `dispatchers` room**:
  - `driver:location`: `{ driverId, lat, lng, heading, speed, updatedAt }`
  - `driver:status`: `{ driverId, status, activeRequestId }`
  - `request:created`: `{ request }`
  - `request:offered`: `{ requestId, driverId, attempt, expiresAt }`
  - `request:assigned`: `{ requestId, driverId, assignedAt }`
  - `request:expired`: `{ requestId, reason }`
- **Server -> `driver:<id>` room**:
  - `request:offered`: `{ request, timeoutSeconds, expiresAt }`
  - `request:cancelled`: `{ requestId, reason }`

## 3. Throttling Location Broadcasts
- Drivers update locations rapidly; however, broadcasts to the `dispatchers` room must be throttled to **at most once per second per driver**.
- Store latest location in Redis GEO immediately (`GEOADD drivers:geo ...`).
- Throttle emission per driver ID to prevent socket congestion on dispatch dashboards.

## 4. BullMQ Offer Cascade Workflow
- Use BullMQ queue `offers` for dispatch cascades:
  1. Offer job created for best candidate driver with delay/timeout `OFFER_TIMEOUT_SECONDS` (default 20 seconds).
  2. Emit `request:offered` event to driver's room and dispatchers room.
  3. If driver accepts via `POST /offers/:id/accept`, cancel remaining timeout, atomically assign driver, transition request to `assigned`, and notify rooms.
  4. If driver rejects via `POST /offers/:id/reject`, or on timeout:
     - Check attempt counter.
     - If attempt < `MAX_OFFER_ATTEMPTS`: identify next best candidate and schedule next offer job.
     - If attempt >= `MAX_OFFER_ATTEMPTS`: update request status to `expired`, emit `request:expired`, and log alert.
  5. Clean up locks, pending jobs, and keys on completion or failure.
