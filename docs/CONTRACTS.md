# Fleet Pulse contracts (do not change without updating every consumer)

REST, all under /api/v1, JSON, JWT bearer auth except login and health
POST /auth/login | POST /auth/refresh
GET/POST /drivers | PATCH /drivers/:id/status | POST /drivers/:id/location
| GET /drivers/nearby?lat&lng&radiusKm
POST /requests | GET /requests | GET /requests/:id | POST
/requests/:id/cancel
POST /offers/:id/accept | POST /offers/:id/reject
GET /analytics/summary | GET /analytics/heatmap | GET /analytics/compare
POST /sim/start | POST /sim/stop
GET /health/live | GET /health/ready

Socket.IO events (payload types live in packages/shared)
server to dispatchers room: driver:location, driver:status,
request:created, request:offered, request:assigned, request:expired
server to driver:<id> room: request:offered, request:cancelled
rooms: dispatchers, driver:<id>

Redis keys
drivers:geo (GEO set of available and busy drivers)
lock:driver:<id> (assignment lock, short TTL)
BullMQ queue: offers

Status enums
Driver: available | busy | offline
Request: pending | offered | assigned | picked_up | delivered | cancelled |
expired

Env vars
API: DATABASE_URL, REDIS_URL, JWT_SECRET, JWT_REFRESH_SECRET, CORS_ORIGINS,
DISPATCH_STRATEGY, OFFER_TIMEOUT_SECONDS, MAX_OFFER_ATTEMPTS,
BATCH_WINDOW_SECONDS, OSRM_URL
Web: NEXT_PUBLIC_API_URL, NEXT_PUBLIC_SOCKET_URL
Mobile: EXPO_PUBLIC_API_URL
