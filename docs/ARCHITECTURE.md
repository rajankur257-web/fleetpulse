# Fleet Pulse Architecture

Fleet Pulse is a real-time delivery dispatch platform designed with a clean microservices-ready monolithic architecture. One unified NestJS backend serves three distinct clients, supported by Redis for fast geospatial and ephemeral state, and PostgreSQL with PostGIS for reliable transactional persistence and historical analysis.

## System Architecture Diagram

```mermaid
flowchart TD
    subgraph Clients["Clients"]
        DriverApp["Mobile Driver App\n(Expo + Expo Router)"]
        WebDashboard["Dispatcher Web Dashboard\n(Next.js App Router + MapLibre)"]
        Simulator["Fleet Simulator & Customer API\n(NestJS CLI / Public REST & Sockets)"]
    end

    subgraph API["NestJS API (Unified Persistent Container)"]
        Auth["Auth & Roles\nJWT, Argon2, Role Guards"]
        DriversRequests["Drivers + Requests API\nValidated DTOs, Swagger, CRUD"]
        RealtimeGateway["Realtime Gateway\nSocket.IO rooms per role, throttled events"]
        DispatchEngine["Dispatch Engine\nNearest, Scored, Batch (Hungarian)"]
        OfferCascade["Offer Cascade (BullMQ)\nOffer, wait, cascade, retry, expiry"]
        AnalyticsSim["Analytics + Simulator Service\nHeatmap, dead zones, replay, metrics"]
    end

    subgraph Storage["Backing Infrastructure"]
        Redis["Redis 7\n- GEO driver locations (drivers:geo)\n- Distributed locks (lock:driver:<id>)\n- BullMQ queues (offers)"]
        Postgres["PostgreSQL + PostGIS\n- Spatial GiST indexes\n- Relational tables\n- DispatchEvent historical ledger"]
        OSRM["OSRM (Road ETA)\nRoad network routing vs Haversine fallback"]
    end

    DriverApp <-->|REST /api/v1 & Socket.IO| RealtimeGateway
    WebDashboard <-->|REST /api/v1 & Socket.IO| RealtimeGateway
    Simulator <-->|REST /api/v1 & Socket.IO| RealtimeGateway

    RealtimeGateway --> DriversRequests
    DriversRequests --> DispatchEngine
    DispatchEngine --> OfferCascade

    DriversRequests <--> Redis
    DispatchEngine <--> Redis
    OfferCascade <--> Redis
    DriversRequests <--> Postgres
    AnalyticsSim <--> Postgres
    AnalyticsSim <--> OSRM
```

## Core Components
1. **Clients**:
   - **Driver App**: Mobile application built with React Native and Expo Router. Handles live GPS tracking, offer countdown alerts, and trip status transitions.
   - **Dispatcher Web Dashboard**: Real-time operations map built with Next.js App Router, MapLibre GL JS, and OpenStreetMap tiles. Displays vehicle pins, queues, and dispatch analytics.
   - **Simulator & Customer API**: Generates realistic simulated driver movement and automated customer order traffic to stress-test dispatch algorithms.
2. **NestJS API Service**:
   - Runs as a persistent Docker container ensuring continuous WebSocket availability and background queue processing.
3. **Storage & Engines**:
   - **Redis**: High-throughput hot path for GPS coordinate indexing (`GEOADD`/`GEORADIUS`), atomic locks, and BullMQ worker queues.
   - **PostgreSQL + PostGIS**: Cold path relational store with spatial geography indexing (`ST_DWithin` on GiST index) and event sourcing ledger.
   - **OSRM**: Real road-network distance and routing computation with automatic fallback to Haversine straight-line distance.
