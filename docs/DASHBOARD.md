# Fleet Pulse: Dispatcher Web Dashboard (M7)

## Overview
The Dispatcher Web Dashboard is a real-time, interactive operations console built with Next.js 15 (App Router), Tailwind CSS, shadcn/ui design patterns, and MapLibre GL JS powered by OpenStreetMap raster tiles (free and open-source, requiring zero proprietary API keys).

It connects via WebSocket to the Fleet Pulse API Socket.IO gateway and receives live driver locations, status updates, and delivery request lifecycle events.

---

## Features

### 1. Interactive Fleet Map (`MapLibre GL JS`)
- Centered on Bengaluru metropolitan area `[77.5946, 12.9716]` at zoom 12.
- Uses open OpenStreetMap raster tile style with fast client-side caching.
- Custom color-coded driver markers:
  - **Available**: Emerald green with vehicle direction indicator arrow rotated to driver's heading.
  - **Busy**: Amber orange with active trip indicator.
  - **Offline**: Neutral slate gray.
- Custom pickup (`P`, green) and dropoff (`D`, blue) pins with request ID tooltips.
- Interactive coordinate picker mode with crosshair cursor for selecting pickup and dropoff points directly on the map canvas.

### 2. Operations Side Panel
- **Collapsible Tabbed Drawer**:
  - **Deliveries Queue**: Displays active, pending, and completed delivery requests with priority badges, status pills, and direct `Fly to Pickup` navigation. Sub-tabs filter by `All`, `Pending`, `Active`, and `Done`.
  - **Fleet Directory**: Live search by driver name or phone number, status filter chips (`All`, `Available`, `Busy`, `Offline`), star rating, speed indicator, and active trip reference.

### 3. Create Delivery Request Modal
- Allows dispatchers to input pickup and dropoff coordinates manually or via:
  - **Map-Click Coordinate Picker**: One-click interactive pin dropper.
  - **Quick Bengaluru Hub Presets**: Koramangala, Indiranagar, MG Road, Bellandur, Whitefield, HSR Layout, Hebbal, Electronic City.
- Configurable priority selector (1 = Standard, 2 = Express, 3 = Urgent).

### 4. Floating Simulator Controller HUD
- Real-time overlay in the bottom-left corner with collapsible controls:
  - Live simulation state toggle (Start / Stop).
  - Driver count slider (5 to 100).
  - Speed multiplier slider (1x to 20x).
  - Request generation rate slider (0 to 60 req/min).
  - Real-time audit counters: Requests Created, Requests Assigned, Requests Completed, and Double Assignments Detected (`0`).

---

## Verification
- **Unit / Typecheck**: TypeScript strict mode passed across the monorepo.
- **Next.js Production Build**: `pnpm --filter @fleet-pulse/web build` passed with zero errors.
- **Playwright E2E**:
  ```bash
  pnpm --filter @fleet-pulse/web test:e2e
  ```
  **Result**: Verified page load, MapLibre GL canvas container rendering, sidebar tab switching, create delivery request modal open/close, simulator HUD controls, and zero console errors.
